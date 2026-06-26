/**
 * MCP tools query — composer-facing wrapper around
 * `window.mainApi.mcp.listTools(serverName, workspaceId)`.
 *
 * The Compose-mode wire stage (slice 20.C3) needs to populate the
 * methods dropdown for MCP-class providers. The underlying bridge is
 * already exposed by dash-core's defaultMainApi; this module adapts
 * its `{ tools } | { error, message }` response into a normalized
 * `{ status, tools, error }` shape the UI can switch on without
 * branching on undefined/missing-bridge cases at every callsite.
 *
 * Why a thin wrapper and a hook in the same file: the composer's
 * picker is async (servers may not have been started, listTools can
 * fail mid-flight), and reusing the same normalization for a hook
 * version (loading state + cancellation) avoids drift between the
 * imperative and declarative call paths.
 */

import { useEffect, useRef, useState } from "react";

const EMPTY_TOOLS = Object.freeze([]);

// One listTools attempt against an already-running server, normalized.
async function listOnce(api, serverName, workspaceId) {
    const result = await api.listTools(serverName, workspaceId);
    if (result && result.error) {
        return {
            status: "error",
            tools: EMPTY_TOOLS,
            error:
                typeof result.message === "string"
                    ? result.message
                    : String(result.error),
        };
    }
    const tools = Array.isArray(result && result.tools)
        ? result.tools
        : EMPTY_TOOLS;
    return { status: "ok", tools, error: null };
}

/**
 * Imperative call. Returns one of:
 *   { status: "ok",    tools: Array<Tool>, error: null }
 *   { status: "error", tools: [],           error: string }
 *
 * Never throws — the composer would otherwise need a try/catch
 * around every picker open. `tools` is always an array, so callers
 * can `.map()` unconditionally.
 *
 * `provider` (optional) — the configured provider object
 * (`{ mcpConfig, credentials, ... }`). `listTools` only reads from a
 * RUNNING server, but the widget builder has no workspace so the
 * provider's server usually isn't started yet (that normally happens
 * when a dashboard loads). When the first list fails and a provider
 * with `mcpConfig` is supplied, we start the server on demand (the
 * same `startServer` call `useMcpProvider` makes — idempotent and
 * deduped main-side) and retry. This is what lets a brand-new widget
 * wire to a provider's tools without an open dashboard.
 */
export async function fetchMcpTools(
    serverName,
    workspaceId = null,
    provider = null
) {
    if (typeof serverName !== "string" || serverName.length === 0) {
        return {
            status: "error",
            tools: EMPTY_TOOLS,
            error: "serverName is required",
        };
    }
    const api =
        typeof window !== "undefined" && window.mainApi && window.mainApi.mcp;
    if (!api || typeof api.listTools !== "function") {
        return {
            status: "error",
            tools: EMPTY_TOOLS,
            error: "MCP bridge unavailable (window.mainApi.mcp.listTools missing)",
        };
    }
    try {
        let res = await listOnce(api, serverName, workspaceId);
        if (
            res.status === "error" &&
            provider &&
            provider.mcpConfig &&
            typeof api.startServer === "function"
        ) {
            try {
                const startRes = await api.startServer(
                    serverName,
                    provider.mcpConfig,
                    provider.credentials || {},
                    workspaceId
                );
                if (!startRes || !startRes.error) {
                    res = await listOnce(api, serverName, workspaceId);
                } else if (typeof startRes.message === "string") {
                    res = {
                        status: "error",
                        tools: EMPTY_TOOLS,
                        error: startRes.message,
                    };
                }
            } catch {
                // Keep the original list error — surfacing the start
                // failure separately would be more confusing than helpful.
            }
        }
        return res;
    } catch (err) {
        return {
            status: "error",
            tools: EMPTY_TOOLS,
            error:
                (err && (err.message || err.toString())) ||
                "Unknown MCP listTools failure",
        };
    }
}

/**
 * Declarative hook. Returns one of:
 *   { status: "idle",    tools: [], error: null }   // serverName not yet set
 *   { status: "loading", tools: [], error: null }   // request in flight
 *   { status: "ok",      tools: [...], error: null }
 *   { status: "error",   tools: [], error: string }
 *
 * Re-runs when `serverName` or `workspaceId` changes. Cancellation
 * is via a `cancelled` flag — the in-flight promise is not
 * abortable through the IPC bridge, so a stale response from a
 * previous serverName is dropped rather than aborted.
 */
export function useMcpTools(
    serverName,
    workspaceId = null,
    provider = null,
    reloadToken = 0
) {
    // Provider object can be a fresh reference each render (it arrives via the
    // __dashAppContext bridge). Read it through a ref so the effect re-runs
    // only when serverName/workspaceId change, not on every parent render.
    const providerRef = useRef(provider);
    providerRef.current = provider;

    const [state, setState] = useState({
        status: "idle",
        tools: EMPTY_TOOLS,
        error: null,
    });

    useEffect(() => {
        if (typeof serverName !== "string" || serverName.length === 0) {
            setState({ status: "idle", tools: EMPTY_TOOLS, error: null });
            return undefined;
        }
        let cancelled = false;
        setState({ status: "loading", tools: EMPTY_TOOLS, error: null });
        fetchMcpTools(serverName, workspaceId, providerRef.current).then(
            (result) => {
                if (!cancelled) setState(result);
            }
        );
        return () => {
            cancelled = true;
        };
    }, [serverName, workspaceId, reloadToken]);

    return state;
}
