/**
 * widgetConventions.js — single source of truth for "what a good Dash
 * widget looks like."
 *
 * Distilled from the hand-authored sample widgets in `src/SampleWidgets/`
 * and the curated set in `scripts/publishKitchenSink.js`. Used by:
 *
 *   - Claude (the AI authoring widgets in Phase B of the loop): the
 *     ACCEPTANCE_CHECKLIST is the self-scoring rubric before handing
 *     work back to the user.
 *   - The composer's AI scaffold prompt (Phase C): WIDGET_CONVENTIONS
 *     gets interpolated into `buildSystemPrompt` so the model has
 *     concrete, verifiable rules instead of vague "look nice" guidance.
 *   - The starter-layout authors (Phase C): every starter's buildGrid
 *     mutator picks variants and spacing classes consistent with these
 *     conventions.
 *   - The emitter guardrails (Phase C): downgrade obvious mistakes
 *     (`Heading` in a sub-cell → `Heading2`) by reading the rule here.
 *
 * Living in JS — not Markdown — so tests can assert the shape and the
 * prompt builder can string-interpolate fields directly.
 *
 * `fewShotExamples` is intentionally empty at Phase A. It gets filled
 * in Phase C once we have 5+ accepted MY-authored widgets to distill
 * from. Leaving it as [] now keeps the contract stable for consumers
 * that will iterate over it later.
 */

/**
 * The single rule that the dash-electron *chrome* (sidebar, modals,
 * settings, popovers) follows but widgets currently break from the
 * inside out: every UI element comes from a `@trops/dash-react`
 * primitive whose color is delivered via `ThemeContext`. The chrome's
 * cohesion is a direct consequence of this rule — theme switches
 * propagate because color is never embedded at the call site.
 *
 * Widgets today ship with hand-rolled `bg-purple-600` brand buttons,
 * `bg-green-900/50 text-green-400` status pills, and `bg-red-900/30`
 * error boxes. The colors don't theme, each widget reinvents its own,
 * and the result is a visual rift between chrome and content. This
 * rule is the closing of that gap.
 *
 * Consumed by:
 *   - the AI scaffold prompt (Phase 4) — interpolated verbatim as
 *     the "NEVER emit Tailwind color utilities" instruction
 *   - the build-mode prompt (Phase 4) — same
 *   - the dash-widget-builder skill (Phase 4) — quoted in the
 *     Color Rule callout
 *   - the acceptance scorecard (Phase 5) — static-analysis regex
 *
 * Theme-neutral utilities (spacing, sizing, flex/grid, opacity-N
 * where N is a number, animations) remain allowed; the rule only
 * bans `bg-{color}-{shade}` / `text-{color}-{shade}` / `border-…`
 * class fragments that embed a color decision.
 */
export const COLOR_RULE =
    "No widget code may use Tailwind color utility classes " +
    "(bg-{color}-{shade}, text-{color}-{shade}, border-{color}-{shade}, " +
    "hover:bg-…, hover:text-…). All color must be delivered by a " +
    "@trops/dash-react primitive that reads ThemeContext (Button, " +
    "Button2, Card, Panel, StatusBadge, EmptyState, Alert, Tag, etc.). " +
    "Theme-neutral utilities (spacing, sizing, flex/grid, opacity-N, " +
    "transitions, animations) remain allowed.";

/**
 * Use-case → primitive lookup. The AI prompt cites this verbatim so
 * the model knows which `@trops/dash-react` import to reach for in
 * each pattern instead of guessing or inventing styling.
 *
 * `forbidden` lists the patterns the AI MUST NOT emit (raw `<button>`
 * tags etc.); the emitter guardrails (Phase 2 Step 2.2) reject these
 * at emit time as a second line of defense.
 *
 * The chrome already uses these primitives everywhere — every entry
 * here is "the primitive the chrome reaches for in the equivalent
 * situation," not a widget-specific invention.
 */
