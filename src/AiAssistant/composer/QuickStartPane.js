import React, { useCallback, useState } from "react";
import {
    SCHEMA_COMPONENT_NAMES,
    DASH_REACT_COMPONENT_SCHEMAS,
} from "../dashReactComponentSchemas";
import { sendOneShotJson } from "./llmOneShot";
import { WIDGET_CONVENTIONS } from "./widgetConventions";
import {
    makeEmptyGrid,
    addRow,
    setCellComponent,
    isContainer,
} from "./gridLayout";
import { INTENTS, getSampleLayoutsForIntent } from "./composerSampleLayouts";
import { useWirableTypes } from "./wirableTypes";

// Stable empty-object reference for the providers default. Without
// this, omitting the prop creates a fresh `{}` per render — and
// useWirableTypes' useEffect depends on providers identity, so it
// re-runs on every render → setState → re-render → infinite loop.
// Module-level const keeps the identity stable across all callers.
const EMPTY_PROVIDERS = {};

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
    providers = EMPTY_PROVIDERS,
}) {
    // null = step 1 (pick intent). Set to an intent id ("search", etc)
    // to advance to step 2 (tailored starters + AI prompt).
    const [intent, setIntent] = useState(null);
    // Only meaningful when intent === "provider". Carries the picked
    // provider's wirable-type record ({id, name, kind, description, …})
    // so the AI scaffold can name-drop the provider in its prompt.
    const [providerChoice, setProviderChoice] = useState(null);
    const [aiOpen, setAiOpen] = useState(false);
    const [description, setDescription] = useState("");
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const wirable = useWirableTypes(providers);

    const resetAi = useCallback(() => {
        setAiOpen(false);
        setDescription("");
        setStatus("idle");
        setError(null);
        setSuggestions([]);
    }, []);

    const goBack = useCallback(() => {
        if (intent === "provider" && providerChoice) {
            // From provider-detail → back to provider picker, not all
            // the way to intent picker. One level at a time is more
            // forgiving for accidental picks.
            setProviderChoice(null);
            resetAi();
            return;
        }
        setIntent(null);
        setProviderChoice(null);
        resetAi();
    }, [intent, providerChoice, resetAi]);

    const currentIntent =
        intent && INTENTS.find((i) => i.id === intent) ? intent : null;
    const intentObj = currentIntent
        ? INTENTS.find((i) => i.id === currentIntent)
        : null;
    // Phase C: when the user picked a provider (provider-intent
    // branch), `getSampleLayoutsForIntent` ranks flavored starters
    // first. Passing through is a no-op for non-provider intents
    // since `providerChoice` is null in those branches.
    const intentSamples = currentIntent
        ? getSampleLayoutsForIntent(currentIntent, providerChoice)
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
            const promptArgs = {
                intentHint: intentObj && intentObj.aiHint,
                providerHint: buildProviderHint(providerChoice),
            };
            // Inline the provider context into the user message too.
            // The system prompt is sometimes downweighted by agent
            // backends (Claude Code with MCP), so duplicating the
            // binding directly above the user's words keeps the
            // model anchored on "this widget uses Algolia / Slack /
            // …" instead of asking for clarification.
            const wrappedUserMessage = providerChoice
                ? `[Widget must use the "${providerChoice.name}" provider — ` +
                  `interpret ambiguous terms in that context.]\n\n` +
                  description
                : description;
            let result;
            try {
                result = await sendOneShotJson({
                    model,
                    apiKey,
                    backend,
                    systemPrompt: buildSystemPrompt(promptArgs),
                    userMessage: wrappedUserMessage,
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
                        ...promptArgs,
                        retry: true,
                    }),
                    userMessage: wrappedUserMessage,
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
    }, [description, model, apiKey, backend, intentObj, providerChoice]);

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
            ) : currentIntent === "provider" && !providerChoice ? (
                <ProviderPicker
                    intentObj={intentObj}
                    wirable={wirable}
                    onPick={(p) => {
                        setProviderChoice(p);
                        // Auto-open the AI form on provider pick —
                        // the AI is the whole point of this branch.
                        setAiOpen(true);
                    }}
                    onBack={goBack}
                />
            ) : (
                <IntentDetail
                    intentObj={intentObj}
                    samples={intentSamples}
                    providerChoice={providerChoice}
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

function ProviderPicker({ intentObj, wirable, onPick, onBack }) {
    return (
        <div data-testid="composer-quick-start-providers" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500">
                        Quick start
                    </div>
                    <h2 className="text-base text-gray-100 mt-0.5">
                        {intentObj.icon} Pick a service
                    </h2>
                    <div className="text-xs text-gray-400 mt-0.5">
                        The widget will be scaffolded around this provider's
                        common tools. You'll wire specific methods after.
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
            {wirable.status === "loading" && wirable.types.length === 0 ? (
                <div className="text-sm px-3 py-3 rounded border border-dashed border-gray-700 bg-gray-900/50 text-gray-500">
                    Loading provider catalog…
                </div>
            ) : wirable.types.length === 0 ? (
                <div className="text-sm px-3 py-3 rounded border border-dashed border-gray-700 bg-gray-900/50 text-gray-500">
                    No provider types available.
                    {wirable.error && (
                        <span className="block text-red-400 mt-1">
                            {wirable.error}
                        </span>
                    )}
                </div>
            ) : (
                <div
                    className="rounded border border-gray-700 bg-gray-900/50 p-1 max-h-96 overflow-y-auto"
                    data-testid="composer-quick-start-providers-list"
                >
                    {wirable.types.map((t) => (
                        <button
                            key={`${t.kind}:${t.id}`}
                            type="button"
                            onClick={() => onPick(t)}
                            className="block w-full text-left text-sm px-2 py-1.5 rounded hover:bg-indigo-700/30 text-gray-300 hover:text-indigo-200"
                            data-testid={`composer-quick-start-provider-${t.id}-${t.kind}`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="truncate">{t.name}</span>
                                <span className="text-xs text-gray-500 shrink-0">
                                    {t.kind}
                                    {t.hasConfiguredInstance && (
                                        <span className="ml-1 text-emerald-400">
                                            ✓ configured
                                        </span>
                                    )}
                                </span>
                            </div>
                            {t.description && (
                                <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                    {t.description}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}
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
    providerChoice,
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
    // When the user is in the provider branch and has picked a
    // provider, show that provider in the header instead of the
    // generic intent label/tagline.
    const headerLabel = providerChoice
        ? `${intentObj.icon} ${providerChoice.name}`
        : `${intentObj.icon} ${intentObj.label} widget`;
    const headerTagline = providerChoice
        ? providerChoice.description ||
          `Widget that uses the ${providerChoice.name} provider.`
        : intentObj.tagline;
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
                        {headerLabel}
                    </h2>
                    <div className="text-xs text-gray-400 mt-0.5">
                        {headerTagline}
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

/**
 * Build a one-line hint about the provider the user picked, woven
 * into the AI system prompt so suggestions include the right tools.
 * Returns null when no provider was chosen (the AI prompt falls
 * back to the intent's generic hint).
 */
function buildProviderHint(providerChoice) {
    if (!providerChoice) return null;
    return (
        `The user wants this widget to use the ` +
        `"${providerChoice.name}" provider (${providerChoice.kind}). ` +
        `Suggest 2-3 layouts that surface common ${providerChoice.name} ` +
        `interactions (search / list / detail / compose, whichever fit). ` +
        `The composer wires the actual provider methods in a later ` +
        `stage — DO NOT include data-fetching props; just pick the ` +
        `components a ${providerChoice.name} widget would naturally use.`
    );
}

export function buildSystemPrompt({
    retry = false,
    intentHint = null,
    providerHint = null,
} = {}) {
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
    // PROVIDER CONTEXT (when present) is a stronger constraint than
    // the intent hint — it names a specific service the AI should
    // build around. Emit it first so the model anchors on it.
    const providerLines = providerHint
        ? ["PROVIDER CONTEXT: " + providerHint, ""]
        : [];
    const base = [
        "You are a structured-output API for the Dash widget composer. You do NOT chat.",
        "",
        ...providerLines,
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
        "- DO NOT ask the user for clarification. If the user's description is",
        "  ambiguous, pick the most likely interpretation in the provider /",
        "  intent context above. Suggesting 2-3 alternative layouts already",
        "  covers the disambiguation — the user picks which one matches.",
        "- Provide 2-3 suggestions. Each suggestion has { label: string, root: TreeNode }.",
        "- Each TreeNode: { type: string, props?: object, children?: TreeNode[] }.",
        '- The root TreeNode of every suggestion MUST have type "Panel".',
        `- ONLY use these component types: ${allowed}.`,
        "  This list is exhaustive — do not invent component names or look up others.",
        "- props can include literal string/number/boolean values only — no functions, no JSX expressions, no data-fetching logic.",
        "- Keep each suggestion compact — 3-6 nodes is ideal.",
        "- The composer wires data slots in a later stage. Do NOT include props for `data`, `items`, `options`, or other dataSlot fields.",
        "",
        "FILL IN DESCRIPTIVE PROP VALUES — this is critical. The user picks a",
        "layout and immediately sees the result; without specific labels they",
        "can't tell what each component is FOR. Required for these props:",
        "- Heading.title / Heading2.title / Heading3.title — name the section.",
        '  Example: for an Algolia rules widget, "Index rules" not "Sample".',
        "- SubHeading.title — name the sub-section similarly.",
        "- Button.title / Button2.title / Button3.title — name the action.",
        '  Example: "Add rule", "Refresh", "Search" — verbs that hint at',
        "  what wiring this button would call.",
        "- ButtonIcon.text + ButtonIcon.icon — same as Button.",
        "- Paragraph.text — describe what the user should see in this slot,",
        "  not literal placeholder content.",
        "- Tag.text — short label fitting the widget context.",
        "- InputText.label / TextArea.label / SearchInput.label /",
        "  SelectInput.label / Slider.label — describe the input.",
        '  Example: SearchInput.label="Search by name" for a search-list widget.',
        "- InputText.placeholder / TextArea.placeholder /",
        "  SearchInput.placeholder — short hint text shown in the empty input.",
        "- Switch.label / Toggle.label / Checkbox.label — describe what the",
        "  toggle controls.",
        "- Alert.title + Alert.message — describe the kind of message this",
        "  alert is reserved for in the widget.",
        "These literal values render in the preview AND tell the user what",
        "the layout is intended to do without any extra commentary.",
        "",
        // The user's specific complaint that drove the conventions
        // rewrite: AI was defaulting to raw <Heading> (H1) for the
        // widget's title, which is "like adding H1 to a tweet — its
        // enormous and does not look ok." Conventions live in
        // widgetConventions.js; this interpolation keeps the prompt
        // in sync if the rule changes.
        "HEADING VARIANT RULE — most-violated rule in past outputs:",
        WIDGET_CONVENTIONS.headings.rule,
        `- ALWAYS use ${WIDGET_CONVENTIONS.headings.preferredTitle} for the widget's title.`,
        `- ALWAYS use ${WIDGET_CONVENTIONS.headings.preferredSubsection} for sub-section labels.`,
        `- NEVER use these in widgets: ${WIDGET_CONVENTIONS.headings.forbidden.join(
            ", "
        )}.`,
        `- Only use ${WIDGET_CONVENTIONS.headings.allowedNumericDisplay.join(
            " or "
        )} for numeric display (the big number in a stat widget).`,
        "",
        "REQUIRED VISIBLE STATES — for any widget that fetches data:",
        ...WIDGET_CONVENTIONS.requiredStates.map(
            (s) =>
                `- ${s}: render a clear visible indication, NOT just console.error.`
        ),
        "",
        // Few-shot examples — concrete trees derived from real
        // accepted widgets (see WIDGET_CONVENTIONS.referencedWidgets).
        // Stronger anchor than rules-only; the model sees three
        // different shapes (stat / list / search) it can pattern-
        // match against.
        "FEW-SHOT EXAMPLES — these are reference shapes from real",
        "Dash widgets that have passed the acceptance bar. Match this",
        "level of compactness and prop specificity:",
        "",
        ...WIDGET_CONVENTIONS.fewShotExamples.flatMap((ex, i) => [
            `Example ${i + 1} — ${ex.description}:`,
            "```json",
            JSON.stringify({ suggestions: [ex.tree] }, null, 2),
            "```",
            "",
        ]),
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
