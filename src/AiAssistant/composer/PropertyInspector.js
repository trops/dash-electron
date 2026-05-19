import React, { useCallback, useMemo, useState } from "react";
import {
    getComponentSchema,
    getInputBinding,
    DASH_REACT_COMPONENT_SCHEMAS,
} from "../dashReactComponentSchemas";
import { WirePicker, WiredSlotSummary, PipedSlotSummary } from "./WirePicker";
import { PROVIDER_API_REGISTRY } from "../providerApiRegistry";
import { getKnownToolArgs } from "./mcpKnownTools";
import { getAllowedVariantsForType } from "./widgetConventions";

/**
 * Return the ordered list of variant component names sharing a base
 * with `componentName` — e.g. `Heading` → ["Heading", "Heading2",
 * "Heading3"]. Base is the name with any trailing digit stripped.
 * Returns an empty list when fewer than 2 variants exist (nothing
 * meaningful to swap between).
 *
 * For component bases that have widget-specific recommendations in
 * `widgetConventions.ALLOWED_VARIANTS` (today: Heading + SubHeading,
 * which need to cross families to surface SubHeading2 as the proper
 * title for a widget), the recommended list takes precedence over
 * the schema's numbered-suffix family. The forbidden raw `Heading`
 * stays out of the picker by construction — the conventions don't
 * include it — so a user staring at a `Heading` cell can only swap
 * to widget-friendly forms.
 */
function listVariants(componentName) {
    if (typeof componentName !== "string") return [];
    const recommended = getAllowedVariantsForType(componentName);
    if (recommended && Array.isArray(recommended.allowed)) {
        const filtered = recommended.allowed.filter((name) =>
            Boolean(DASH_REACT_COMPONENT_SCHEMAS[name])
        );
        return filtered.length >= 2 ? filtered : [];
    }
    const base = componentName.replace(/[0-9]+$/, "");
    if (!base) return [];
    const variants = [];
    if (DASH_REACT_COMPONENT_SCHEMAS[base]) variants.push(base);
    for (let n = 2; n <= 9; n += 1) {
        const name = `${base}${n}`;
        if (DASH_REACT_COMPONENT_SCHEMAS[name]) variants.push(name);
    }
    return variants.length >= 2 ? variants : [];
}

/**
 * Human label for a variant pill. When the conventions provide a
 * semantic label (e.g. SubHeading2 → "Section title") that wins; we
 * fall back to "Original" / "Style N" for the default code path.
 */
function variantLabel(currentType, name, idx) {
    const recommended = getAllowedVariantsForType(currentType);
    if (recommended && recommended.labels && recommended.labels[name]) {
        return recommended.labels[name];
    }
    return idx === 0 ? "Original" : `Style ${idx + 1}`;
}

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
 * Pre-populate args on a freshly-picked wire so the user doesn't
 * fall into the "I wired the method but the call has empty strings"
 * trap. Two heuristics:
 *
 *   - Event-payload arg names (query/value/text/…) on a CALLBACK
 *     wire bind to {kind: "eventArg"} — the typed value flows
 *     straight into the method call.
 *   - Every OTHER arg binds to {kind: "userConfig", field: argName}
 *     — surfaces as an input in the widget's userConfig form (and
 *     in the modal's Test inputs panel) so the user gets a labeled
 *     place to type the value once. Without this default the arg
 *     stays unbound and the IPC fires with literal "" / undefined,
 *     which is what burned us with algolia.searchRules.indexName.
 *
 * The user can still override either binding by clicking
 * literal/userConfig/eventArg in the inspector — these are just
 * sensible defaults, not constraints.
 */