export const PRIMITIVE_CONVENTIONS = {
    button: {
        primitives: ["Button", "Button2", "Button3"],
        defaultChoice: "Button2",
        rule:
            "Every clickable action uses a dash-react Button variant. " +
            "Button2 is the chrome-default secondary; Button is the " +
            "primary CTA; Button3 is tertiary/dismissive. NEVER emit " +
            'raw <button className="..."> tags.',
        forbidden: ["<button"],
    },
    statusOrBadge: {
        primitives: ["StatusBadge", "Tag", "Tag2", "Tag3"],
        defaultChoice: "StatusBadge",
        rule:
            "Status indicators (open/closed/pending/error/success/warning) " +
            "use StatusBadge with a state prop. Generic category labels " +
            "use Tag. NEVER hand-roll `bg-green-900/50 text-green-400` " +
            "pills.",
        forbidden: ["bg-green-9", "bg-red-9", "bg-yellow-9", "bg-amber-9"],
    },
    errorRegion: {
        primitives: ["Alert", "Alert2"],
        defaultChoice: "Alert2",
        rule:
            "Visible error regions (the in-widget banner shown when a " +
            "provider call fails) use Alert/Alert2 with a title + " +
            'message. NEVER hand-roll `<div className="bg-red-900/30 ' +
            'border-red-700 text-red-300">`.',
        forbidden: ["bg-red-9"],
    },
    emptyState: {
        primitives: ["EmptyState"],
        defaultChoice: "EmptyState",
        rule:
            'When the result set is zero, render <EmptyState title="…" ' +
            'description="…" />. NEVER render bare italic strings like ' +
            '`<p className="text-gray-600 italic">No results</p>`.',
        forbidden: ['italic"', "italic\\s"],
    },
    loadingState: {
        primitives: ["Skeleton", "Skeleton.Text", "Skeleton.Card"],
        defaultChoice: "Skeleton.Text",
        rule:
            "While data is in flight, render <Skeleton.Text lines={N} /> " +
            'for list shapes or <Skeleton width="…" height="…" /> ' +
            "for ad-hoc loading affordances. NEVER render `Loading…` " +
            "plaintext.",
        forbidden: [],
    },
    statTile: {
        primitives: ["StatCard"],
        defaultChoice: "StatCard",
        rule:
            "Single-number widgets (unread count, file count, etc.) use " +
            "<StatCard label value change trend />. NEVER manually compose " +
            "a Heading2 + Paragraph + Button layout for stat tiles.",
        forbidden: [],
    },
};

/**
 * Component variant guidance. The user's specific complaint that
 * triggered this whole effort: AI defaults to raw `<Heading>` (H1
 * size), which is correct on a full page but visually catastrophic
 * inside a widget cell — "like adding H1 to a tweet". Every
 * hand-authored sample widget uses SubHeading2 or SubHeading3 instead.
 *
 * `forbidden` is enforced both as a prompt rule and as an emitter
 * downgrade (Heading in a non-top cell → Heading2). Users who
 * genuinely want H1 can pick it via the variant picker — the rule
 * only blocks the default path.
 */
export const HEADING_CONVENTIONS = {
    rule:
        "Inside a widget, use SubHeading2 for the widget's title and " +
        "SubHeading3 for sub-section labels. Raw Heading is H1 — only " +
        "for full pages, never inside a widget cell.",
    forbidden: ["Heading"],
    preferredTitle: "SubHeading2",
    preferredSubsection: "SubHeading3",
    allowedNumericDisplay: ["Heading2", "Heading3"],
};

/**
 * Layout defaults observed across the sample widgets. The root
 * className covers ~all single-widget shells (clock, notepad, github,
 * notion, slack, …) — vertical stack, breathing room between
 * sections, full height, scrollable when content overflows.
 *
 * `sectionGap` is the gap between top-level rows. `inputPadding` is
 * the consistent input-affordance padding across SearchInput / text
 * inputs / textareas.
 */
export const LAYOUT_CONVENTIONS = {
    rootClassName: "flex flex-col gap-4 h-full overflow-y-auto",
    sectionGap: "gap-4",
    multiChildContainerSpacing: "space-y-3",
    inputPadding: "px-3 py-2",
    inputTextSize: "text-sm",
};

/**
 * How widgets talk to providers and other widgets. Captured as
 * patterns (one-liner descriptions) rather than literal code because
 * the right call shape is provider-specific — the AI / author looks at
 * sibling widgets for the literal form.
 */
export const STATE_PATTERNS = {
    mcpProvider:
        "useMcpProvider(type) → destructure { isConnected, callTool, " +
        "error, status } → call callTool, wrap response in the " +
        "package-local parseMcpResponse() utility.",
    credentialProvider:
        "window.mainApi.<provider>.<method>({ providerHash, ... }) — " +
        "the providerHash comes from useWidgetProviders('credential').",
    events:
        "useWidgetEvents() → publishEvent(name, payload) to emit, " +
        "listen({ eventName: handler }) inside a useEffect with a " +
        "useRef-stored handler so re-renders don't tear listeners " +
        "down.",
    autoSave:
        "useEffect-managed timer (clearTimeout in the cleanup) — " +
        "modeled on NotepadWidget.",
};

