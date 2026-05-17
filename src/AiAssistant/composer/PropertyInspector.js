import React, { useCallback, useMemo, useState } from "react";
import {
    getComponentSchema,
    getInputBinding,
} from "../dashReactComponentSchemas";
import { WirePicker, WiredSlotSummary, PipedSlotSummary } from "./WirePicker";
import { PROVIDER_API_REGISTRY } from "../providerApiRegistry";
import { getKnownToolArgs } from "./mcpKnownTools";

const CREDENTIAL_AUTO_ARGS = new Set([
    "providerHash",
    "dashboardAppId",
    "providerName",
]);

// Heuristic for "this arg is fed by the event payload" when wiring
// a callback (onChange/onClick/onInput). SearchInput.onChange →
// algolia.search has `query` as the typical event-payload arg, so
// pre-binding it to {kind:"eventArg"} matches user expectation:
// the value the user typed becomes the search query without them
// having to flip the binding mode by hand.
const EVENT_ARG_NAMES = new Set([
    "query",
    "value",
    "text",
    "search",
    "input",
    "term",
]);

function getMethodArgs(wire) {
    if (!wire || !wire.providerType || !wire.method) return [];
    if (wire.providerClass === "mcp") {
        return getKnownToolArgs(wire.providerType, wire.method) || [];
    }
    const reg =
        PROVIDER_API_REGISTRY[wire.providerType] &&
        PROVIDER_API_REGISTRY[wire.providerType][wire.method];
    if (!reg || !Array.isArray(reg.args)) return [];
    return reg.args.filter((a) => !CREDENTIAL_AUTO_ARGS.has(a));
}

/**
 * Pre-populate args on a freshly-picked callback wire so common
 * "event payload" args (query/value/text/…) default to eventArg
 * instead of an unset literal. The user is already in callback
 * context — the only reason they wired the callback at all is to
 * react to the event, so eventArg is the typical binding.
 */
function applyCallbackArgDefaults(spec, isCallbackProp) {
    if (!isCallbackProp || !spec) return spec;
    const args = { ...(spec.args || {}) };
    for (const argName of getMethodArgs(spec)) {
        if (EVENT_ARG_NAMES.has(argName) && !args[argName]) {
            args[argName] = { kind: "eventArg" };
        }
    }
    return { ...spec, args };
}

/**
 * PropertyInspector — Compose-mode Stage 2 surface.
 *
 * Renders one editable row per prop of a selected tree node. The
 * editor for each row is chosen by the schema's declared type:
 *
 *   - string   → text input
 *   - number   → number input
 *   - boolean  → checkbox
 *   - Array<…> → JSON textarea with parse-on-blur
 *   - any      → text input (caller responsible for content)
 *   - function → "(set in code)" read-only — composer never sets
 *                callbacks in C2.
 *
 * Props in the schema's `dataSlots` list get a "static | wire to
 * provider" toggle. Toggling to "wire" stores a skeleton wire entry
 * on the node (`{ provider: null, method: null }`); Stage 3 will
 * fill in the picker result. The static value is preserved across
 * mode flips so the user can experiment without losing data.
 *
 * Wire mode in C2 shows a placeholder "Wired to: (configure in
 * Stage 3)" — clicking it has no effect yet. C3 wires up the
 * provider+method picker modal.
 */
