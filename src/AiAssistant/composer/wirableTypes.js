/**
 * wirableTypes — Compose-mode source-of-truth for "what provider
 * types can a slot be wired to?".
 *
 * Replaces the earlier WirePicker behavior that only surfaced
 * provider INSTANCES the user had already configured. With that
 * model, a fresh install had nothing to wire to and the user was
 * told to "Add a provider in Settings → Providers" — turning the
 * Compose flow into a dead end.
 *
 * The new model: enumerate every TYPE the framework knows how to
 * talk to:
 *
 *   1. Credential types from PROVIDER_API_REGISTRY (the IPC-bridged
 *      surface — currently just `algolia` but extends as more
 *      services get bridges).
 *   2. MCP types from the MCP server catalog (github, slack, gmail,
 *      google-drive, postgres, …) bundled with @trops/dash-core
 *      and fetched at runtime via `mainApi.mcp.getCatalog()`.
 *
 * A "wire to type X" decision can be made even if no instance of X
 * is configured yet. The compile pipeline / install flow downstream
 * will surface a missing-provider banner using the same machinery
 * the existing chat-built widgets use.
 *
 * Each returned entry:
 *   {
 *     id:    "gmail",            // the provider type identifier
 *     name:  "Gmail",            // display name
 *     kind:  "credential" | "mcp",
 *     description: "…",          // user-facing one-liner
 *     hasConfiguredInstance: bool, // hint shown in the picker UI
 *     configuredInstances: [name, …],
 *   }
 *
 * Sorted alphabetically by `name` for stable display.
 */

import { useEffect, useState } from "react";
import { PROVIDER_API_REGISTRY } from "../providerApiRegistry";

const CREDENTIAL_TYPE_LABELS = {
    algolia: "Algolia",
};

// One-line description per credential type. Without this the
// picker rows for credential providers are noticeably shorter
// than MCP rows (which carry catalog descriptions), making the
// list look uneven. Keep these brief — the picker truncates to
// two lines anyway. Falls back to a generic credential
// description for types not explicitly listed.
const CREDENTIAL_TYPE_DESCRIPTIONS = {
    algolia: "Search and manage Algolia indices via your API key.",
};
const CREDENTIAL_DEFAULT_DESCRIPTION =
    "Direct API access via stored credentials.";

/**
 * React hook surface — async-aware. Returns
 *   { status: "idle"|"loading"|"ok"|"error",
 *     types: WirableType[], error: string|null }
 *
 * `providers` is the app.providers map; used to annotate each type
 * with whether the user already has a configured instance (so the
 * picker can show "1 configured" badges and prefer wired-up types
 * in the list ordering).
 */
export function useWirableTypes(providers = {}) {
    const [state, setState] = useState({
        status: "idle",
        types: [],
        error: null,
    });

    useEffect(() => {
        let cancelled = false;
        const credentialTypes = enumerateCredentialTypes(providers);
        // Show credential types immediately — they come from a
        // synchronous registry. The MCP catalog load (async) only
        // adds more types; the picker isn't blocked waiting for it.
        // status starts as "loading" only so the UI can surface a
        // "fetching more…" hint if we want to in the future.
        setState({
            status: "loading",
            types: credentialTypes,
            error: null,
        });

        const finalize = (mcpTypes, error) => {
            if (cancelled) return;
            // Surface the user's CONFIGURED custom MCP providers (ones whose
            // type isn't in the bundled catalog) so they can be wired too.
            // Without this, a custom provider created in Settings → Providers
            // never appears in the picker. Enumerated per-instance (by name)
            // since custom providers commonly share type "custom".
            const knownMcpIds = new Set(mcpTypes.map((t) => t.id));
            const customMcpTypes = enumerateConfiguredCustomMcp(
                providers,
                knownMcpIds
            );
            const combined = [
                ...credentialTypes,
                ...mcpTypes,
                ...customMcpTypes,
            ].sort((a, b) => a.name.localeCompare(b.name));
            setState({
                status: error ? "error" : "ok",
                types: combined,
                error: error || null,
            });
        };

        loadMcpCatalog()
            .then((catalog) => {
                const mcpTypes = enumerateMcpTypes(catalog, providers);
                finalize(mcpTypes, null);
            })
            .catch((err) => {
                // Soft-fail: credential types still surface even if
                // the MCP bridge is unavailable (renderer not in
                // Electron, etc.).
                finalize([], err && err.message ? err.message : String(err));
            });

        return () => {
            cancelled = true;
        };
    }, [providers]);

    return state;
}

