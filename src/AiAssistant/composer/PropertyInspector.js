import React, { useCallback, useMemo, useState } from "react";
import { getComponentSchema } from "../dashReactComponentSchemas";
import { WirePicker, WiredSlotSummary } from "./WirePicker";

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
    providers = {},
    onChangeProp,
    onSetSlotMode,
    onSetSlotWire,
    onClearSlotWire,
    onSetSlotArg,
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
                {propRows.map(([propName, propSchema]) => (
                    <PropRow
                        key={propName}
                        nodeId={node.id}
                        propName={propName}
                        propSchema={propSchema}
                        isDataSlot={dataSlotSet.has(propName)}
                        staticValue={
                            node.props ? node.props[propName] : undefined
                        }
                        wireSpec={node.wires ? node.wires[propName] : undefined}
                        providers={providers}
                        onChangeProp={onChangeProp}
                        onSetSlotMode={onSetSlotMode}
                        onSetSlotWire={onSetSlotWire}
                        onClearSlotWire={onClearSlotWire}
                        onSetSlotArg={onSetSlotArg}
                    />
                ))}
            </div>
        </div>
    );
}

function PropRow({
    nodeId,
    propName,
    propSchema,
    isDataSlot,
    staticValue,
    wireSpec,
    providers,
    onChangeProp,
    onSetSlotMode,
    onSetSlotWire,
    onClearSlotWire,
    onSetSlotArg,
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
    const mode = isCallbackProp || isWired ? "wire" : "static";
    // Method wires need a method; callback wires don't need a
    // provider instance to be considered "configured" (the install
    // flow surfaces a missing-provider banner downstream).
    const isConfiguredWire = isWired && wireSpec.method;

    return (
        <div data-testid={`composer-prop-row-${propName}`}>
            <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-gray-300 font-mono">
                    {propName}
                    {propSchema.required && (
                        <span className="text-red-400 ml-0.5">*</span>
                    )}
                    <span className="ml-1 text-gray-500">
                        ({propSchema.type})
                    </span>
                </label>
                {isDataSlot && !isCallbackProp && (
                    <div className="flex items-center gap-0.5 text-[10px] bg-gray-800 border border-gray-700 rounded p-0.5">
                        <button
                            type="button"
                            onClick={() =>
                                onSetSlotMode(nodeId, propName, "static")
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
                )}
                {isCallbackProp && (
                    <span className="text-[10px] text-indigo-400">
                        callback
                    </span>
                )}
            </div>
            {mode === "wire" ? (
                isConfiguredWire ? (
                    <WiredSlotSummary
                        propName={propName}
                        wire={wireSpec}
                        onChange={() =>
                            onClearSlotWire && onClearSlotWire(nodeId, propName)
                        }
                        onStatic={() =>
                            onSetSlotMode(nodeId, propName, "static")
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
                    />
                ) : (
                    <WirePicker
                        propName={propName}
                        expectedType={propSchema.type}
                        providers={providers}
                        onPick={(spec) =>
                            onSetSlotWire &&
                            onSetSlotWire(nodeId, propName, spec)
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