export function PropertyInspector({
    node,
    tree = null,
    providers = {},
    onChangeProp,
    onSetSlotMode,
    onSetSlotWire,
    onClearSlotWire,
    onSetSlotPipe,
    onSetSlotArg,
    onSetSlotFieldMap,
    onClose,
}) {
    // Hooks must run unconditionally — schema-null and node-null
    // short-circuits below the hook calls keep rules-of-hooks happy
    // even when the parent flips between selected/no-selection.
    const schema = node ? getComponentSchema(node.type) : null;
    const dataSlotSet = useMemo(
        () => new Set((schema && schema.dataSlots) || []),
        [schema]
    );

    if (!node) return null;
    if (!schema) {
        return (
            <div className="px-3 py-2 text-xs text-gray-400">
                No schema for component <code>{node.type}</code>.
                <button
                    type="button"
                    onClick={onClose}
                    className="ml-2 text-indigo-400 underline"
                >
                    Back
                </button>
            </div>
        );
    }

    // For input components, the value prop is auto-managed by the
    // emitter (useState backing). The onChange prop is also auto-
    // managed when unwired (binds to the setter). We surface them
    // both in the inspector with a small auto-managed label so the
    // user knows what's happening — they can still wire onChange to
    // a tool, but the value prop has no editable state form because
    // it's controlled by the input itself.
    const inputBinding = node ? getInputBinding(node.type) : null;
    const propRows = Object.entries(schema.props).filter(
        ([name]) => name !== "children"
    );

    return (
        <div
            className="flex flex-col h-full min-h-0"
            data-testid={`composer-inspector-${node.id}`}
        >
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
                <div className="text-xs text-gray-300">
                    <span className="text-gray-500">Editing </span>
                    <span className="text-gray-200">{node.type}</span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-xs text-indigo-400 hover:text-indigo-200"
                    data-testid="composer-inspector-close"
                >
                    ← Back to palette
                </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-3">
                {propRows.length === 0 && (
                    <div className="text-xs text-gray-500">
                        This component has no editable props.
                    </div>
                )}
                {propRows.map(([propName, propSchema]) => {
                    const wireSpec = node.wires
                        ? node.wires[propName]
                        : undefined;
                    // Auto-state covers two cases:
                    //   - inputs: valueProp reads from state, the row
                    //     has no user-editable static value.
                    //   - selection emitters (Menu): changeProp writes
                    //     to state via the auto-allocated setter.
                    //     User can still wire onSelect explicitly to
                    //     override; in that case auto-state is hidden
                    //     and the wire picker shows instead.
                    const isAutoStateProp =
                        inputBinding &&
                        ((inputBinding.valueProp &&
                            inputBinding.valueProp === propName) ||
                            (inputBinding.changeProp === propName &&
                                !wireSpec));
                    return (
                        <PropRow
                            key={propName}
                            nodeId={node.id}
                            propName={propName}
                            propSchema={propSchema}
                            isDataSlot={dataSlotSet.has(propName)}
                            isAutoValueProp={isAutoStateProp}
                            staticValue={
                                node.props ? node.props[propName] : undefined
                            }
                            wireSpec={wireSpec}
                            providers={providers}
                            tree={tree}
                            onChangeProp={onChangeProp}
                            onSetSlotMode={onSetSlotMode}
                            onSetSlotWire={onSetSlotWire}
                            onClearSlotWire={onClearSlotWire}
                            onSetSlotPipe={onSetSlotPipe}
                            onSetSlotArg={onSetSlotArg}
                            onSetSlotFieldMap={onSetSlotFieldMap}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function PropRow({
    nodeId,
    propName,
    propSchema,
    isDataSlot,
    isAutoValueProp,
    staticValue,
    wireSpec,
    providers,
    tree,
    onChangeProp,
    onSetSlotMode,
    onSetSlotWire,
    onClearSlotWire,
    onSetSlotPipe,
    onSetSlotArg,
    onSetSlotFieldMap,
}) {
    // Callback wires (function-typed props like onClick / onChange)
    // can be wired to a tool that fires on the event. They're
    // always in wire mode — there's no useful "static" value for a
    // function in the composer, so we don't render the toggle.
    const isCallbackProp = propSchema && propSchema.type === "function";
    const isWired = Boolean(wireSpec);
    // Callback props auto-enter wire mode the first time the user
    // sees them; the inspector then renders the picker. The mode
    // toggle is suppressed.
    // Data slots default to wire mode — the whole point of a data
    // slot is "this gets its value from a provider/pipe." Static
    // values are the exception (typically a placeholder, like
    // hand-written options array). User can still toggle to static
    // via the segmented control if they want a literal value.
    const mode = isCallbackProp || isWired || isDataSlot ? "wire" : "static";
    // Method wires need a method; callback wires don't need a
    // provider instance to be considered "configured" (the install
    // flow surfaces a missing-provider banner downstream).
    const isConfiguredWire = isWired && wireSpec.method;
    // Pipes are a different "configured" predicate — they don't
    // have a method but they DO have sourceNodeId; show summary in
    // both shapes.
    const isPipe = isWired && wireSpec.kind === "pipe";

    // Each row is an accordion. Default collapsed so the inspector
    // is scannable. Auto-expand only when the row needs attention:
    //   - required static prop with no value typed yet
    //   - wire mode but not configured (user hasn't picked a method)
    // Configured wires, auto-state props, and optional empties stay
    // collapsed; a single-line summary in the header tells the user
    // what's there and one click opens the editor. Without this the
    // SearchInput inspector spills the entire provider list inline
    // before the user has expressed any intent.
    // Auto-state props (input value, Menu.onSelect, …) don't need
    // user attention by default — the composer already handled them
    // with a useState / setter pair. Keep them collapsed; expanding
    // still shows the picker so the user can opt into an explicit
    // wire if they want to override.
    const needsAttention =
        (mode === "static" &&
            propSchema.required &&
            (staticValue === undefined || staticValue === "")) ||
        (mode === "wire" && !isAutoValueProp && !isConfiguredWire && !isPipe);
    const [expanded, setExpanded] = useState(needsAttention);

    const summary = useMemo(() => {
        if (isAutoValueProp) return "auto-state";
        if (mode === "wire") {
            if (isPipe) {
                return `piped from ${wireSpec.sourcePropName}`;
            }
            if (isConfiguredWire) {
                const ref = wireSpec.provider || wireSpec.providerType || "?";
                return `${ref}.${wireSpec.method}`;
            }
            return isCallbackProp
                ? "callback — click to pick a tool"
                : "not wired — click to pick a source";
        }
        if (staticValue === undefined || staticValue === null) return "—";
        if (typeof staticValue === "string") {
            return staticValue === ""
                ? "(empty)"
                : `"${
                      staticValue.length > 30
                          ? staticValue.slice(0, 30) + "…"
                          : staticValue
                  }"`;
        }
        if (typeof staticValue === "object") return "(object)";
        return String(staticValue);
    }, [
        mode,
        isAutoValueProp,
        isConfiguredWire,
        isPipe,
        isCallbackProp,
        wireSpec,
        staticValue,
    ]);

    return (
        <div
            data-testid={`composer-prop-row-${propName}`}
            className="border border-gray-800 rounded"
        >
            <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-left hover:bg-white/5"
                data-testid={`composer-prop-toggle-${propName}`}
            >
                <span className="flex items-center gap-1.5 min-w-0">
                    <span className="text-gray-500 text-[10px]">
                        {expanded ? "▾" : "▸"}
                    </span>
                    <span className="text-[11px] text-gray-300 font-mono">
                        {propName}
                        {propSchema.required && (
                            <span className="text-red-400 ml-0.5">*</span>
                        )}
                    </span>
                    <span className="text-[10px] text-gray-500">
                        ({propSchema.type})
                    </span>
                </span>
                <span
                    className={`text-[10px] truncate ml-2 ${
                        needsAttention
                            ? "text-amber-400"
                            : isConfiguredWire || isPipe
                            ? "text-indigo-300"
                            : isAutoValueProp
                            ? "text-emerald-400"
                            : "text-gray-400"
                    }`}
                    data-testid={`composer-prop-summary-${propName}`}
                >
                    {summary}
                </span>
            </button>
            {expanded && (
                <div className="px-2 pb-2 space-y-1.5">
                    {isDataSlot && !isCallbackProp && (
                        <div className="flex items-center justify-end mb-1">
                            <div className="flex items-center gap-0.5 text-[10px] bg-gray-800 border border-gray-700 rounded p-0.5">
                                <button
                                    type="button"
                                    onClick={() =>
                                        onSetSlotMode(
                                            nodeId,
                                            propName,
                                            "static"
                                        )
                                    }
                                    className={`px-1.5 py-0.5 rounded ${
                                        mode === "static"
                                            ? "bg-indigo-600/30 text-indigo-200"
                                            : "text-gray-500 hover:text-gray-300"
                                    }`}
                                    data-testid={`composer-slot-static-${propName}`}
                                >
                                    static
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        onSetSlotMode(nodeId, propName, "wire")
                                    }
                                    className={`px-1.5 py-0.5 rounded ${
                                        mode === "wire"
                                            ? "bg-indigo-600/30 text-indigo-200"
                                            : "text-gray-500 hover:text-gray-300"
                                    }`}
                                    data-testid={`composer-slot-wire-${propName}`}
                                >
                                    wire
                                </button>
                            </div>
                        </div>
                    )}
                    {mode === "wire" ? (
                        isConfiguredWire ? (
                            wireSpec.kind === "pipe" ? (
                                <PipedSlotSummary
                                    propName={propName}
                                    wire={wireSpec}
                                    tree={tree}
                                    onChange={() =>
                                        onClearSlotWire &&
                                        onClearSlotWire(nodeId, propName)
                                    }
                                    onStatic={() =>
                                        onSetSlotMode(
                                            nodeId,
                                            propName,
                                            "static"
                                        )
                                    }
                                />
                            ) : (
                                <WiredSlotSummary
                                    propName={propName}
                                    wire={wireSpec}
                                    targetType={propSchema.type}
                                    isCallbackWire={isCallbackProp}
                                    onChange={() =>
                                        onClearSlotWire &&
                                        onClearSlotWire(nodeId, propName)
                                    }
                                    onStatic={() =>
                                        onSetSlotMode(
                                            nodeId,
                                            propName,
                                            "static"
                                        )
                                    }
                                    onSetArg={
                                        onSetSlotArg
                                            ? (slotName, argName, binding) =>
                                                  onSetSlotArg(
                                                      nodeId,
                                                      slotName,
                                                      argName,
                                                      binding
                                                  )
                                            : undefined
                                    }
                                    onSetFieldMap={
                                        onSetSlotFieldMap
                                            ? (slotName, fieldMap) =>
                                                  onSetSlotFieldMap(
                                                      nodeId,
                                                      slotName,
                                                      fieldMap
                                                  )
                                            : undefined
                                    }
                                />
                            )
                        ) : (
                            <WirePicker
                                propName={propName}
                                // Callback wires fire on event and don't
                                // care about the method's return shape, so
                                // we drop the type filter. Otherwise the
                                // picker filters by `function` and finds
                                // nothing — no method returns a function.
                                expectedType={
                                    isCallbackProp ? "any" : propSchema.type
                                }
                                providers={providers}
                                tree={tree}
                                // Pipe is only meaningful for data slots
                                // (non-function props). Callbacks always
                                // fire; they're never receivers.
                                allowPipe={!isCallbackProp}
                                onPick={(spec) => {
                                    if (!onSetSlotWire) return;
                                    onSetSlotWire(
                                        nodeId,
                                        propName,
                                        applyCallbackArgDefaults(
                                            spec,
                                            isCallbackProp
                                        )
                                    );
                                }}
                                onPipe={(sourceNodeId, sourcePropName) =>
                                    onSetSlotPipe &&
                                    onSetSlotPipe(
                                        nodeId,
                                        propName,
                                        sourceNodeId,
                                        sourcePropName
                                    )
                                }
                            />
                        )
                    ) : (
                        <StaticValueEditor
                            nodeId={nodeId}
                            propName={propName}
                            propSchema={propSchema}
                            value={staticValue}
                            onChangeProp={onChangeProp}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

function StaticValueEditor({
    nodeId,
    propName,
    propSchema,
    value,
    onChangeProp,
}) {
    const type = propSchema.type;

    if (type === "function") {
        return (
            <div className="text-[11px] px-2 py-1.5 rounded border border-gray-700 bg-gray-900/50 text-gray-500 italic">
                (callback — set this in code, not the composer)
            </div>
        );
    }

    if (type === "ReactNode") {
        return (
            <div className="text-[11px] px-2 py-1.5 rounded border border-gray-700 bg-gray-900/50 text-gray-500 italic">
                (rendered children — nest components in the tree)
            </div>
        );
    }

    if (type === "boolean") {
        return (
            <label className="flex items-center gap-2 text-xs text-gray-300">
                <input
                    type="checkbox"
                    checked={value === true}
                    onChange={(e) =>
                        onChangeProp(nodeId, propName, e.target.checked)
                    }
                    data-testid={`composer-input-${propName}`}
                />
                {value === true ? "true" : "false"}
            </label>
        );
    }

    if (type === "number") {
        return (
            <input
                type="number"
                value={typeof value === "number" ? value : ""}
                onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                        onChangeProp(nodeId, propName, undefined);
                    } else {
                        const n = Number(raw);
                        if (!Number.isNaN(n)) {
                            onChangeProp(nodeId, propName, n);
                        }
                    }
                }}
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-indigo-500"
                data-testid={`composer-input-${propName}`}
            />
        );
    }

    if (type && type.startsWith("Array<")) {
        return (
            <JsonTextarea
                nodeId={nodeId}
                propName={propName}
                value={value}
                onChangeProp={onChangeProp}
            />
        );
    }

    // Strings, "any", and anything else fall through to text input.
    return (
        <input
            type="text"
            value={typeof value === "string" ? value : ""}
            onChange={(e) =>
                onChangeProp(
                    nodeId,
                    propName,
                    e.target.value === "" ? undefined : e.target.value
                )
            }
            className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-indigo-500"
            data-testid={`composer-input-${propName}`}
        />
    );
}

function JsonTextarea({ nodeId, propName, value, onChangeProp }) {
    const initial = useMemo(() => {
        if (value === undefined) return "";
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            return "";
        }
    }, [value]);
    const [draft, setDraft] = useState(initial);
    const [error, setError] = useState(null);

    // Keep the draft in sync if the upstream value changes externally
    // (e.g., reset by clearing the node). useEffect would be cleaner
    // but the controlled-input pattern here is small enough that
    // re-deriving on mount is fine.
    const apply = useCallback(() => {
        if (draft.trim() === "") {
            onChangeProp(nodeId, propName, undefined);
            setError(null);
            return;
        }
        try {
            const parsed = JSON.parse(draft);
            onChangeProp(nodeId, propName, parsed);
            setError(null);
        } catch (err) {
            setError(err.message);
        }
    }, [draft, nodeId, propName, onChangeProp]);

    return (
        <div>
            <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={apply}
                rows={4}
                placeholder="[ ]"
                className="w-full px-2 py-1 text-xs font-mono bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-indigo-500"
                data-testid={`composer-input-${propName}`}
            />
            {error && (
                <div className="text-[10px] text-red-400 mt-1">
                    JSON parse error: {error}
                </div>
            )}
            <div className="text-[10px] text-gray-500 mt-0.5">
                JSON — applied when the field loses focus
            </div>
        </div>
    );
}
