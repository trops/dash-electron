import React, { useCallback, useState } from "react";
import {
    SCHEMA_COMPONENT_NAMES,
    DASH_REACT_COMPONENT_SCHEMAS,
} from "../dashReactComponentSchemas";
import { sendOneShotJson } from "./llmOneShot";
import {
    makeEmptyGrid,
    addRow,
    setCellComponent,
    isContainer,
} from "./gridLayout";
import { INTENTS, getSampleLayoutsForIntent } from "./composerSampleLayouts";

/**
 * QuickStartPane — the composer's empty-state onboarding.
 *
 * Rendered by ComposerPaneV2 when `isGridEmpty(grid)` is true.
 * Two-step intent-first wizard:
 *
 *   Step 1 — pick the widget's purpose: Search / View / Act / Custom.
 *     The four intents cover ~all common widget shapes; the user
 *     answers ONE question instead of scanning a 4-card sample grid
 *     + an AI form + an escape hatch (which the flat list felt like).
 *
 *   Step 2 — show only the starters that match the chosen intent,
 *     plus an AI prompt scoped to that intent (the system prompt
 *     gets the intent's `aiHint` so suggestions match the flavor).
 *     A Back button returns to step 1. The "Start blank" escape
 *     hatch is reachable from both steps.
 *
 * Apply path is unchanged: AI suggestions go through tree→grid
 * conversion; sample layouts call their own `buildGrid()` mutator
 * chain. Either way the final grid is handed to `onApplyGrid`,
 * which fires `onChange`/`onEmit` via ComposerPaneV2's setGrid
 * effect.
 */
export function QuickStartPane({
    onApplyGrid,
    onRequestPalette,
    seedCellId,
    apiKey,
    model,
    backend = "claude-code",
}) {
    // null = step 1 (pick intent). Set to an intent id ("search", etc)
    // to advance to step 2 (tailored starters + AI prompt).
    const [intent, setIntent] = useState(null);
    const [aiOpen, setAiOpen] = useState(false);
    const [description, setDescription] = useState("");
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState(null);
    const [suggestions, setSuggestions] = useState([]);

    const resetAi = useCallback(() => {
        setAiOpen(false);
        setDescription("");
        setStatus("idle");
        setError(null);
        setSuggestions([]);
    }, []);

    const goBack = useCallback(() => {
        setIntent(null);
        resetAi();
    }, [resetAi]);

    const currentIntent =
        intent && INTENTS.find((i) => i.id === intent) ? intent : null;
    const intentObj = currentIntent
        ? INTENTS.find((i) => i.id === currentIntent)
        : null;
    const intentSamples = currentIntent
        ? getSampleLayoutsForIntent(currentIntent)
        : [];

    const submitAi = useCallback(async () => {
        if (description.trim().length === 0) return;
        setStatus("loading");
        setError(null);
        setSuggestions([]);
        try {
            // Retry once with a strict-mode prompt on no-JSON failures
            // (matches the existing SuggestLayoutButton behavior — the
            // common failure mode is a chatty preamble).
            let result;
            try {
                result = await sendOneShotJson({
                    model,
                    apiKey,
                    backend,
                    systemPrompt: buildSystemPrompt({
                        intentHint: intentObj && intentObj.aiHint,
                    }),
                    userMessage: description,
                });
            } catch (firstErr) {
                const isNoJson = /JSON block|parse error/i.test(
                    firstErr?.message || ""
                );
                if (!isNoJson) throw firstErr;
                result = await sendOneShotJson({
                    model,
                    apiKey,
                    backend,
                    systemPrompt: buildSystemPrompt({
                        retry: true,
                        intentHint: intentObj && intentObj.aiHint,
                    }),
                    userMessage: description,
                });
            }
            const items =
                result &&
                Array.isArray(result.suggestions) &&
                result.suggestions
                    .map((s) => sanitizeSuggestion(s))
                    .filter(Boolean);
            if (!items || items.length === 0) {
                throw new Error("Model returned no valid layout suggestions.");
            }
            setSuggestions(items);
            setStatus("ok");
        } catch (err) {
            setError(err.message || String(err));
            setStatus("error");
        }
    }, [description, model, apiKey, backend, intentObj]);

    const pickSuggestion = useCallback(
        (suggestion) => {
            const grid = treeToGrid(suggestion);
            if (!grid) return;
            onApplyGrid(grid);
            resetAi();
        },
        [onApplyGrid, resetAi]
    );

    const applySample = useCallback(
        (layout) => {
            const grid = layout.buildGrid();
            onApplyGrid(grid);
        },
        [onApplyGrid]
    );

    return (
        <div
            className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-4"
            data-testid="composer-quick-start"
        >
            {!currentIntent ? (
                <IntentPicker onPick={setIntent} />
            ) : (
                <IntentDetail
                    intentObj={intentObj}
                    samples={intentSamples}
                    onBack={goBack}
                    onApplySample={applySample}
                    aiOpen={aiOpen}
                    setAiOpen={setAiOpen}
                    description={description}
                    setDescription={setDescription}
                    status={status}
                    error={error}
                    suggestions={suggestions}
                    submitAi={submitAi}
                    pickSuggestion={pickSuggestion}
                    resetAi={resetAi}
                />
            )}

            {/* Escape hatch — drop into the palette on the seed cell.
                Always visible so the user can bail at any step. */}
            <div className="border-t border-white/10 pt-3">
                <button
                    type="button"
                    onClick={() => seedCellId && onRequestPalette(seedCellId)}
                    disabled={!seedCellId}
                    className="w-full px-3 py-3 text-sm rounded border border-dashed border-gray-700 text-gray-400 hover:text-indigo-300 hover:border-indigo-500 disabled:opacity-30"
                    data-testid="composer-quick-start-scratch"
                >
                    Or start blank — pick a single component
                </button>
            </div>
        </div>
    );
}

