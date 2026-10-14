import React, { useCallback, useState } from "react";
import { SCHEMA_COMPONENT_NAMES } from "../dashReactComponentSchemas";
import { sendOneShotJson } from "./llmOneShot";
import { useBuilderTheme } from "../useBuilderTheme";
import { Button, Button2, Button3, Card2 } from "@trops/dash-react";

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
export function SuggestLayoutButton({
    apiKey,
    model,
    backend = "claude-code",
    onApplyTree,
}) {
    const bt = useBuilderTheme();
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
            // First attempt: standard system prompt. If the model
            // responds with prose instead of JSON (the common
            // failure mode of conversational models), retry once
            // with a stronger "your prior attempt failed" prompt.
            // After the retry, surface the error to the user.
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
                // Only retry on the no-JSON failure mode — bridge
                // errors / timeouts shouldn't double-bill the user.
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
            <Button2
                title="✦ Suggest a starting layout"
                onClick={() => setOpen(true)}
                size="sm"
                block
                className="mb-3"
                testId="composer-suggest-layout-open"
            />
        );
    }

    return (
        <div
            className={`mb-3 rounded-lg border ${bt.border} p-3 flex flex-col gap-3`}
            data-testid="composer-suggest-layout-form"
        >
            <div className="flex items-center justify-between gap-2">
                <h3 className={`text-sm font-semibold ${bt.text}`}>
                    Describe the widget
                </h3>
                <Button3
                    title="Cancel"
                    onClick={reset}
                    size="sm"
                    testId="composer-suggest-layout-close"
                />
            </div>
            <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., An Algolia rules manager with a list of rules and a detail panel"
                rows={3}
                aria-label="Describe the widget"
                className={`dr-input w-full px-3 py-2 text-sm ${bt.surface} border ${bt.border} rounded-lg ${bt.text} resize-none focus:outline-none`}
                data-testid="composer-suggest-layout-input"
            />
            <Button
                title={status === "loading" ? "Asking…" : "Suggest layouts"}
                onClick={submit}
                disabled={
                    status === "loading" || description.trim().length === 0
                }
                block
                testId="composer-suggest-layout-submit"
            />
            {status === "error" && error && (
                <p
                    className={`text-sm ${bt.status.error.icon}`}
                    data-testid="composer-suggest-layout-error"
                >
                    {error}
                </p>
            )}
            {status === "ok" && suggestions.length > 0 && (
                <div
                    className="flex flex-col gap-2"
                    data-testid="composer-suggest-layout-results"
                >
                    <p className={`text-sm ${bt.muted}`}>
                        Pick one to replace the current tree:
                    </p>
                    {suggestions.map((s, i) => (
                        <Card2
                            key={i}
                            onClick={() => pickSuggestion(s)}
                            ariaLabel={s.label}
                            padding="p-3"
                            hover
                            className="flex flex-col gap-1 text-left"
                            testId={`composer-suggest-layout-pick-${i}`}
                        >
                            <span
                                className={`text-sm font-semibold ${bt.text}`}
                            >
                                {s.label}
                            </span>
                            <span
                                className={`text-xs ${bt.muted} font-mono whitespace-pre`}
                            >
                                {summarizeTree(s.root)}
                            </span>
                        </Card2>
                    ))}
                </div>
            )}
        </div>
    );
}

function buildSystemPrompt({ retry = false } = {}) {
    const allowed = SCHEMA_COMPONENT_NAMES.join(", ");
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
        '- The first character of your response must be `{` or `` ``` ``. NO preamble, NO confirmation, NO "I\'ll help".',
        "- Provide 2-3 suggestions. Each suggestion has { label: string, root: TreeNode }.",
        "- Each TreeNode: { type: string, props?: object, children?: TreeNode[] }.",
        '- The root TreeNode of every suggestion MUST have type "Panel".',
        `- ONLY use these component types: ${allowed}.`,
        "- props can include literal string/number/boolean values only — no functions, no JSX expressions, no data-fetching logic.",
        "- Keep each suggestion compact — 3-6 nodes is ideal.",
        "- The composer wires data slots in a later stage. Do NOT include props for `data`, `items`, `options`, or other dataSlot fields.",
    ];
    if (retry) {
        base.push(
            "",
            "PRIOR ATTEMPT FAILED. Your previous response contained prose instead of JSON. Respond with the JSON object only — no explanatory text before, between, or after. Start with `{`."
        );
    }
    return base.join("\n");
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