function enumerateCredentialTypes(providers) {
    const configuredByType = groupConfiguredInstancesByType(providers);
    const out = [];
    for (const typeId of Object.keys(PROVIDER_API_REGISTRY)) {
        const instances = configuredByType.credential[typeId] || [];
        out.push({
            id: typeId,
            name: CREDENTIAL_TYPE_LABELS[typeId] || typeId,
            kind: "credential",
            description:
                CREDENTIAL_TYPE_DESCRIPTIONS[typeId] ||
                CREDENTIAL_DEFAULT_DESCRIPTION,
            hasConfiguredInstance: instances.length > 0,
            configuredInstances: instances,
        });
    }
    return out;
}

/**
 * Enumerate the user's configured MCP provider INSTANCES whose `type` is not
 * a known catalog id (i.e. custom MCP servers added in Settings → Providers).
 * One entry per instance — keyed/displayed by the provider's friendly name —
 * so multiple custom servers (which commonly all carry `type: "custom"`) show
 * as distinct rows. Each entry carries `instanceName` so the picker binds the
 * wire to that specific instance and introspects its live tools.
 *
 * @param {object} providers app.providers map (name → provider)
 * @param {Set<string>} knownMcpIds catalog mcp type ids already enumerated
 */
function enumerateConfiguredCustomMcp(providers, knownMcpIds) {
    const out = [];
    if (!providers || typeof providers !== "object") return out;
    for (const [instanceName, p] of Object.entries(providers)) {
        if (!p || p.providerClass !== "mcp" || !p.type) continue;
        // Skip providers already represented by a catalog type entry.
        if (knownMcpIds && knownMcpIds.has(p.type)) continue;
        out.push({
            id: p.type, // real type ("custom") — emitted as providerType
            name: instanceName, // friendly, distinguishes multiple customs
            kind: "mcp",
            description:
                p.mcpConfig && p.mcpConfig.url
                    ? `Custom MCP — ${p.mcpConfig.url}`
                    : "Custom MCP provider configured in Settings → Providers.",
            hasConfiguredInstance: true,
            configuredInstances: [instanceName],
            instanceName, // the specific instance to bind + introspect
            custom: true,
        });
    }
    return out;
}

function enumerateMcpTypes(catalog, providers) {
    // The bridge has historically returned two shapes:
    //   - { catalog: [server, server, ...] }       (current; the
    //     bridge unwraps `catalog.servers` itself)
    //   - { catalog: { version, servers: [...] } } (raw catalog file)
    // Accept either so a future bridge restructure doesn't silently
    // collapse the type list to zero.
    let servers = [];
    if (Array.isArray(catalog)) {
        servers = catalog;
    } else if (catalog && Array.isArray(catalog.servers)) {
        servers = catalog.servers;
    }
    const configuredByType = groupConfiguredInstancesByType(providers);
    return servers.map((s) => {
        const instances = configuredByType.mcp[s.id] || [];
        return {
            id: s.id,
            name: s.name || s.id,
            kind: "mcp",
            description: s.description || "",
            hasConfiguredInstance: instances.length > 0,
            configuredInstances: instances,
        };
    });
}

function groupConfiguredInstancesByType(providers) {
    const out = { credential: {}, mcp: {} };
    if (!providers || typeof providers !== "object") return out;
    for (const [instanceName, p] of Object.entries(providers)) {
        if (!p || !p.type) continue;
        const kind = p.providerClass === "mcp" ? "mcp" : "credential";
        if (!out[kind][p.type]) out[kind][p.type] = [];
        out[kind][p.type].push(instanceName);
    }
    return out;
}

/**
 * Promise wrapper around `window.mainApi.mcp.getCatalog()`. Returns
 * `{ catalog: { servers: [...] } }`-shaped on success, throws on
 * failure (no catalog or bridge unavailable).
 */
async function loadMcpCatalog() {
    if (
        typeof window === "undefined" ||
        !window.mainApi ||
        !window.mainApi.mcp ||
        typeof window.mainApi.mcp.getCatalog !== "function"
    ) {
        throw new Error("MCP catalog bridge unavailable");
    }
    const result = await window.mainApi.mcp.getCatalog();
    if (!result || result.error) {
        throw new Error(
            (result && (result.message || result.error)) ||
                "Failed to load MCP catalog"
        );
    }
    return result.catalog || result;
}