function IntentPicker({ onPick }) {
    return (
        <div data-testid="composer-quick-start-intents">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                Quick start
            </div>
            <h2 className="text-base text-gray-100 mb-3">
                What kind of widget do you want?
            </h2>
            <div className="grid grid-cols-2 gap-3">
                {INTENTS.map((it) => (
                    <button
                        key={it.id}
                        type="button"
                        onClick={() => onPick(it.id)}
                        className="text-left rounded border border-gray-700 bg-gray-900/50 hover:border-indigo-500 hover:bg-indigo-900/20 p-3 space-y-1"
                        data-testid={`composer-quick-start-intent-${it.id}`}
                    >
                        <div className="text-2xl leading-none">{it.icon}</div>
                        <div className="text-sm text-gray-100">{it.label}</div>
                        <div className="text-xs text-gray-500">
                            {it.tagline}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

function IntentDetail({
    intentObj,
    samples,
    onBack,
    onApplySample,
    aiOpen,
    setAiOpen,
    description,
    setDescription,
    status,
    error,
    suggestions,
    submitAi,
    pickSuggestion,
    resetAi,
}) {
    return (
        <div
            data-testid={`composer-quick-start-detail-${intentObj.id}`}
            className="space-y-4"
        >
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500">
                        Quick start
                    </div>
                    <h2 className="text-base text-gray-100 mt-0.5">
                        {intentObj.icon} {intentObj.label} widget
                    </h2>
                    <div className="text-xs text-gray-400 mt-0.5">
                        {intentObj.tagline}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onBack}
                    className="text-sm text-indigo-400 hover:text-indigo-200 shrink-0"
                    data-testid="composer-quick-start-back"
                >
                    ← Change
                </button>
            </div>

            {samples.length > 0 && (
                <div data-testid="composer-quick-start-samples">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                        Starter layouts
                    </div>
                    <div className="space-y-2">
                        {samples.map((layout) => (
                            <button
                                key={layout.id}
                                type="button"
                                onClick={() => onApplySample(layout)}
                                className="block w-full text-left rounded border border-gray-700 bg-gray-900/50 hover:border-indigo-500 hover:bg-indigo-900/20 p-3 space-y-1"
                                data-testid={`composer-quick-start-sample-${layout.id}`}
                            >
                                <div className="text-sm text-gray-100">
                                    {layout.label}
                                </div>
                                <div className="text-xs text-gray-400">
                                    {layout.description}
                                </div>
                                <div className="text-xs text-gray-500 font-mono whitespace-pre pt-2 border-t border-gray-800">
                                    {layout.outline}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <AiForm
                aiOpen={aiOpen}
                setAiOpen={setAiOpen}
                description={description}
                setDescription={setDescription}
                status={status}
                error={error}
                suggestions={suggestions}
                submitAi={submitAi}
                pickSuggestion={pickSuggestion}
                resetAi={resetAi}
            />
        </div>
    );
}

function AiForm({
    aiOpen,
    setAiOpen,
    description,
    setDescription,
    status,
    error,
    suggestions,
    submitAi,
    pickSuggestion,
    resetAi,
}) {
    return (
        <div
            className="rounded border border-indigo-700/40 bg-indigo-900/10 p-3 space-y-2"
            data-testid="composer-quick-start-ai"
        >
            {!aiOpen ? (
                <button
                    type="button"
                    onClick={() => setAiOpen(true)}
                    className="w-full px-3 py-2 text-sm rounded text-indigo-200 hover:bg-indigo-800/30"
                    data-testid="composer-quick-start-ai-open"
                >
                    ✦ Or describe what you want — scaffold it with AI
                </button>
            ) : (
                <>
                    <div className="flex items-center justify-between">
                        <div className="text-xs uppercase tracking-wide text-indigo-200">
                            Describe the widget
                        </div>
                        <button
                            type="button"
                            onClick={resetAi}
                            className="text-xs text-gray-400 hover:text-gray-200"
                            data-testid="composer-quick-start-ai-close"
                        >
                            Cancel
                        </button>
                    </div>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="e.g., Search Algolia indices, show matching docs in a list"
                        rows={3}
                        className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-indigo-500"
                        data-testid="composer-quick-start-ai-input"
                    />
                    <button
                        type="button"
                        onClick={submitAi}
                        disabled={
                            status === "loading" ||
                            description.trim().length === 0
                        }
                        className="w-full px-3 py-2 text-sm font-medium rounded bg-indigo-700 hover:bg-indigo-600 disabled:bg-gray-700 disabled:text-gray-500 text-white"
                        data-testid="composer-quick-start-ai-submit"
                    >
                        {status === "loading" ? "Asking…" : "Scaffold with AI"}
                    </button>
                    {status === "error" && error && (
                        <div
                            className="text-xs text-red-400"
                            data-testid="composer-quick-start-ai-error"
                        >
                            {error}
                        </div>
                    )}
                    {status === "ok" && suggestions.length > 0 && (
                        <div
                            className="space-y-2"
                            data-testid="composer-quick-start-ai-results"
                        >
                            <div className="text-xs text-gray-400">
                                Pick a suggestion to apply:
                            </div>
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => pickSuggestion(s)}
                                    className="block w-full text-left px-3 py-2 rounded border border-gray-700 bg-gray-900/50 hover:border-indigo-500 hover:bg-indigo-900/30"
                                    data-testid={`composer-quick-start-ai-pick-${i}`}
                                >
                                    <div className="text-sm text-gray-200">
                                        {s.label}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1 font-mono whitespace-pre">
                                        {summarizeTree(s.root)}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

/**
 * Convert the AI's tree-shape suggestion into a grid using the same
 * mutators the user-driven flow uses. Each child of a container node
 * becomes its own row in the container's inner grid (stack-friendly
 * default; users can re-arrange via the variant picker + drag/drop).
 *
 * Children of a non-container node are silently dropped — the schema
 * (via `isContainer`) is the authority on what can hold children.
 * Returns null if `tree.root` isn't a usable container.
 */
export function treeToGrid(tree) {
    if (!tree || !tree.root) return null;
    let g = makeEmptyGrid(
        typeof tree.widgetName === "string" ? tree.widgetName : undefined
    );
    const seedCellId = g.grids[g.rootGridId].rows[0].cells[0];
    g = placeNode(g, seedCellId, tree.root);
    return g;
}

function placeNode(g, cellId, node) {
    if (!node || typeof node.type !== "string") return g;
    g = setCellComponent(g, cellId, node.type, node.props || {});
    const placed = g.cells[cellId];
    if (
        !placed ||
        placed.kind !== "container" ||
        !placed.gridId ||
        !Array.isArray(node.children) ||
        node.children.length === 0
    ) {
        return g;
    }
    const innerGridId = placed.gridId;
    // setCellComponent seeded the inner grid with one row + empty
    // cell. Place the first child there; for the rest, addRow then
    // place into the new row's cell.
    const seedInner = g.grids[innerGridId].rows[0].cells[0];
    g = placeNode(g, seedInner, node.children[0]);
    for (let i = 1; i < node.children.length; i += 1) {
        g = addRow(g, innerGridId);
        const newRow = g.grids[innerGridId].rows[i];
        const newCellId = newRow.cells[0];
        g = placeNode(g, newCellId, node.children[i]);
    }
    return g;
}

function buildSystemPrompt({ retry = false, intentHint = null } = {}) {
    // Filter to palette-visible component names — MenuItem variants
    // are in the schema for import resolution but should not appear
    // in user-facing suggestions.
    const allowed = SCHEMA_COMPONENT_NAMES.filter(
        (name) =>
            !(
                DASH_REACT_COMPONENT_SCHEMAS[name] &&
                DASH_REACT_COMPONENT_SCHEMAS[name].hideFromPalette
            )
    ).join(", ");
    const intentLines = intentHint ? ["INTENT CONTEXT: " + intentHint, ""] : [];
    const base = [
        "You are a structured-output API for the Dash widget composer. You do NOT chat.",
        "",
        ...intentLines,
        "The user describes a widget in one line. You respond with NOTHING but a JSON object of layout candidates.",
        "",
        "OUTPUT FORMAT — emit exactly this and nothing else:",
        "```json",
        "{",
        '  "suggestions": [',
        '    { "label": "<short summary>", "root": { "type": "Panel", "children": [ ... ] } },',
        "    ...",
        "  ]",
        "}",
        "```",
        "",
        "STRICT RULES:",
        '- The first character of your response must be `{` or `` ``` ``. NO preamble, NO confirmation, NO "I\'ll help", NO "Let me first".',
        "- DO NOT call any tools. DO NOT search the web. DO NOT read MCP servers.",
        "  You have all the information you need in this prompt.",
        "- DO NOT look up which providers are available. The composer's wiring",
        "  stage handles provider/data binding after the user picks a layout.",
        "- Provide 2-3 suggestions. Each suggestion has { label: string, root: TreeNode }.",
        "- Each TreeNode: { type: string, props?: object, children?: TreeNode[] }.",
        '- The root TreeNode of every suggestion MUST have type "Panel".',
        `- ONLY use these component types: ${allowed}.`,
        "  This list is exhaustive — do not invent component names or look up others.",
        "- props can include literal string/number/boolean values only — no functions, no JSX expressions, no data-fetching logic.",
        "- Keep each suggestion compact — 3-6 nodes is ideal.",
        "- The composer wires data slots in a later stage. Do NOT include props for `data`, `items`, `options`, or other dataSlot fields.",
    ];
    if (retry) {
        base.push(
            "",
            "PRIOR ATTEMPT FAILED. Your previous response either contained prose",
            "instead of JSON or attempted a tool call. Respond IMMEDIATELY with the",
            "JSON object only — no tool calls, no MCP lookups, no explanatory text",
            "before, between, or after. Start with `{`. The user is blocked until",
            "you produce the JSON."
        );
    }
    return base.join("\n");
}

function sanitizeSuggestion(s) {
    if (!s || typeof s !== "object") return null;
    const label = typeof s.label === "string" ? s.label : "Suggestion";
    const root = sanitizeNode(s.root);
    if (!root || root.type !== "Panel") return null;
    return {
        label,
        widgetName:
            typeof s.widgetName === "string" &&
            /^[A-Za-z][A-Za-z0-9_]*$/.test(s.widgetName)
                ? s.widgetName
                : undefined,
        root,
    };
}

function sanitizeNode(node) {
    if (!node || typeof node !== "object") return null;
    if (typeof node.type !== "string") return null;
    const schema = DASH_REACT_COMPONENT_SCHEMAS[node.type];
    if (!schema || schema.hideFromPalette) return null;
    const out = {
        type: node.type,
        props:
            node.props && typeof node.props === "object"
                ? sanitizeProps(node.props)
                : {},
    };
    if (Array.isArray(node.children) && isContainer(node.type)) {
        out.children = node.children.map(sanitizeNode).filter(Boolean);
    } else {
        out.children = [];
    }
    return out;
}

function sanitizeProps(propsIn) {
    const out = {};
    for (const [k, v] of Object.entries(propsIn)) {
        if (
            typeof v === "string" ||
            typeof v === "number" ||
            typeof v === "boolean"
        ) {
            out[k] = v;
        }
    }
    return out;
}

function summarizeTree(node, depth = 0) {
    if (!node) return "";
    const indent = "  ".repeat(depth);
    const childList = Array.isArray(node.children) ? node.children : [];
    if (childList.length === 0) return `${indent}${node.type}`;
    return [
        `${indent}${node.type}`,
        ...childList.map((c) => summarizeTree(c, depth + 1)),
    ].join("\n");
}
