import React, { useMemo, useState } from "react";
import { PROVIDER_API_REGISTRY } from "../providerApiRegistry";
import { useMcpTools } from "../mcpToolsQuery";
import { scoreMethodList } from "./wireMatching";
import { useWirableTypes } from "./wirableTypes";
import { getKnownToolsForType, getKnownToolArgs } from "./mcpKnownTools";

/**
 * WirePicker — Compose-mode Stage 3 in-place picker.
 *
 * Renders inside a property-inspector row whenever a slot is in
 * wire mode and unconfigured (`{ provider: null, method: null }`).
 *
 * Two-step flow within the same compact space:
 *
 *   1. Provider step — list of the user's configured providers
 *      from app.providers, filtered to known classes (credential
 *      registered in providerApiRegistry, or class="mcp").
 *      Clicking a provider advances to step 2.
 *
 *   2. Method step — list of methods filtered by return-shape
 *      compatibility with the slot's expected schema type
 *      (Table.data → Array-returning methods only). MCP tools are
 *      enumerated asynchronously via useMcpTools.
 *      Clicking a method calls `onPick(wireSpec)` with:
 *        { provider, providerType, providerClass, method }
 *
 * A "← Back" link returns from method step to provider step. The
 * provider list itself has no Back — the slot-mode toggle does
 * that job.
 *
 * The picker does NOT close itself — the parent (PropertyInspector)
 * decides whether to swap to the WiredSlotSummary (filled) or stay
 * on the picker (cleared) based on the wire spec it sees afterwards.
 */
export function WirePicker({
    propName,
    expectedType,
    providers,
    tree = null,
    allowPipe = false,
    onPick,
    onPipe,
}) {
    const [pickedType, setPickedType] = useState(null);
    const wirable = useWirableTypes(providers);

    // Find other wires in the tree that could feed this slot. Pipe
    // is only useful when there's at least one configured wire to
    // pipe FROM (typically a callback handler whose tool fires on
    // event). Data wires can also be piped from (e.g., two slots
    // showing the same fetched list).
    const pipeSources = useMemo(() => {
        if (!allowPipe || !tree || !tree.root) return [];
        const sources = [];
        const visit = (node) => {
            if (!node) return;
            if (node.wires) {
                for (const [pName, w] of Object.entries(node.wires)) {
                    if (!w) continue;
                    // Configured method wires (any kind other than
                    // pipe) are pipe-able.
                    if (w.kind !== "pipe" && w.method && w.providerType) {
                        sources.push({
                            nodeId: node.id,
                            propName: pName,
                            nodeType: node.type,
                            label: `${node.type}.${pName} → ${w.providerType}.${w.method}`,
                        });
                    }
                }
            }
            if (Array.isArray(node.children)) {
                for (const c of node.children) visit(c);
            }
        };
        visit(tree.root);
        return sources;
    }, [tree, allowPipe]);

    if (!pickedType) {
        return (
            <ProviderTypeStep
                propName={propName}
                wirable={wirable}
                pipeSources={pipeSources}
                onPipe={onPipe}
                onPick={setPickedType}
            />
        );
    }

    // For the method step we also need to know which (if any)
    // configured provider instance to bind the resulting wire to.
    // If exactly one instance is configured, auto-bind it. If
    // multiple exist, pick the first (the install flow can let the
    // user rebind). If none, leave `provider` null — the install
    // flow surfaces a "configure a {type} provider" prompt.
    const autoInstance =
        Array.isArray(pickedType.configuredInstances) &&
        pickedType.configuredInstances.length > 0
            ? pickedType.configuredInstances[0]
            : null;

    return (
        <MethodStep
            propName={propName}
            expectedType={expectedType}
            type={pickedType}
            providers={providers}
            onBack={() => setPickedType(null)}
            onPick={(method) =>
                onPick({
                    provider: autoInstance,
                    providerType: pickedType.id,
                    providerClass: pickedType.kind,
                    method,
                })
            }
        />
    );
}

