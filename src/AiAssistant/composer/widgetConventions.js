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
                    { type: "Heading2", props: { title: "0" } },
                    { type: "Paragraph", props: { text: "unread email" } },
                    { type: "Button", props: { title: "Refresh" } },
                ],
            },
        },
    },
    {
        description:
            "List open GitHub pull requests for a repo with a refresh button",
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
                    { type: "DataList" },
                    { type: "Button", props: { title: "Refresh" } },
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
                ],
            },
        },
    },
];

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
};

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
];