/**
 * States the widget must visibly handle. "Loading" while the provider
 * call is in flight, "empty" when the result is 0 items, "error"
 * when the call fails. Missing any of these makes the widget feel
 * broken even when nothing is wrong.
 *
 * The acceptance checklist tests each as a separate item so a widget
 * missing one fails its specific check, not a vague "looks unfinished."
 */
export const REQUIRED_STATES = ["loading", "empty", "error"];

/**
 * userConfig conventions for the .dash.js file. Each entry under
 * `userConfig` is a control the dashboard surfaces to the END user
 * configuring an installed widget. Fields must be self-documenting:
 *
 *   - displayName  — the form label shown to the user
 *   - instructions — short hint sentence under the label
 *   - defaultValue — sensible non-empty default where possible
 *
 * Hardcoded values that the user would reasonably want to change at
 * configure-time (channel name, repo, index name, refresh interval)
 * belong in userConfig, never inline in the component.
 */
export const USER_CONFIG_CONVENTIONS = {
    requiredFields: ["displayName", "instructions"],
    recommendedFields: ["defaultValue"],
    hardcodingRule:
        "Anything the END user would reasonably want to change at " +
        "configure-time (channel name, repo, index name, refresh " +
        "interval, max-results) belongs in userConfig, never inline " +
        "in the component.",
};

/**
 * The 8 Phase B widgets — each was reviewed against the
 * ACCEPTANCE_CHECKLIST and merged, so the AI prompt's few-shot
 * examples are derived from real, accepted outputs (not hypothetical
 * "what good looks like" sketches).
 *
 * Paths are repo-relative so the test that pins this list can
 * `fs.existsSync` each one and fail-loud if a referenced file moves
 * or is deleted (a stale few-shot would silently teach the AI a
 * pattern from a widget that no longer exists).
 */
export const REFERENCED_WIDGETS = [
    "src/SampleWidgets/Slack/widgets/SlackListChannels.js",
    "src/SampleWidgets/Slack/widgets/SlackChannelMessages.js",
    "src/SampleWidgets/Algolia/widgets/AlgoliaRulesList.js",
    "src/SampleWidgets/GitHub/widgets/GitHubPRList.js",
    "src/SampleWidgets/Gmail/widgets/GmailUnreadCount.js",
    "src/SampleWidgets/GoogleDrive/widgets/GoogleDriveRecentFiles.js",
    "src/SampleWidgets/Notion/widgets/NotionPageSearch.js",
    "src/SampleWidgets/Filesystem/widgets/FilesystemDirectoryViewer.js",
];

/**
 * Widgets that have been actively migrated to the post-cohesion rubric
 * (no hardcoded Tailwind color utilities, every UI element rendered by
 * a dash-react primitive that reads ThemeContext). The widget-convention
 * lint test scans these for color-Tailwind drift and fails CI if any
 * leak through.
 *
 * Phase 2 ships this empty — REFERENCED_WIDGETS (the Phase B history)
 * still has its hardcoded patterns, and a noisy CI failure on the day
 * the rule lands would be a self-inflicted regression. Phase 3 fills
 * this with the 4 re-authored exemplar widgets (Slack, GitHub, Gmail,
 * Algolia); from that point the lint test enforces the rule for any
 * future PR touching them.
 *
 * Eventual end state: bulk-cleanup pass migrates the remaining sample
 * widgets onto the new primitives, REFERENCED_WIDGETS gets unified into
 * EXEMPLAR_WIDGETS, and the rule applies everywhere.
 */
export const EXEMPLAR_WIDGETS = [
    "src/SampleWidgets/Slack/widgets/SlackListChannels.js",
    "src/SampleWidgets/GitHub/widgets/GitHubPRList.js",
    "src/SampleWidgets/Gmail/widgets/GmailUnreadCount.js",
    "src/SampleWidgets/Algolia/widgets/AlgoliaRulesList.js",
];