function applyCallbackArgDefaults(spec, isCallbackProp) {
    if (!spec) return spec;
    const args = { ...(spec.args || {}) };
    for (const argName of getMethodArgs(spec)) {
        if (args[argName]) continue;
        const isEventPayload = isCallbackProp && EVENT_ARG_NAMES.has(argName);
        if (isEventPayload) {
            args[argName] = { kind: "eventArg" };
        } else {
            args[argName] = { kind: "userConfig", field: argName };
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
    onChangeType,
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
            <div className="flex items-center justify-between px-3 py-3 border-b border-white/10 shrink-0">
                <div className="text-sm text-gray-300">
                    <span className="text-gray-500">Editing </span>
                    <span className="text-gray-200">{node.type}</span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-sm text-indigo-400 hover:text-indigo-200"
                    data-testid="composer-inspector-close"
                >
                    ← Back to palette
                </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-3">
                <VariantPicker
                    nodeId={node.id}
                    currentType={node.type}
                    onChangeType={onChangeType}
                />
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
                className="w-full flex items-center justify-between px-3 py-3 text-left hover:bg-white/5"
                data-testid={`composer-prop-toggle-${propName}`}
            >
                <span className="flex items-center gap-2 min-w-0">
                    <span className="text-gray-500 text-xs">
                        {expanded ? "▾" : "▸"}
                    </span>
                    <span className="text-sm text-gray-300 font-mono">
                        {propName}
                        {propSchema.required && (
                            <span className="text-red-400 ml-0.5">*</span>
                        )}
                    </span>
                    <span className="text-xs text-gray-500">
                        ({propSchema.type})
                    </span>
                </span>
                <span
                    className={`text-xs truncate ml-2 ${
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
                            <div className="flex items-center gap-0.5 text-xs bg-gray-800 border border-gray-700 rounded p-0.5">
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
            <div className="text-sm px-2 py-1.5 rounded border border-gray-700 bg-gray-900/50 text-gray-500 italic">
                (callback — set this in code, not the composer)
            </div>
        );
    }

    if (type === "ReactNode") {
        return (
            <div className="text-sm px-2 py-1.5 rounded border border-gray-700 bg-gray-900/50 text-gray-500 italic">
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
                className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-indigo-500"
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
            className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-indigo-500"
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
                className="w-full px-3 py-2 text-sm font-mono bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-indigo-500"
                data-testid={`composer-input-${propName}`}
            />
            {error && (
                <div className="text-xs text-red-400 mt-1">
                    JSON parse error: {error}
                </div>
            )}
            <div className="text-xs text-gray-500 mt-0.5">
                JSON — applied when the field loses focus
            </div>
        </div>
    );
}

/**
 * Small segmented control above the prop rows that lets the user
 * swap a component for one of its visual variants (Heading ↔
 * Heading2 ↔ Heading3, Panel ↔ Panel2 ↔ Panel3, etc.).
 *
 * Renders nothing when the component has no siblings (single-form
 * components like Container/DataList/SearchInput don't get a strip).
 * Each pill shows the variant suffix ("Original", "Style 2",
 * "Style 3") instead of the raw type name so the user reads the
 * affordance as a style choice, not a different component.
 *
 * Swap preserves props/wires — variants share the prop signature
 * by construction (they're literally the same React component with
 * different styling in dash-react). See `setCellType` in
 * gridLayout.js for the guarantees enforced on the mutator side.
 */
function VariantPicker({ nodeId, currentType, onChangeType }) {
    const variants = useMemo(() => listVariants(currentType), [currentType]);
    if (variants.length < 2 || typeof onChangeType !== "function") return null;
    return (
        <div
            className="flex items-center gap-2"
            data-testid={`composer-variant-picker-${nodeId}`}
        >
            <span className="text-xs uppercase tracking-wide text-gray-500">
                Style
            </span>
            <div className="flex items-center gap-0.5 text-xs bg-gray-800 border border-gray-700 rounded p-0.5">
                {variants.map((name, idx) => {
                    const label = variantLabel(currentType, name, idx);
                    const isActive = name === currentType;
                    return (
                        <button
                            key={name}
                            type="button"
                            onClick={() =>
                                !isActive && onChangeType(nodeId, name)
                            }
                            className={`px-2 py-0.5 rounded ${
                                isActive
                                    ? "bg-indigo-600/40 text-indigo-100"
                                    : "text-gray-400 hover:text-gray-200"
                            }`}
                            data-testid={`composer-variant-${nodeId}-${name}`}
                            title={name}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
