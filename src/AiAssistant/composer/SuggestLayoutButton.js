import React, { useCallback, useState } from "react";
import { SCHEMA_COMPONENT_NAMES } from "../dashReactComponentSchemas";
import { sendOneShotJson } from "./llmOneShot";

/**
 * "Suggest a starting layout" button + inline form (slice 20.C5).
 *
 * Renders above the palette when no node is selected. User types a
 * one-line description (e.g., "an Algolia rules manager"); the
 * model returns 2–3 candidate composition trees as JSON; the user
 * picks one to apply. Replaces (not merges with) the current tree.
 *
 * The model is sandboxed via systemPrompt: it only knows the
 * curated component schema names (SCHEMA_COMPONENT_NAMES), it is
 * asked for JSON only, and the response must match a strict shape:
 *
 *   {
 *     "suggestions": [
 *       {
 *         "label": "One-line summary",
 *         "root": { "type": "Panel", "children": [
 *           { "type": "Heading", "props": { "title": "Rules" } },
 *           { "type": "Table" }
 *         ]}
 *       },
 *       ...
 *     ]
 *   }
 *
 * Anything that doesn't parse is rejected with a UI error — no
 * fall-through to free-form code (the chat-mode flow exists for
 * that case).
 */
export function SuggestLayoutButton({ apiKey, model, onApplyTree }) {
    const [open, setOpen] = useState(false);
    const [description, setDescription] = useState("");
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState(null);
    const [suggestions, setSuggestions] = useState([]);

    const reset = useCallback(() => {
        setOpen(false);
        setDescription("");
        setStatus("idle");
        setError(null);
        setSuggestions([]);
    }, []);

    const submit = useCallback(async () => {
        if (description.trim().length === 0) return;
        setStatus("loading");
        setError(null);
        setSuggestions([]);
        try {
            const sys = buildSystemPrompt();
            const result = await sendOneShotJson({
                model,
                apiKey,
                systemPrompt: sys,
                userMessage: description,
            });
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
    }, [description, model, apiKey]);

    const pickSuggestion = useCallback(
        (suggestion) => {
            // The composer's tree shape needs each node to have a
            // stable id. We assign ids here, before handing the tree
            // off — the caller (ComposerPane) installs it as-is.
            let counter = 1;
            const assignIds = (node) => {
                if (!node || typeof node !== "object") return null;
                const out = {
                    id: counter === 1 ? "root" : `node-${counter}`,
                    type: node.type,
                    props:
                        node.props && typeof node.props === "object"
                            ? { ...node.props }
                            : {},
                    children: Array.isArray(node.children)
                        ? node.children
                              .map((c) => {
                                  counter += 1;
                                  return assignIds(c);
                              })
                              .filter(Boolean)
                        : [],
                };
                return out;
            };
            const root = assignIds(suggestion.root);
            if (!root) return;
            onApplyTree({ root, widgetName: suggestion.widgetName });
            reset();
        },
        [onApplyTree, reset]
    );

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="w-full mb-2 px-2 py-1.5 text-xs rounded border border-indigo-700/40 bg-indigo-900/20 text-indigo-200 hover:bg-indigo-800/30"
                data-testid="composer-suggest-layout-open"
            >
                ✦ Suggest a starting layout
            </button>
        );
    }

    return (
        <div
            className="mb-3 rounded border border-indigo-700/40 bg-indigo-900/10 p-2 space-y-2"
            data-testid="composer-suggest-layout-form"
        >
            <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wide text-indigo-200">
                    Describe the widget
                </div>
                <button
                    type="button"
                    onClick={reset}
                    className="text-[10px] text-gray-400 hover:text-gray-200"
                    data-testid="composer-suggest-layout-close"
                >
                    Cancel
                </button>
            </div>
            <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., An Algolia rules manager with a list of rules and a detail panel"
                rows={3}
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-indigo-500"
                data-testid="composer-suggest-layout-input"
            />
            <button
                type="button"
                onClick={submit}
                disabled={
                    status === "loading" || description.trim().length === 0
                }
                className="w-full px-2 py-1 text-xs rounded bg-indigo-700 hover:bg-indigo-600 disabled:bg-gray-700 disabled:text-gray-500 text-white"
                data-testid="composer-suggest-layout-submit"
            >
                {status === "loading" ? "Asking…" : "Suggest layouts"}
            </button>
            {status === "error" && error && (
                <div
                    className="text-[10px] text-red-400"
                    data-testid="composer-suggest-layout-error"
                >
                    {error}
                </div>
            )}
            {status === "ok" && suggestions.length > 0 && (
                <div
                    className="space-y-1"
                    data-testid="composer-suggest-layout-results"
                >
                    <div className="text-[10px] text-gray-400">
                        Pick one to replace the current tree:
                    </div>
                    {suggestions.map((s, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => pickSuggestion(s)}
                            className="block w-full text-left px-2 py-1.5 rounded border border-gray-700 bg-gray-900/50 hover:border-indigo-500 hover:bg-indigo-900/30"
                            data-testid={`composer-suggest-layout-pick-${i}`}
                        >
                            <div className="text-xs text-gray-200">
                                {s.label}
                            </div>
                            <div className="text-[10px] text-gray-500 mt-0.5 font-mono">
                                {summarizeTree(s.root)}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function buildSystemPrompt() {
    const allowed = SCHEMA_COMPONENT_NAMES.join(", ");
    return [
        "You are the layout suggester for the Dash widget composer.",
        "Given a one-line widget description from the user, return 2-3 candidate composition trees as JSON.",
        "",
        "STRICT RULES:",
        '- Respond with a single JSON object: { "suggestions": [ ... ] }.',
        "- Each suggestion: { label: string, root: TreeNode }.",
        "- Each TreeNode: { type: string, props?: object, children?: TreeNode[] }.",
        '- The root TreeNode must always have type "Panel".',
        `- ONLY use these component types: ${allowed}.`,
        "- props can include literal string/number/boolean values only — no functions, no JSX expressions.",
        "- Do not include any data-fetching logic; the composer wires data slots in a separate stage.",
        "- Do NOT wrap the JSON in markdown fences unless you must.",
        "- Keep each suggestion compact — 3-6 nodes is ideal.",
    ].join("\n");
}

/**
 * Defensive sanitization — drop anything we don't recognize so a
 * malformed model response can't blow up the composer.
 */
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
    if (!SCHEMA_COMPONENT_NAMES.includes(node.type)) return null;
    const out = {
        type: node.type,
        props:
            node.props && typeof node.props === "object"
                ? sanitizeProps(node.props)
                : {},
    };
    if (Array.isArray(node.children)) {
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
        // Drop nulls, arrays, objects, functions — the composer's
        // static editor handles those after the user picks.
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