/**
 * Few-shot examples for the AI scaffold prompt. Each entry is a
 * `{description, tree}` pair the prompt builder concatenates into a
 * FEW-SHOT EXAMPLES section. Trees match the schema the AI is asked
 * to emit (root.type === "Panel", nested children with type + props),
 * NOT the grid shape — the composer's treeToGrid converts at apply
 * time.
 *
 * Each example was distilled from one of the accepted Phase B
 * widgets, picked to teach a different shape:
 *   - STAT (single big number) — GmailUnreadCount
 *   - LIST + REFRESH — GitHubPRList
 *   - SEARCH-DRIVEN LIST — NotionPageSearch
 *
 * Examples are deliberately compact (3–5 nodes) per the prompt's
 * own "keep each suggestion compact" rule. They also intentionally
 * use SubHeading2 (not raw Heading), descriptive prop values, and
 * NO data-fetching props — exactly what we want the AI to do.
 */
export const FEW_SHOT_EXAMPLES = [
    {
        description: "Show a single big number for my unread email count",
        tree: {
            widgetName: "GmailUnreadCount",
            root: {
                type: "Panel",
                children: [
                    { type: "SubHeading2", props: { title: "Unread Email" } },
                    // StatCard is the chrome-cohesive stat-tile primitive:
                    // label + big value + trend in one themed component.
                    // Preferred over hand-composing Heading2 + Paragraph +
                    // raw color spans (every widget would otherwise reinvent
                    // the stat-card aesthetic).
                    {
                        type: "StatCard",
                        props: {
                            label: "Unread",
                            value: "0",
                            helpText: "in inbox",
                        },
                    },
                    { type: "Button2", props: { title: "Refresh" } },
                ],
            },
        },
    },
    {
        description:
            "List open GitHub pull requests with state badges and a refresh button",
        tree: {
            widgetName: "GitHubPRList",
            root: {
                type: "Panel",
                children: [
                    {
                        type: "SubHeading2",
                        props: { title: "Open Pull Requests" },
                    },
                    {
                        type: "SubHeading3",
                        props: { title: "trops/dash-electron" },
                    },
                    // Each row in the DataList renders a StatusBadge for the
                    // PR state — the composed code (Build mode) uses
                    // <StatusBadge state="open|closed|pending" /> inside the
                    // row template. The tree only carries the data slot;
                    // the per-row composition is the AI's responsibility
                    // when emitting full widget code.
                    { type: "DataList" },
                    { type: "Button2", props: { title: "Refresh" } },
                ],
            },
        },
    },
    {
        description: "Search Notion pages and click one to view it",
        tree: {
            widgetName: "NotionPageSearch",
            root: {
                type: "Panel",
                children: [
                    { type: "SubHeading2", props: { title: "Notion Search" } },
                    {
                        type: "SearchInput",
                        props: {
                            placeholder: "Search pages…",
                            label: "Search by title",
                        },
                    },
                    { type: "DataList" },
                    // When the result set is empty the rendered code wraps
                    // the DataList branch in a conditional that renders an
                    // EmptyState instead — Build mode handles that
                    // composition; the tree just carries the primitives
                    // that participate.
                    {
                        type: "EmptyState",
                        props: {
                            title: "No pages found",
                            description: "Try a different search term.",
                        },
                    },
                ],
            },
        },
    },
];

/**
 * Cross-family variant guidance for the PropertyInspector's variant
 * picker (Phase 5 Step 5.1).
 *
 * Today the picker is driven by the schema's numbered-suffix family
 * (Heading → Heading/Heading2/Heading3). That works for most types
 * but leaks the H1-is-too-big problem: a user staring at a "Heading"
 * cell sees Heading/Heading2/Heading3 as their style options, with
 * no path to the preferred SubHeading2 title. The conventions know
 * the right answer — surfacing it here lets the inspector recommend
 * widget-friendly forms even across families.
 *
 * Per-base entry:
 *   - allowed: ordered list of variant types the picker offers in a
 *     widget context. Roughly best-first.
 *   - labels: optional map from variant → short human label for the
 *     picker pill. Falls back to a "Style N" naming when absent.
 *
 * Bases without an entry use the existing numbered-suffix logic —
 * Tag, Button, Panel, Card, Alert etc. don't need cross-family
 * recommendations, so they stay in the default code path.
 */
export const ALLOWED_VARIANTS = {
    Heading: {
        allowed: ["SubHeading2", "SubHeading3", "Heading2", "Heading3"],
        labels: {
            SubHeading2: "Section title",
            SubHeading3: "Sub-section",
            Heading2: "Stat number",
            Heading3: "Small stat",
        },
    },
    SubHeading: {
        allowed: ["SubHeading2", "SubHeading3", "Heading2", "Heading3"],
        labels: {
            SubHeading2: "Section title",
            SubHeading3: "Sub-section",
            Heading2: "Stat number",
            Heading3: "Small stat",
        },
    },
};

