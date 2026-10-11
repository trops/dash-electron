/**
 * widgetBuilderPrompt — the system-prompt builder for the Widget Builder
 * modal's Build mode, extracted from WidgetBuilderModal.js so it can be
 * imported from Node tooling (the prompt-validation runner script)
 * without dragging in the React modal's component tree.
 *
 * Authoritative contract for the prompt the AI sees when generating
 * widgets from chat. Mirrors three branches:
 *
 *   1. "Focused" — user pre-selected a provider via the picker; the
 *      prompt declares the provider and tells the AI to use it.
 *   2. "No-provider" — user explicitly picked "no external provider";
 *      the prompt forbids declaring a providers array.
 *   3. "Legacy" — picker hasn't fired yet (rare); the prompt asks the
 *      AI to confirm what the user wants before writing code.
 *
 * The Dash widget rules — the dash-widget-builder skill's building
 * sections (builderSkill.js) — are appended to every branch when the
 * caller passes the skill text (phase 2e). The skill never reached the AI
 * on its own: Claude Code runs with --disable-slash-commands, the
 * installed app's folder is inside app.asar, and the Anthropic API has no
 * skills.
 *
 * Written as CommonJS so the Node script can `require()` it directly.
 * Webpack's CJS-to-ESM interop lets WidgetBuilderModal.js consume the
 * same module with named imports.
 */

const { builderSkillSections } = require("./builderSkill");

function formatInstalledProvidersForPrompt(providersMap) {
    if (!providersMap || typeof providersMap !== "object") return "(none)";
    const entries = Object.values(providersMap).filter(
        (p) => p && typeof p === "object" && p.type
    );
    if (entries.length === 0) return "(none)";
    return entries
        .map((p) => {
            const cls = p.providerClass || "credential";
            return `- ${p.name} — type: \`${p.type}\`, class: \`${cls}\``;
        })
        .join("\n");
}

// Modal-specific context that prepends every branch of the system
// prompt. The skill is shared with terminal flows where running
// `npm run dev` and `widgetize` is appropriate; in the modal those
// would conflict with the running Dash app or be no-ops. Make the
// no-shell rule explicit so the AI doesn't take the skill's bash
// examples literally.
const MODAL_CONTEXT_PREAMBLE = `## You are inside the running Dash app

You are running inside the Dash Widget Builder modal. The Dash app is ALREADY running — that's where this modal lives. The widget you produce will be installed by the user clicking the **Install** button below this chat; it then registers dynamically and appears in the widget picker. There is nothing for you to spin up, restart, scaffold, or compile.

**Hard rules for this context:**

- Do NOT run shell commands. No \`npm run dev\`, no \`npm run start\`, no \`widgetize\`, no \`ls\`, no \`cat\`, no \`grep\`. The Dash widget rules below come from a guide that also serves people running \`claude\` in a terminal — anything about shells, scaffolding or packaging is for them, NOT for you here. You have all the context you need in this prompt.
- Do NOT scaffold files via Bash or Write. The widget builder writes the files itself when the user clicks Install. Your output is the widget code IN-CHAT (text + code blocks), nothing on disk.
- Do NOT explore the user's filesystem. The Dash widget rules at the end of this prompt are the architectural guidance; the sections before them are the runtime context (which provider was picked, what providers are installed). That's everything.
- Do NOT call any tool — not Skill (the dash-widget-builder skill's rules are already at the end of this prompt), not Bash / Read / Write / Edit / Glob / Grep / Task / WebFetch / WebSearch.

Output format: a short text reply plus two fenced code blocks — \`\`\`jsx with the whole component file (one exported component, e.g. \`export default function MyWidget\`) and \`\`\`javascript with the whole \`.dash.js\` config, which imports the component the way its file exports it (\`export default function MyWidget\` → \`import MyWidget from "./MyWidget";\`) and \`export default\`s the config object with \`type: "widget"\`. The user copies nothing manually — the widget builder parses your code blocks and installs them.

## Cohesion rule (non-negotiable, audit-enforced)

Every UI element comes from a \`@trops/dash-react\` primitive whose color is delivered via ThemeContext. This is the rule the Dash *chrome* (sidebar, modals, settings) follows; widgets currently break it from the inside out, which is the gap this prompt is closing. The "Color Rule" and "Primitive Palette" sections in the Dash widget rules below list the exact primitives — read those before writing code.

- **NEVER** emit className strings containing \`bg-{color}-{shade}\`, \`text-{color}-{shade}\`, \`border-{color}-{shade}\`, or their \`hover:\` variants. (Spacing, sizing, flex/grid, \`opacity-N\`, transitions, and animations remain allowed.)
- **NEVER** emit raw \`<button className="...">\` — use \`Button\` / \`Button2\` / \`Button3\` from \`@trops/dash-react\`.
- **NEVER** hand-roll status pills with \`bg-green-900/50 text-green-400\` — use \`<StatusBadge state="success" label="open" />\`.
- **NEVER** hand-roll error blocks with \`bg-red-900/30 ...\` — use \`<Alert2 title="..." message={errMsg} />\`.
- **NEVER** render bare italic strings like \`<p className="text-gray-600 italic">No results</p>\` — use \`<EmptyState title="..." description="..." />\`.
- **NEVER** render \`Loading…\` plaintext as a loading state — use \`<Skeleton.Text lines={N} />\`.
- **NEVER** hand-compose a stat tile from Heading2 + Paragraph + a colored span — use \`<StatCard label value helpText />\`.

For the canonical shape of a list-with-events widget, the codebase has \`src/SampleWidgets/Slack/widgets/SlackListChannels.js\` (StatusBadge + Menu/MenuItem + Alert2 + EmptyState + Skeleton.Text + Button2) — mirror its structure when in doubt.

`;

