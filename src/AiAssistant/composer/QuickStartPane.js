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
import { SAMPLE_LAYOUTS } from "./composerSampleLayouts";

/**
 * QuickStartPane — the composer's empty-state onboarding.
 *
 * Rendered by ComposerPaneV2 when `isGridEmpty(grid)` is true.
 * Replaces the bare GridEditor + palette with two onramps:
 *
 *   1. AI quick-start — user types a one-line widget description;
 *      a single-shot LLM call returns 2-3 candidate layouts; user
 *      picks one and the composer drops the corresponding grid in.
 *   2. Sample layouts — a curated gallery of starter grids
 *      (Search & list, Two-column split, etc.) the user can apply
 *      without writing a prompt.
 *
 * Either path produces a grid handed to `onApplyGrid`. There's no
 * dismissal state — the pane naturally hides as soon as the grid is
 * no longer empty (a sample apply, an AI pick, or the "start from
 * scratch" escape hatch that opens the palette on the seed cell).
 *
 * AI output format reuses the tree-shape contract from
 * SuggestLayoutButton (well-tested prompt; smaller surface than the
 * full grid shape). We convert tree → grid below via the same
 * mutators the user-driven flow uses, so the produced grid passes
 * every invariant the editor expects.
 */
export function QuickStartPane({
    onApplyGrid,
    onRequestPalette,
    seedCellId,
    apiKey,
    model,
    backend = "claude-code",
}) {
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
                    systemPrompt: buildSystemPrompt(),
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
                    systemPrompt: buildSystemPrompt({ retry: true }),
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
    }, [description, model, apiKey, backend]);

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
            className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-4"
            data-testid="composer-quick-start"
        >
            <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                    Quick start
                </div>
                <p className="text-[11px] text-gray-400">
                    Describe what you want to build, or pick a sample layout to
                    start from. Refine the result by clicking components and
                    wiring their data slots.
                </p>
            </div>

            {/* AI form */}
            <div
                className="rounded border border-indigo-700/40 bg-indigo-900/10 p-2 space-y-2"
                data-testid="composer-quick-start-ai"
            >
                {!aiOpen ? (
                    <button
                        type="button"
                        onClick={() => setAiOpen(true)}
                        className="w-full px-2 py-1.5 text-xs rounded text-indigo-200 hover:bg-indigo-800/30"
                        data-testid="composer-quick-start-ai-open"
                    >
                        ✦ Describe your widget — scaffold it with AI
                    </button>
                ) : (
                    <>
                        <div className="flex items-center justify-between">
                            <div className="text-[11px] uppercase tracking-wide text-indigo-200">
                                Describe the widget
                            </div>
                            <button
                                type="button"
                                onClick={resetAi}
                                className="text-[10px] text-gray-400 hover:text-gray-200"
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
                            className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-indigo-500"
                            data-testid="composer-quick-start-ai-input"
                        />
                        <button
                            type="button"
                            onClick={submitAi}
                            disabled={
                                status === "loading" ||
                                description.trim().length === 0
                            }
                            className="w-full px-2 py-1 text-xs rounded bg-indigo-700 hover:bg-indigo-600 disabled:bg-gray-700 disabled:text-gray-500 text-white"
                            data-testid="composer-quick-start-ai-submit"
                        >
                            {status === "loading"
                                ? "Asking…"
                                : "Scaffold with AI"}
                        </button>
                        {status === "error" && error && (
                            <div
                                className="text-[10px] text-red-400"
                                data-testid="composer-quick-start-ai-error"
                            >
                                {error}
                            </div>
                        )}
                        {status === "ok" && suggestions.length > 0 && (
                            <div
                                className="space-y-1"
                                data-testid="composer-quick-start-ai-results"
                            >
                                <div className="text-[10px] text-gray-400">
                                    Pick a suggestion to apply:
                                </div>
                                {suggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => pickSuggestion(s)}
                                        className="block w-full text-left px-2 py-1.5 rounded border border-gray-700 bg-gray-900/50 hover:border-indigo-500 hover:bg-indigo-900/30"
                                        data-testid={`composer-quick-start-ai-pick-${i}`}
                                    >
                                        <div className="text-xs text-gray-200">
                                            {s.label}
                                        </div>
                                        <div className="text-[10px] text-gray-500 mt-0.5 font-mono whitespace-pre">
                                            {summarizeTree(s.root)}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Sample layouts gallery */}
            <div data-testid="composer-quick-start-samples">
                <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">
                    Or pick a sample layout
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {SAMPLE_LAYOUTS.map((layout) => (
                        <button
                            key={layout.id}
                            type="button"
                            onClick={() => applySample(layout)}
                            className="text-left rounded border border-gray-700 bg-gray-900/50 hover:border-indigo-500 hover:bg-indigo-900/20 p-2 space-y-1"
                            data-testid={`composer-quick-start-sample-${layout.id}`}
                        >
                            <div className="text-xs text-gray-200">
                                {layout.label}
                            </div>
                            <div className="text-[10px] text-gray-500">
                                {layout.description}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono whitespace-pre pt-1 border-t border-gray-800">
                                {layout.outline}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Escape hatch — drop into the palette on the seed cell. */}
            <div className="border-t border-white/10 pt-3">
                <button
                    type="button"
                    onClick={() => seedCellId && onRequestPalette(seedCellId)}
                    disabled={!seedCellId}
                    className="w-full px-2 py-1.5 text-xs rounded border border-dashed border-gray-700 text-gray-400 hover:text-indigo-300 hover:border-indigo-500 disabled:opacity-30"
                    data-testid="composer-quick-start-scratch"
                >
                    Or start from scratch — pick a single component
                </button>
            </div>
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

function buildSystemPrompt({ retry = false } = {}) {
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
    const base = [
        "You are a structured-output API for the Dash widget composer. You do NOT chat.",
        "",
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
