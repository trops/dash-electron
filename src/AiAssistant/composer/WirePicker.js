import React, { useMemo, useState } from "react";
import {
    Button,
    Button3,
    ButtonIcon3,
    InputText,
    ListRow,
} from "@trops/dash-react";
import { PROVIDER_API_REGISTRY } from "../providerApiRegistry";
import { useMcpTools } from "../mcpToolsQuery";
import { scoreMethodList } from "./wireMatching";
import { useWirableTypes } from "./wirableTypes";
import { getKnownToolsForType, getKnownToolArgs } from "./mcpKnownTools";
import { parseShapeFields } from "./composerEmitter";
import { useBuilderTheme } from "../useBuilderTheme";

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
        pickedType.instanceName ||
        (Array.isArray(pickedType.configuredInstances) &&
        pickedType.configuredInstances.length > 0
            ? pickedType.configuredInstances[0]
            : null);

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
    const bt = useBuilderTheme();
    // Only show the loading-only state when we have nothing to show
    // yet. Credential types arrive synchronously from the registry,
    // so usually the list is non-empty even during the catalog
    // fetch.
    if (wirable.status === "loading" && wirable.types.length === 0) {
        return (
            <p
                className={`text-sm ${bt.muted}`}
                data-testid={`composer-wire-loading-${propName}`}
            >
                Loading provider catalog…
            </p>
        );
    }
    if (wirable.types.length === 0) {
        return (
            <div
                className={`flex flex-col gap-1 text-sm ${bt.muted}`}
                data-testid={`composer-wire-empty-${propName}`}
            >
                No wirable provider types available.
                {wirable.error && (
                    <span className={`${bt.status.error.icon}`}>
                        {wirable.error}
                    </span>
                )}
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-3">
            {pipeSources.length > 0 && onPipe && (
                <div
                    className="flex flex-col gap-2"
                    data-testid={`composer-pipe-sources-${propName}`}
                >
                    <h3 className={`text-sm font-semibold ${bt.text}`}>
                        Reuse an existing wire
                    </h3>
                    {/* Cap at ~3 visible rows with scroll for the
                        rest. Without this a widget with lots of
                        wired callbacks would push the provider list
                        below the fold and dominate the inspector. */}
                    <div className="flex flex-col max-h-40 overflow-y-auto">
                        {pipeSources.map((src) => (
                            <ListRow
                                key={`${src.nodeId}:${src.propName}`}
                                title={src.label}
                                mono
                                onClick={() => onPipe(src.nodeId, src.propName)}
                                testId={`composer-pipe-source-${propName}-${src.nodeId}-${src.propName}`}
                            />
                        ))}
                    </div>
                </div>
            )}
            <div
                className={`flex flex-col gap-2 max-h-96 overflow-y-auto ${
                    pipeSources.length > 0 && onPipe
                        ? `pt-3 border-t ${bt.border}`
                        : ""
                }`}
                data-testid={`composer-wire-providers-${propName}`}
            >
                <h3 className={`text-sm font-semibold ${bt.text}`}>
                    {pipeSources.length > 0 && onPipe
                        ? "Or pick a new provider"
                        : "Pick a provider type"}
                </h3>
                <div className="flex flex-col">
                    {wirable.types.map((t) => (
                        <ListRow
                            key={`${t.kind}:${t.id}:${t.instanceName || ""}`}
                            title={t.name}
                            meta={[
                                t.kind,
                                t.hasConfiguredInstance ? "configured" : null,
                                t.description,
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                            onClick={() => onPick(t)}
                            testId={`composer-wire-provider-${propName}-${
                                t.instanceName || t.id
                            }`}
                        />
                    ))}
                </div>
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
    const bt = useBuilderTheme();
    const ranked = useMemo(() => {
        const registry = PROVIDER_API_REGISTRY[type.id] || {};
        return scoreMethodList(Object.entries(registry), expectedType);
    }, [type.id, expectedType]);

    return (
        <div
            className="flex flex-col gap-2"
            data-testid={`composer-wire-methods-${propName}`}
        >
            <PickerHeader
                title={`Methods on ${type.name}`}
                expectedType={expectedType}
                onBack={onBack}
            />
            {ranked.length === 0 ? (
                <p className={`text-sm ${bt.muted}`}>
                    No methods on this provider return a shape compatible with{" "}
                    <code>{expectedType}</code>.
                </p>
            ) : (
                <div className="flex flex-col">
                    {ranked.map(({ name, spec, score }) => (
                        <ListRow
                            key={name}
                            title={name}
                            mono
                            meta={[
                                spec.returns &&
                                    spec.returns.type &&
                                    truncate(spec.returns.type, 32),
                                score === 1 ? "approximate match" : null,
                                spec.desc,
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                            onClick={() => onPick(name)}
                            testId={`composer-wire-method-${propName}-${name}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// One clickable row per MCP tool (live list or the static catalog).
function ToolRows({ propName, tools, onPick, testId }) {
    return (
        <div className="flex flex-col" data-testid={testId}>
            {tools.map((tool) => (
                <ListRow
                    key={tool.name}
                    title={tool.name}
                    mono
                    meta={tool.description || null}
                    onClick={() => onPick(tool.name)}
                    testId={`composer-wire-method-${propName}-${tool.name}`}
                />
            ))}
        </div>
    );
}

// Free-text tool name + Wire, for tools the picker can't list.
function ToolNameInput({ propName, value, onChange, onPick, placeholder }) {
    return (
        <div className="flex items-center gap-2">
            <InputText
                value={value}
                onChange={(v) => onChange(v)}
                placeholder={placeholder}
                ariaLabel="Tool name"
                className="flex-1 min-w-0"
                inputClassName="font-mono"
                data-testid={`composer-wire-tool-input-${propName}`}
            />
            <Button
                title="Wire"
                onClick={() => {
                    if (value.trim()) onPick(value.trim());
                }}
                disabled={!value.trim()}
                size="sm"
                className="shrink-0"
                testId={`composer-wire-tool-confirm-${propName}`}
            />
        </div>
    );
}

function McpMethodStep({ propName, type, providers, onBack, onPick }) {
    const bt = useBuilderTheme();
    // The MCP listTools bridge only works against a RUNNING server,
    // which requires a configured + started instance. If the user
    // has one, use it; otherwise show a configure-first hint plus
    // a free-text tool-name input so the user can still wire to a
    // tool they know exists by name (the install flow will refuse
    // the install if the tool turns out not to be real).
    const configuredInstance = useMemo(() => {
        // Custom providers carry the picked instance explicitly so tool
        // discovery targets the exact server the user chose (multiple
        // customs commonly share type "custom").
        if (type.instanceName) return type.instanceName;
        for (const [name, p] of Object.entries(providers || {})) {
            if (p?.type === type.id && p?.providerClass === "mcp") {
                return p.serverName || name;
            }
        }
        return null;
    }, [providers, type.id, type.instanceName]);
    // The provider OBJECT (with mcpConfig + credentials) for the chosen
    // instance. Passed to useMcpTools so it can start the server on demand —
    // the widget builder has no workspace, so the provider's MCP server isn't
    // running until we connect it here.
    const configuredProvider = useMemo(() => {
        if (!configuredInstance) return null;
        for (const [name, p] of Object.entries(providers || {})) {
            if (
                p?.providerClass === "mcp" &&
                (p.serverName || name) === configuredInstance
            ) {
                return p;
            }
        }
        return null;
    }, [providers, configuredInstance]);
    const knownTools = useMemo(() => getKnownToolsForType(type.id), [type.id]);
    const [reloadToken, setReloadToken] = useState(0);
    const { status, tools, error } = useMcpTools(
        configuredInstance,
        null,
        configuredProvider,
        reloadToken
    );
    const [freeText, setFreeText] = useState("");

    return (
        <div
            className="flex flex-col gap-2"
            data-testid={`composer-wire-methods-${propName}`}
        >
            <PickerHeader
                title={`Tools on ${type.name}`}
                expectedType="(MCP)"
                onBack={onBack}
            />
            {!configuredInstance && knownTools && (
                <>
                    <p className={`text-xs ${bt.status.warning.icon}`}>
                        Approximate — configure a {type.name} provider in
                        Settings → Providers for the live tool list.
                    </p>
                    <ToolRows
                        propName={propName}
                        tools={knownTools}
                        onPick={onPick}
                        testId={`composer-wire-known-tools-${propName}`}
                    />
                </>
            )}
            {!configuredInstance && !knownTools && (
                <div className={`flex flex-col gap-2 text-sm ${bt.muted}`}>
                    <p>
                        No configured {type.name} provider and no static tool
                        list available. Configure one in Settings → Providers to
                        enumerate, or wire to a known tool name below.
                    </p>
                    <ToolNameInput
                        propName={propName}
                        value={freeText}
                        onChange={setFreeText}
                        onPick={onPick}
                        placeholder="tool name"
                    />
                </div>
            )}
            {configuredInstance && status === "loading" && (
                <p className={`text-sm ${bt.muted}`}>
                    Connecting to {configuredInstance}…
                </p>
            )}
            {configuredInstance && status === "error" && (
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs ${bt.status.warning.icon}`}>
                            Couldn't reach {configuredInstance}
                            {knownTools ? " — showing approximate tools." : "."}
                        </span>
                        <Button3
                            title="Retry"
                            onClick={() => setReloadToken((n) => n + 1)}
                            size="sm"
                            className="shrink-0"
                            testId={`composer-wire-retry-${propName}`}
                        />
                    </div>
                    {error && <p className={`text-xs ${bt.muted}`}>{error}</p>}
                    {knownTools && (
                        <ToolRows
                            propName={propName}
                            tools={knownTools}
                            onPick={onPick}
                            testId={`composer-wire-known-tools-${propName}`}
                        />
                    )}
                    <ToolNameInput
                        propName={propName}
                        value={freeText}
                        onChange={setFreeText}
                        onPick={onPick}
                        placeholder="or type a tool name"
                    />
                </div>
            )}
            {configuredInstance && status === "ok" && tools.length === 0 && (
                <p className={`text-sm ${bt.muted}`}>
                    No tools exposed by this server.
                </p>
            )}
            {configuredInstance && status === "ok" && tools.length > 0 && (
                <ToolRows propName={propName} tools={tools} onPick={onPick} />
            )}
        </div>
    );
}

function PickerHeader({ title, expectedType, onBack }) {
    const bt = useBuilderTheme();
    // Suppress the "→ <type>" hint when the type is the unrestricted
    // sentinel ("any") or "function" — neither is a useful filter
    // hint to surface; the former matches everything and the latter
    // would imply "method returning a function," which is wrong for
    // callback wires that just fire on event.
    const showExpected =
        expectedType && expectedType !== "any" && expectedType !== "function";
    return (
        <div className="flex items-center justify-between gap-2">
            <h3 className={`text-sm font-semibold ${bt.text} min-w-0`}>
                {title}{" "}
                {showExpected && (
                    <span className={`font-normal ${bt.muted}`}>
                        → <code>{expectedType}</code>
                    </span>
                )}
            </h3>
            <Button3
                title="← Back"
                onClick={onBack}
                size="sm"
                className="shrink-0"
                testId="composer-wire-back"
            />
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
    targetType = null,
    isCallbackWire = false,
    onChange,
    onStatic,
    onSetArg,
    onSetFieldMap,
}) {
    const bt = useBuilderTheme();
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
        // Tinted, not framed: it already sits inside the prop row's
        // border, so sections split on hairlines instead of boxes.
        <div
            className={`rounded ${bt.tint} ${bt.accent}`}
            data-testid={`composer-wire-summary-${propName}`}
        >
            <div className="flex items-center justify-between gap-2 text-sm p-3">
                <div className="min-w-0">
                    <span className={`${bt.muted}`}>Wired to: </span>
                    <span className="font-mono">
                        {wire.provider || wire.providerType || "?"}.
                        {wire.method}
                    </span>
                    {!wire.provider && wire.providerType && (
                        <span
                            className={`ml-2 text-xs ${bt.status.warning.icon}`}
                        >
                            (configure a {wire.providerType} provider to run)
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <Button3
                        title="Change"
                        onClick={onChange}
                        size="sm"
                        testId={`composer-wire-change-${propName}`}
                    />
                    <Button3
                        title="Static"
                        onClick={onStatic}
                        size="sm"
                        testId={`composer-wire-revert-${propName}`}
                    />
                </div>
            </div>
            {argNames.length > 0 && onSetArg && (
                <div
                    className={`p-3 border-t ${bt.border} flex flex-col gap-3`}
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
            {!isCallbackWire && onSetFieldMap && (
                <FieldMapEditor
                    propName={propName}
                    wire={wire}
                    targetType={targetType}
                    onSetFieldMap={onSetFieldMap}
                />
            )}
        </div>
    );
}

/**
 * Rendered under WiredSlotSummary for data slots whose target type
 * is shape-typed (e.g. SelectInput.options → Array<{label,value}>).
 * Shows one dropdown per target field, listing the source method's
 * known return fields. The "(auto)" sentinel keeps the emitter's
 * fallback heuristic for that field. Hides itself entirely when
 * either the target isn't shape-typed or the source's return shape
 * isn't documented in the registry (no fields to pick from).
 */
function FieldMapEditor({ propName, wire, targetType, onSetFieldMap }) {
    const bt = useBuilderTheme();
    const targetFields = useMemo(
        () => parseShapeFields(targetType),
        [targetType]
    );
    const sourceFields = useMemo(() => extractSourceItemFields(wire), [wire]);
    if (!targetFields || targetFields.length === 0) return null;
    if (!sourceFields || sourceFields.length === 0) return null;

    const fieldMap = wire.fieldMap || {};
    const handleChange = (target, src) => {
        const next = { ...fieldMap };
        if (!src) delete next[target];
        else next[target] = src;
        onSetFieldMap(propName, Object.keys(next).length ? next : null);
    };

    return (
        <div
            className={`p-3 border-t ${bt.border} flex flex-col gap-2`}
            data-testid={`composer-fieldmap-${propName}`}
        >
            <h3 className={`text-sm font-semibold ${bt.text}`}>
                Map fields from <span className="font-mono">{wire.method}</span>
            </h3>
            {targetFields.map((target) => (
                <div
                    key={target}
                    className="flex items-center justify-between gap-2"
                    data-testid={`composer-fieldmap-row-${propName}-${target}`}
                >
                    <span className={`text-sm font-mono ${bt.accent}`}>
                        {target}
                    </span>
                    {/* Native select: the source field list can run
                        long, past what ChoiceMenu is meant for. */}
                    <select
                        value={fieldMap[target] || ""}
                        onChange={(e) =>
                            handleChange(target, e.target.value || null)
                        }
                        aria-label={`Source field for ${target}`}
                        className={`dr-input text-sm ${bt.surface} border ${bt.border} rounded px-2 py-1 ${bt.text} focus:outline-none`}
                        data-testid={`composer-fieldmap-select-${propName}-${target}`}
                    >
                        <option value="">(auto)</option>
                        {sourceFields.map((f) => (
                            <option key={f} value={f}>
                                {f}
                            </option>
                        ))}
                    </select>
                </div>
            ))}
        </div>
    );
}

/**
 * Pull the per-item field names out of a wire's known return shape.
 * Handles the two patterns we currently see in the registry:
 *   - returns.sampleShape is an Array → item lives at [0]
 *   - returns.sampleShape is `{hits: [...]}` (algolia.search style)
 *     → item lives at .hits[0]
 * Returns null when the wire's provider/method has no documented
 * return shape (MCP tools, custom methods, etc.). Caller hides the
 * field-map UI in that case.
 */
function extractSourceItemFields(wire) {
    if (!wire || wire.providerClass !== "credential") return null;
    const reg =
        PROVIDER_API_REGISTRY[wire.providerType] &&
        PROVIDER_API_REGISTRY[wire.providerType][wire.method];
    const shape = reg?.returns?.sampleShape;
    if (!shape) return null;
    let item = null;
    if (Array.isArray(shape)) {
        item = shape[0];
    } else if (shape && Array.isArray(shape.hits)) {
        item = shape.hits[0];
    }
    if (!item || typeof item !== "object") return null;
    return Object.keys(item);
}

function ArgRow({ propName, argName, binding, isCallbackWire, onSetArg }) {
    const bt = useBuilderTheme();
    const kind = (binding && binding.kind) || "literal";

    return (
        <div
            data-testid={`composer-arg-row-${propName}-${argName}`}
            className="flex flex-col gap-2"
        >
            <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-mono ${bt.accent}`}>
                    {argName}
                </span>
                {/* Binding-kind pills. Icon toggles rather than
                    SegmentedControl so each option keeps its own test
                    id (the e2e specs click them). */}
                <div
                    className="flex items-center gap-1"
                    role="group"
                    aria-label={`${argName} binding`}
                >
                    <ButtonIcon3
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
                        selected={kind === "literal"}
                        ariaPressed={kind === "literal"}
                        size="sm"
                        testId={`composer-arg-kind-literal-${propName}-${argName}`}
                    >
                        literal
                    </ButtonIcon3>
                    <ButtonIcon3
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
                        selected={kind === "userConfig"}
                        ariaPressed={kind === "userConfig"}
                        size="sm"
                        testId={`composer-arg-kind-userConfig-${propName}-${argName}`}
                    >
                        userConfig
                    </ButtonIcon3>
                    {isCallbackWire && (
                        <ButtonIcon3
                            onClick={() =>
                                onSetArg(propName, argName, {
                                    kind: "eventArg",
                                })
                            }
                            selected={kind === "eventArg"}
                            ariaPressed={kind === "eventArg"}
                            size="sm"
                            testId={`composer-arg-kind-eventArg-${propName}-${argName}`}
                        >
                            event
                        </ButtonIcon3>
                    )}
                </div>
            </div>
            {kind === "literal" ? (
                <InputText
                    value={
                        binding && binding.kind === "literal"
                            ? typeof binding.value === "string"
                                ? binding.value
                                : JSON.stringify(binding.value)
                            : ""
                    }
                    onChange={(raw) => {
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
                    ariaLabel={`${argName} value`}
                    inputClassName="font-mono"
                    data-testid={`composer-arg-literal-input-${propName}-${argName}`}
                    placeholder='"" / 0 / [...] / true'
                />
            ) : kind === "eventArg" ? (
                <p
                    className={`text-sm font-mono ${bt.accent}`}
                    data-testid={`composer-arg-eventarg-display-${propName}-${argName}`}
                >
                    eventArg{" "}
                    <span className={`font-sans ${bt.muted}`}>
                        (= the event handler's first arg)
                    </span>
                </p>
            ) : (
                <InputText
                    value={
                        binding && binding.kind === "userConfig"
                            ? binding.field || ""
                            : ""
                    }
                    onChange={(v) =>
                        onSetArg(propName, argName, {
                            kind: "userConfig",
                            field: v,
                        })
                    }
                    ariaLabel={`${argName} userConfig field`}
                    inputClassName="font-mono"
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
    const bt = useBuilderTheme();
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
            className={`flex items-center justify-between gap-2 text-sm p-3 rounded ${bt.status.warning.bg} ${bt.status.warning.text}`}
            data-testid={`composer-pipe-summary-${propName}`}
        >
            <div className="min-w-0">
                <span>Piped from: </span>
                <span className="font-mono">{sourceLabel}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                <Button3
                    title="Change"
                    onClick={onChange}
                    size="sm"
                    testId={`composer-pipe-change-${propName}`}
                />
                <Button3
                    title="Static"
                    onClick={onStatic}
                    size="sm"
                    testId={`composer-pipe-revert-${propName}`}
                />
            </div>
        </div>
    );
}