/**
 * Build the modal's system prompt. The skill (auto-loaded via cwd)
 * provides every architectural constraint; this function only emits
 * the runtime context the skill can't know statically.
 */
function buildSystemPrompt({
    // eslint-disable-next-line no-unused-vars
    builtInCatalog = [],
    // eslint-disable-next-line no-unused-vars
    knownExternalCatalog = [],
    installedProviders = {},
    selectedProvider = null,
    // When true, omit the "First-response style" instruction that
    // tells the AI to ask a clarifying question before emitting code.
    // The modal sets this false (default) so the chat opens with a
    // brief back-and-forth that gauges intent. The prompt-validation
    // runner sets it true so a single user message produces widget
    // code directly — that's what the runner is measuring.
    skipFirstResponseStyle = false,
    // The dash-widget-builder SKILL.md text (main reads it; the modal
    // passes it). Its building sections are appended as "Dash widget
    // rules". null → no rules section (the skill couldn't be read).
    skillText = null,
} = {}) {
    return withDashWidgetRules(
        buildBranchPrompt({
            installedProviders,
            selectedProvider,
            skipFirstResponseStyle,
        }),
        skillText
    );
}

/** The prompt plus the skill's building sections, when there are any. */
function withDashWidgetRules(prompt, skillText) {
    const rules = builderSkillSections(skillText);
    if (!rules) return prompt;
    return `${prompt}

---

# Dash widget rules

These are the rules for every widget you write here (from the dash-widget-builder skill). They're already loaded — don't try to open the skill.

${rules}`;
}

function buildBranchPrompt({
    installedProviders = {},
    selectedProvider = null,
    skipFirstResponseStyle = false,
} = {}) {
    const hasPicked =
        selectedProvider &&
        (selectedProvider.sentinel === "none" ||
            (selectedProvider.type && selectedProvider.providerClass));
    const isPickedNone = selectedProvider?.sentinel === "none";
    const pickedType = selectedProvider?.type;
    const pickedClass = selectedProvider?.providerClass;

    // Focused branch — user pre-selected a provider via the picker.
    if (hasPicked && !isPickedNone) {
        const firstResponseSection = skipFirstResponseStyle
            ? ""
            : `

## First-response style

If this is your FIRST response in the conversation, do NOT output code. Reply with 1–2 short sentences acknowledging the **${pickedType}**${
                  pickedClass ? ` (${pickedClass})` : ""
              } pick and asking what specific data or actions they want surfaced from ${pickedType}. Keep it under 30 words. No lists, no examples. After their reply, output the widget code in the output format above.`;
        return `${MODAL_CONTEXT_PREAMBLE}You are the Dash Widget Builder. Follow the Dash widget rules at the end of this prompt for ALL architectural guidance — tailwind safelist, dash-react prop names, provider classes, IPC method registry, single-task widget rule, defensive coding rules, event publishing, scheduled tasks, and the install-time permission gate are all there. Don't restate them; follow them.

## Pre-selected provider (from the user's pick)

- Type: \`${pickedType}\`
- Class: \`${pickedClass}\`

The widget config MUST declare:

\`\`\`javascript
providers: [{ type: "${pickedType}", providerClass: "${pickedClass}", required: true }]
\`\`\`

Use the consumption hook for class \`${pickedClass}\` (per "Provider classes: credential vs MCP" in the Dash widget rules). Do NOT pick a different class or type — the user has already configured this provider.

## Other providers the user already has configured

${formatInstalledProvidersForPrompt(installedProviders)}

(Read-only context. Don't switch providers; build for the pre-selected one above.)${firstResponseSection}`;
    }

    // No-provider branch — user explicitly picked "no external provider".
    if (isPickedNone) {
        const firstResponseSection = skipFirstResponseStyle
            ? ""
            : `

## First-response style

If this is your FIRST response, do NOT output code. Reply with 1–2 short sentences asking what they want the widget to do with local-only data or interactions (no provider talk). Keep it under 30 words. No lists, no examples.`;
        return `${MODAL_CONTEXT_PREAMBLE}You are the Dash Widget Builder. Follow the Dash widget rules at the end of this prompt for ALL architectural guidance.

The user has chosen NOT to use any external provider — generate a self-contained widget (clock, counter, static display, etc.) with NO \`providers: [...]\` array in the config.${firstResponseSection}`;
    }

    // Legacy branch — picker hasn't fired yet (rare; the picker gates
    // chat input). Tell the AI to ask the user which provider before
    // writing code.
    const firstResponseSection = skipFirstResponseStyle
        ? ""
        : `

## First-response style

If this is your FIRST response, do NOT output code. Reply with 1–2 short sentences inviting the user to describe the widget they want — what it should show, what data source it pulls from, what interactions it needs. No lists, no examples — keep it under 30 words.`;
    return `${MODAL_CONTEXT_PREAMBLE}You are the Dash Widget Builder. Follow the Dash widget rules at the end of this prompt for ALL architectural guidance.

## Providers the user already has configured

${formatInstalledProvidersForPrompt(
    installedProviders
)}${firstResponseSection}`;
}

module.exports = {
    buildSystemPrompt,
    withDashWidgetRules,
    formatInstalledProvidersForPrompt,
    MODAL_CONTEXT_PREAMBLE,
};