function ProviderTypeStep({
    propName,
    wirable,
    pipeSources = [],
    onPipe,
    onPick,
}) {
    // Only show the loading-only state when we have nothing to show
    // yet. Credential types arrive synchronously from the registry,
    // so usually the list is non-empty even during the catalog
    // fetch.
    if (wirable.status === "loading" && wirable.types.length === 0) {
        return (
            <div
                className="text-[11px] px-2 py-1.5 rounded border border-dashed border-gray-700 bg-gray-900/50 text-gray-500"
                data-testid={`composer-wire-loading-${propName}`}
            >
                Loading provider catalog…
            </div>
        );
    }
    if (wirable.types.length === 0) {
        return (
            <div
                className="text-[11px] px-2 py-1.5 rounded border border-dashed border-gray-700 bg-gray-900/50 text-gray-500"
                data-testid={`composer-wire-empty-${propName}`}
            >
                No wirable provider types available.
                {wirable.error && (
                    <span className="block text-red-400 mt-1">
                        {wirable.error}
                    </span>
                )}
            </div>
        );
    }
    return (
        <div
            className="rounded border border-gray-700 bg-gray-900/50 p-1 max-h-72 overflow-y-auto"
            data-testid={`composer-wire-providers-${propName}`}
        >
            {pipeSources.length > 0 && onPipe && (
                <div
                    className="mb-2 pb-2 border-b border-gray-700"
                    data-testid={`composer-pipe-sources-${propName}`}
                >
                    <div className="text-[10px] uppercase tracking-wide text-gray-500 px-1 mb-1">
                        Or pipe from an existing wire
                    </div>
                    <div className="flex flex-col">
                        {pipeSources.map((src) => (
                            <button
                                key={`${src.nodeId}:${src.propName}`}
                                type="button"
                                onClick={() => onPipe(src.nodeId, src.propName)}
                                className="text-left text-xs px-2 py-1 rounded hover:bg-amber-700/30 text-gray-300 hover:text-amber-200"
                                data-testid={`composer-pipe-source-${propName}-${src.nodeId}-${src.propName}`}
                            >
                                <span className="font-mono">{src.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <div className="text-[10px] uppercase tracking-wide text-gray-500 px-1 mb-1">
                Pick a provider type
            </div>
            <div className="flex flex-col">
                {wirable.types.map((t) => (
                    <button
                        key={`${t.kind}:${t.id}`}
                        type="button"
                        onClick={() => onPick(t)}
                        className="text-left text-xs px-2 py-1 rounded hover:bg-indigo-700/30 text-gray-300 hover:text-indigo-200"
                        data-testid={`composer-wire-provider-${propName}-${t.id}`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{t.name}</span>
                            <span className="text-[10px] text-gray-500 shrink-0">
                                {t.kind}
                                {t.hasConfiguredInstance && (
                                    <span className="ml-1 text-emerald-400">
                                        ✓ configured
                                    </span>
                                )}
                            </span>
                        </div>
                        {t.description && (
                            <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">
                                {t.description}
                            </div>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}

function MethodStep({
    propName,
    expectedType,
    type,
    providers,
    onBack,
    onPick,
}) {
    if (type.kind === "mcp") {
        return (
            <McpMethodStep
                propName={propName}
                type={type}
                providers={providers}
                onBack={onBack}
                onPick={onPick}
            />
        );
    }
    return (
        <CredentialMethodStep
            propName={propName}
            expectedType={expectedType}
            type={type}
            onBack={onBack}
            onPick={onPick}
        />
    );
}

function CredentialMethodStep({
    propName,
    expectedType,
    type,
    onBack,
    onPick,
}) {
    const ranked = useMemo(() => {
        const registry = PROVIDER_API_REGISTRY[type.id] || {};
        return scoreMethodList(Object.entries(registry), expectedType);
    }, [type.id, expectedType]);

    return (
        <div
            className="rounded border border-gray-700 bg-gray-900/50 p-1"
            data-testid={`composer-wire-methods-${propName}`}
        >
            <PickerHeader
                title={`Methods on ${type.name}`}
                expectedType={expectedType}
                onBack={onBack}
            />
            {ranked.length === 0 ? (
                <div className="text-[11px] text-gray-500 px-2 py-1">
                    No methods on this provider return a shape compatible with{" "}
                    <code className="text-gray-400">{expectedType}</code>.
                </div>
            ) : (
                <div className="flex flex-col">
                    {ranked.map(({ name, spec, score }) => (
                        <button
                            key={name}
                            type="button"
                            onClick={() => onPick(name)}
                            className="text-left text-xs px-2 py-1 rounded hover:bg-indigo-700/30 text-gray-300 hover:text-indigo-200"
                            data-testid={`composer-wire-method-${propName}-${name}`}
                            title={spec.desc || ""}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-mono">{name}</span>
                                <span className="text-[10px] text-gray-500 ml-2">
                                    {spec.returns &&
                                        spec.returns.type &&
                                        truncate(spec.returns.type, 32)}
                                    {score === 1 && (
                                        <span className="ml-1 text-yellow-500/70">
                                            ~
                                        </span>
                                    )}
                                </span>
                            </div>
                            {spec.desc && (
                                <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">
                                    {spec.desc}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function McpMethodStep({ propName, type, providers, onBack, onPick }) {
    // The MCP listTools bridge only works against a RUNNING server,
    // which requires a configured + started instance. If the user
    // has one, use it; otherwise show a configure-first hint plus
    // a free-text tool-name input so the user can still wire to a
    // tool they know exists by name (the install flow will refuse
    // the install if the tool turns out not to be real).
    const configuredInstance = useMemo(() => {
        for (const [name, p] of Object.entries(providers || {})) {
            if (p?.type === type.id && p?.providerClass === "mcp") {
                return p.serverName || name;
            }
        }
        return null;
    }, [providers, type.id]);
    const knownTools = useMemo(() => getKnownToolsForType(type.id), [type.id]);
    const { status, tools, error } = useMcpTools(configuredInstance, null);
    const [freeText, setFreeText] = useState("");

    return (
        <div
            className="rounded border border-gray-700 bg-gray-900/50 p-1"
            data-testid={`composer-wire-methods-${propName}`}
        >
            <PickerHeader
                title={`Tools on ${type.name}`}
                expectedType="(MCP)"
                onBack={onBack}
            />
            {!configuredInstance && knownTools && (
                <>
                    <div className="text-[10px] text-amber-400 px-2 py-1">
                        Approximate — configure a {type.name} provider in
                        Settings → Providers for the live tool list.
                    </div>
                    <div
                        className="flex flex-col"
                        data-testid={`composer-wire-known-tools-${propName}`}
                    >
                        {knownTools.map((tool) => (
                            <button
                                key={tool.name}
                                type="button"
                                onClick={() => onPick(tool.name)}
                                className="text-left text-xs px-2 py-1 rounded hover:bg-indigo-700/30 text-gray-300 hover:text-indigo-200"
                                data-testid={`composer-wire-method-${propName}-${tool.name}`}
                                title={tool.description || ""}
                            >
                                <span className="font-mono">{tool.name}</span>
                                {tool.description && (
                                    <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">
                                        {tool.description}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
            {!configuredInstance && !knownTools && (
                <div className="text-[11px] text-gray-500 px-2 py-1 space-y-1">
                    <div>
                        No configured {type.name} provider and no static tool
                        list available. Configure one in Settings → Providers to
                        enumerate, or wire to a known tool name below.
                    </div>
                    <div className="flex gap-1">
                        <input
                            type="text"
                            value={freeText}
                            onChange={(e) => setFreeText(e.target.value)}
                            placeholder="tool name"
                            className="flex-1 px-1.5 py-0.5 text-[11px] font-mono bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-indigo-500"
                            data-testid={`composer-wire-tool-input-${propName}`}
                        />
                        <button
                            type="button"
                            onClick={() => {
                                if (freeText.trim()) onPick(freeText.trim());
                            }}
                            disabled={!freeText.trim()}
                            className="px-2 py-0.5 text-[11px] rounded bg-indigo-700 hover:bg-indigo-600 disabled:bg-gray-700 disabled:text-gray-500 text-white"
                            data-testid={`composer-wire-tool-confirm-${propName}`}
                        >
                            Wire
                        </button>
                    </div>
                </div>
            )}
            {configuredInstance && status === "loading" && (
                <div className="text-[11px] text-gray-500 px-2 py-1">
                    Loading tools from {configuredInstance}…
                </div>
            )}
            {configuredInstance && status === "error" && (
                <div className="text-[11px] text-red-400 px-2 py-1">
                    {error || "Failed to load tools"}
                </div>
            )}
            {configuredInstance && status === "ok" && tools.length === 0 && (
                <div className="text-[11px] text-gray-500 px-2 py-1">
                    No tools exposed by this server.
                </div>
            )}
            {configuredInstance && status === "ok" && tools.length > 0 && (
                <div className="flex flex-col">
                    {tools.map((tool) => (
                        <button
                            key={tool.name}
                            type="button"
                            onClick={() => onPick(tool.name)}
                            className="text-left text-xs px-2 py-1 rounded hover:bg-indigo-700/30 text-gray-300 hover:text-indigo-200"
                            data-testid={`composer-wire-method-${propName}-${tool.name}`}
                            title={tool.description || ""}
                        >
                            <span className="font-mono">{tool.name}</span>
                            {tool.description && (
                                <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">
                                    {tool.description}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function PickerHeader({ title, expectedType, onBack }) {
    // Suppress the "→ <type>" hint when the type is the unrestricted
    // sentinel ("any") or "function" — neither is a useful filter
    // hint to surface; the former matches everything and the latter
    // would imply "method returning a function," which is wrong for
    // callback wires that just fire on event.
    const showExpected =
        expectedType && expectedType !== "any" && expectedType !== "function";
    return (
        <div className="flex items-center justify-between px-1 mb-1">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">
                {title}{" "}
                {showExpected && (
                    <span className="text-gray-600">
                        → <code>{expectedType}</code>
                    </span>
                )}
            </div>
            <button
                type="button"
                onClick={onBack}
                className="text-[10px] text-indigo-400 hover:text-indigo-200"
                data-testid="composer-wire-back"
            >
                ← Back
            </button>
        </div>
    );
}

function truncate(s, max) {
    if (typeof s !== "string") return "";
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// Credential-provider methods always carry these three handle fields
// as the first three args — the emitter auto-supplies them from the
// resolved provider client, so the user never needs to bind them.
// Filtered out of the arg editor.
const CREDENTIAL_AUTO_ARGS = new Set([
    "providerHash",
    "dashboardAppId",
    "providerName",
]);

/**
 * Read-only display of a configured wire spec + per-arg binding
 * editor.
 *
 * Rendered by the property inspector once the picker has set a
 * method. Shows the provider + method header with Change / Static
 * buttons, then a row per bindable method arg (for credential
 * methods, sourced from PROVIDER_API_REGISTRY[type][method].args).
 * For mcp tools there is no static arg schema, so this falls back
 * to showing whatever args the user has already bound — the user
 * can add new args via a free-text name input.
 *
 * Each arg row binds either to a literal value (JSON-encoded for
 * non-scalars) or to a userConfig field name. The kind toggle
 * persists per arg; switching between literal and userConfig
 * preserves the literal value so the user can experiment.
 */
export function WiredSlotSummary({
    propName,
    wire,
    isCallbackWire = false,
    onChange,
    onStatic,
    onSetArg,
}) {
    const argNames = useMemo(() => {
        if (wire.providerClass === "mcp") {
            // MCP tools: prefer the known-tools catalog so required
            // args (like google-drive.search.query) are surfaced
            // for binding BEFORE the user runs the widget and hits
            // a "Missing required argument" error at runtime.
            // Merge with whatever the user has already bound so
            // unknown-catalog args don't vanish.
            const known =
                getKnownToolArgs(wire.providerType, wire.method) || [];
            const bound = Object.keys(wire.args || {});
            const merged = [...known];
            for (const b of bound) if (!merged.includes(b)) merged.push(b);
            return merged;
        }
        const reg =
            PROVIDER_API_REGISTRY[wire.providerType] &&
            PROVIDER_API_REGISTRY[wire.providerType][wire.method];
        if (!reg || !Array.isArray(reg.args)) return [];
        return reg.args.filter((a) => !CREDENTIAL_AUTO_ARGS.has(a));
    }, [wire.providerType, wire.providerClass, wire.method, wire.args]);

    return (
        <div
            className="rounded border border-indigo-700/40 bg-indigo-900/20 text-indigo-200"
            data-testid={`composer-wire-summary-${propName}`}
        >
            <div className="flex items-center justify-between text-[11px] px-2 py-1.5">
                <div className="min-w-0">
                    <span className="text-gray-400">Wired to: </span>
                    <span className="font-mono">
                        {wire.provider || wire.providerType || "?"}.
                        {wire.method}
                    </span>
                    {!wire.provider && wire.providerType && (
                        <span className="ml-2 text-[10px] text-amber-400">
                            (configure a {wire.providerType} provider to run)
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                    <button
                        type="button"
                        onClick={onChange}
                        className="text-[10px] text-indigo-300 hover:text-indigo-100 underline"
                        data-testid={`composer-wire-change-${propName}`}
                    >
                        Change
                    </button>
                    <button
                        type="button"
                        onClick={onStatic}
                        className="text-[10px] text-gray-400 hover:text-gray-200 underline"
                        data-testid={`composer-wire-revert-${propName}`}
                    >
                        Static
                    </button>
                </div>
            </div>
            {argNames.length > 0 && onSetArg && (
                <div
                    className="px-2 py-1.5 border-t border-indigo-700/40 space-y-1.5"
                    data-testid={`composer-wire-args-${propName}`}
                >
                    {argNames.map((argName) => (
                        <ArgRow
                            key={argName}
                            propName={propName}
                            argName={argName}
                            binding={(wire.args || {})[argName]}
                            isCallbackWire={isCallbackWire}
                            onSetArg={onSetArg}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function ArgRow({ propName, argName, binding, isCallbackWire, onSetArg }) {
    const kind = (binding && binding.kind) || "literal";

    return (
        <div data-testid={`composer-arg-row-${propName}-${argName}`}>
            <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-mono text-indigo-200">
                    {argName}
                </span>
                <div className="flex items-center gap-0.5 text-[10px] bg-gray-800 border border-gray-700 rounded p-0.5">
                    <button
                        type="button"
                        onClick={() =>
                            onSetArg(propName, argName, {
                                kind: "literal",
                                value:
                                    (binding &&
                                        binding.kind === "literal" &&
                                        binding.value) ||
                                    "",
                            })
                        }
                        className={`px-1.5 py-0.5 rounded ${
                            kind === "literal"
                                ? "bg-indigo-600/40 text-indigo-100"
                                : "text-gray-500 hover:text-gray-300"
                        }`}
                        data-testid={`composer-arg-kind-literal-${propName}-${argName}`}
                    >
                        literal
                    </button>
                    <button
                        type="button"
                        onClick={() =>
                            onSetArg(propName, argName, {
                                kind: "userConfig",
                                field:
                                    (binding &&
                                        binding.kind === "userConfig" &&
                                        binding.field) ||
                                    argName,
                            })
                        }
                        className={`px-1.5 py-0.5 rounded ${
                            kind === "userConfig"
                                ? "bg-indigo-600/40 text-indigo-100"
                                : "text-gray-500 hover:text-gray-300"
                        }`}
                        data-testid={`composer-arg-kind-userConfig-${propName}-${argName}`}
                    >
                        userConfig
                    </button>
                    {isCallbackWire && (
                        <button
                            type="button"
                            onClick={() =>
                                onSetArg(propName, argName, {
                                    kind: "eventArg",
                                })
                            }
                            className={`px-1.5 py-0.5 rounded ${
                                kind === "eventArg"
                                    ? "bg-indigo-600/40 text-indigo-100"
                                    : "text-gray-500 hover:text-gray-300"
                            }`}
                            data-testid={`composer-arg-kind-eventArg-${propName}-${argName}`}
                            title="Pass the event handler's first argument (the input's new value, the clicked item, etc.)"
                        >
                            event
                        </button>
                    )}
                </div>
            </div>
            {kind === "literal" ? (
                <input
                    type="text"
                    value={
                        binding && binding.kind === "literal"
                            ? typeof binding.value === "string"
                                ? binding.value
                                : JSON.stringify(binding.value)
                            : ""
                    }
                    onChange={(e) => {
                        const raw = e.target.value;
                        // Try parsing as JSON first (numbers, objects,
                        // booleans). Fall back to plain string when
                        // the parse fails — that's the common case for
                        // free-text args like indexName, query, etc.
                        let value = raw;
                        if (raw.length > 0 && /^[\d{[\-"tfn]/.test(raw)) {
                            try {
                                value = JSON.parse(raw);
                            } catch {
                                value = raw;
                            }
                        }
                        onSetArg(propName, argName, {
                            kind: "literal",
                            value,
                        });
                    }}
                    className="w-full px-1.5 py-0.5 text-[10px] font-mono bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-indigo-500"
                    data-testid={`composer-arg-literal-input-${propName}-${argName}`}
                    placeholder='"" / 0 / [...] / true'
                />
            ) : kind === "eventArg" ? (
                <div
                    className="text-[10px] px-1.5 py-1 font-mono text-indigo-200 bg-gray-900/50 border border-gray-700 rounded"
                    data-testid={`composer-arg-eventarg-display-${propName}-${argName}`}
                >
                    eventArg{" "}
                    <span className="text-gray-500">
                        (= the event handler's first arg)
                    </span>
                </div>
            ) : (
                <input
                    type="text"
                    value={
                        binding && binding.kind === "userConfig"
                            ? binding.field || ""
                            : ""
                    }
                    onChange={(e) =>
                        onSetArg(propName, argName, {
                            kind: "userConfig",
                            field: e.target.value,
                        })
                    }
                    className="w-full px-1.5 py-0.5 text-[10px] font-mono bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-indigo-500"
                    data-testid={`composer-arg-userconfig-input-${propName}-${argName}`}
                    placeholder="userConfig field name"
                />
            )}
        </div>
    );
}

/**
 * Summary card for a slot that's piped from another wire (typically
 * a callback handler whose tool result populates this slot's data).
 * Shows the source as `<NodeType>.<propName>` plus Change (clears
 * the pipe → picker reappears) and Static (flip back to literal)
 * buttons.
 */
export function PipedSlotSummary({ propName, wire, tree, onChange, onStatic }) {
    const sourceLabel = (() => {
        if (!wire || !wire.sourceNodeId) return "(unknown)";
        // Walk the tree to find the source node's type for display.
        if (!tree || !tree.root)
            return `${wire.sourceNodeId}.${wire.sourcePropName}`;
        let label = `${wire.sourceNodeId}.${wire.sourcePropName}`;
        const visit = (node) => {
            if (!node) return;
            if (node.id === wire.sourceNodeId) {
                label = `${node.type}.${wire.sourcePropName}`;
                return;
            }
            if (Array.isArray(node.children)) {
                for (const c of node.children) visit(c);
            }
        };
        visit(tree.root);
        return label;
    })();

    return (
        <div
            className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded border border-amber-700/40 bg-amber-900/20 text-amber-200"
            data-testid={`composer-pipe-summary-${propName}`}
        >
            <div className="min-w-0">
                <span className="text-gray-400">Piped from: </span>
                <span className="font-mono">{sourceLabel}</span>
            </div>
            <div className="flex items-center gap-2 ml-2 shrink-0">
                <button
                    type="button"
                    onClick={onChange}
                    className="text-[10px] text-amber-300 hover:text-amber-100 underline"
                    data-testid={`composer-pipe-change-${propName}`}
                >
                    Change
                </button>
                <button
                    type="button"
                    onClick={onStatic}
                    className="text-[10px] text-gray-400 hover:text-gray-200 underline"
                    data-testid={`composer-pipe-revert-${propName}`}
                >
                    Static
                </button>
            </div>
        </div>
    );
}