/**
 * Look up the allowed variants for a component name. Returns null
 * when there's no widget-specific recommendation; callers fall back
 * to the schema's numbered-suffix family.
 */
export function getAllowedVariantsForType(type) {
    if (typeof type !== "string") return null;
    // Strip the numeric suffix — Heading2/Heading3/SubHeading2/etc.
    // all share the family entry keyed on the base.
    const base = type.replace(/[0-9]+$/, "");
    return ALLOWED_VARIANTS[base] || null;
}

/**
 * Aggregator. Consumers (the AI prompt builder, the emitter guardrails,
 * tests) import this rather than the individual sub-objects so they
 * stay in sync if anything is added.
 */
export const WIDGET_CONVENTIONS = {
    headings: HEADING_CONVENTIONS,
    layout: LAYOUT_CONVENTIONS,
    statePatterns: STATE_PATTERNS,
    requiredStates: REQUIRED_STATES,
    userConfig: USER_CONFIG_CONVENTIONS,
    fewShotExamples: FEW_SHOT_EXAMPLES,
    referencedWidgets: REFERENCED_WIDGETS,
    colorRule: COLOR_RULE,
    primitives: PRIMITIVE_CONVENTIONS,
    allowedVariants: ALLOWED_VARIANTS,
};

/**
 * Regex matching any Tailwind color-utility fragment that would embed
 * a color decision at the call site (the rule COLOR_RULE bans). Used
 * by:
 *   - the EXEMPLAR_WIDGETS lint test below (CI-blocking once Phase 3
 *     populates the list)
 *   - the Phase 5 acceptance scorecard in WidgetBuilderModal preview
 *
 * Matches: bg-red-500, text-emerald-300, border-amber-700,
 *          hover:bg-blue-600, hover:text-rose-400, etc.
 * Skips:   bg-black, bg-white, text-white, bg-transparent (the safelist
 *          legitimately includes these as theme-neutral primitives),
 *          opacity-N, grid-cols-N, transition-*, flex/grid/spacing utilities.
 */
export const COLOR_TAILWIND_REGEX =
    /(?:hover:)?(?:bg|text|border)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)/;

/**
 * Phase B / Phase C self-scoring rubric. Concrete YES/NO items the
 * author (Claude in Phase B, the AI scaffold output in Phase C, the
 * emitter in any phase) walks before declaring a widget done.
 *
 * Each line is intentionally short so the author can call out
 * specific failures by index rather than re-describing them.
 */
export const ACCEPTANCE_CHECKLIST = [
    "Title uses SubHeading2 (or Heading2/Heading3 for numeric display) — never raw Heading.",
    "Root container uses flex flex-col gap-4 h-full overflow-y-auto (or an equivalent visible-spacing equivalent).",
    "Loading state rendered while data is in flight.",
    "Empty state rendered when the result set is 0.",
    "Error state rendered when the provider call fails (visible to the user, not just console.error).",
    "Provider method called via the standard pattern (useMcpProvider for MCP, window.mainApi.<provider>.<method> for credential).",
    "Provider response wrapped in parseMcpResponse() (or equivalent provider-package utility).",
    "userConfig fields all have displayName + instructions + a sensible defaultValue where applicable.",
    "No hardcoded values that should be userConfig (channel name, repo, index name, refresh interval, max-results).",
    "Compiles via dash-electron build with no warnings (npm run ci exits clean).",
    "Visible padding + gap classes on containers — content not visually fused.",
    "Events published / listened via useWidgetEvents (when the widget participates in cross-widget flow).",
    "No hardcoded Tailwind color utility classes (bg-{color}-{shade}, text-{color}-{shade}, border-{color}-{shade}) in widget code — color comes from @trops/dash-react primitives that read ThemeContext.",
    'Every button is a dash-react Button / Button2 / Button3 — never a raw <button className="..."> tag.',
    "Every status indicator or badge uses StatusBadge (state-based) or Tag (categorical) — never hand-rolled colored spans.",
    "Empty / loading / error states use EmptyState / Skeleton.Text / Alert respectively — never bare italic strings or 'Loading…' plaintext.",
];
