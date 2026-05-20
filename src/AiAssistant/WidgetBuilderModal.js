/**
 * WidgetBuilderModal
 *
 * Split-pane modal for AI widget building with LIVE PREVIEW.
 * Left: Live widget preview (2/3)
 * Right: ChatCore for conversation (1/3)
 *
 * Flow:
 * 1. User describes widget in chat
 * 2. AI generates code blocks
 * 3. Auto-compiles and shows live preview of the actual widget
 * 4. User can iterate or click "Install" to save to @ai-built/
 */
import React, {
    useState,
    useContext,
    useCallback,
    useEffect,
    useMemo,
    useRef,
} from "react";
import {
    Modal,
    FontAwesomeIcon,
    ThemeContext,
    CodeEditorVS,
} from "@trops/dash-react";
import {
    ChatCore,
    AppContext,
    evaluateBundle,
    extractWidgetConfigs,
    makeScopedComponentId,
} from "@trops/dash-core";
import { WidgetConfigureTab } from "./WidgetConfigureTab";
import { ChatProviderGate } from "./ChatProviderGate";
import { WidgetDraftsList } from "./WidgetDraftsList";
import { WidgetConsolePane } from "./WidgetConsolePane";
import { ComposerPane } from "./composer/ComposerPane";
import { ComposerPaneV2 } from "./composer/ComposerPaneV2";
// Slice 19G.2: installWidgetConsoleCapture is no longer wired into
// production — widgets render in an iframe so host-window capture
// can't see them. The module file stays for its tests + any future
// inline-render surface; we simply don't install it here anymore.
// (Kept as a comment to make the absence intentional.)
import * as transforms from "./widgetCodeTransforms";
import {
    extractProviderDeclarations,
    buildPreviewWidgetData,
} from "./widgetPreviewData";
import { PreviewIframe } from "./PreviewIframe";
import {
    AcceptanceScorecard,
    evaluateScorecard,
    buildScorecardChatMessage,
} from "./composer/AcceptanceScorecard";
import {
    validateProviderApiUsage,
    buildAiCorrectionMessage,
    validateNoModalUsage,
    buildNoModalCorrectionMessage,
    validateComponentReferences,
    buildComponentReferenceCorrectionMessage,
} from "./widgetCodeValidator";
import { scanCredentialMethodCalls } from "./widgetCredentialPermissionScanner";
import { setGrants as setCredentialGrants } from "./widgetCredentialGrants";
import { WidgetCredentialPermissionModal } from "./WidgetCredentialPermissionModal";

// G2 feature flag — when true, Compose mode renders the new
// grid-based composer (recursive grid-of-cells layout with nesting)
// instead of the tree-based ComposerPane. G3 lands the draft
// migrator and removes the tree path entirely.
const USE_COMPOSER_V2 = true;

// Slice 17c — iframe-isolated preview is the only path. The legacy
// localStorage opt-out (`dash:preview-iframe = "0"`) used to flip to
// the inline path; that path is gone now (17c.7) so the helper has
// been removed too. AI-generated widget code runs in an iframe with
// its own React tree, DOM, and JS context — render errors,
// event-handler errors, async rejections, commit-phase failures,
// CSS leaks, and global pollution are kernel-isolated from the host
// React tree.

/**
 * Small picker strip rendered above the live widget preview. For each
 * provider type the widget declares, surfaces the compatible providers
 * the user has configured in the app and lets them pick one. The picker
 * never auto-selects — an explicit choice is required before the widget
 * sees a real provider. This avoids surprising the user by sending
 * traffic from preview to a provider they didn't expect.
 */
function PreviewProviderPicker({
    configCode,
    appProviders,
    selection,
    onChange,
    justChanged,
}) {
    const declarations = React.useMemo(
        () => extractProviderDeclarations(configCode || ""),
        [configCode]
    );

    // Group the user's configured providers by type, matching type only
    // (providerClass is often unset or inconsistent across widget authors,
    // so being strict here would hide valid matches).
    const compatibleByType = React.useMemo(() => {
        const map = {};
        if (!appProviders) return map;
        for (const decl of declarations) {
            map[decl.type] = Object.values(appProviders).filter(
                (p) => p.type === decl.type
            );
        }
        return map;
    }, [declarations, appProviders]);

    if (declarations.length === 0) return null;

    return (
        <div className="px-4 pt-2 pb-3 border-b border-gray-800/60 shrink-0 space-y-2">
            {declarations.map((decl) => {
                const options = compatibleByType[decl.type] || [];
                const current = selection?.[decl.type] || "";
                const label = decl.type.replace(/^./, (c) => c.toUpperCase());
                return (
                    <div
                        key={decl.type}
                        className="flex items-center gap-2 text-xs"
                    >
                        <span className="text-gray-400 shrink-0">
                            {label} provider:
                        </span>
                        {options.length === 0 ? (
                            <button
                                type="button"
                                onClick={() => {
                                    // Cross-modal nav: dash-electron's
                                    // Dash.js listens for this and closes
                                    // the WidgetBuilderModal; dash-core's
                                    // DashboardStage listens for the same
                                    // event and opens Settings →
                                    // Providers in create mode with the
                                    // type pre-selected (catalog detail
                                    // for mcp class, credential form for
                                    // credential class).
                                    try {
                                        window.dispatchEvent(
                                            new CustomEvent(
                                                "dash:open-settings-create-provider",
                                                {
                                                    detail: {
                                                        type: decl.type,
                                                        providerClass:
                                                            decl.providerClass ||
                                                            null,
                                                    },
                                                }
                                            )
                                        );
                                    } catch (err) {
                                        console.warn(
                                            "[PreviewProviderPicker] Failed to dispatch open-settings-create-provider:",
                                            err
                                        );
                                    }
                                }}
                                className="text-[11px] px-2 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-700/40 transition-colors"
                            >
                                + Add new {label} provider
                            </button>
                        ) : (
                            <select
                                value={current}
                                onChange={(e) =>
                                    onChange(
                                        {
                                            ...(selection || {}),
                                            [decl.type]: e.target.value,
                                        },
                                        decl.type,
                                        e.target.value
                                    )
                                }
                                className="flex-1 max-w-xs px-2 py-1 bg-gray-800/70 border border-gray-700/50 rounded text-gray-200 focus:border-indigo-500/50 focus:outline-none"
                                data-testid={`preview-provider-select-${decl.type}`}
                            >
                                <option value="">— Select a provider —</option>
                                {options.map((p) => (
                                    <option key={p.name} value={p.name}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        )}
                        {justChanged?.type === decl.type && (
                            <span
                                className="text-xs text-green-300 flex items-center gap-1"
                                data-testid="provider-just-changed"
                            >
                                <FontAwesomeIcon
                                    icon="check-circle"
                                    className="h-2.5 w-2.5"
                                />
                                Now using {justChanged.name || "(none)"} —
                                preview reloaded
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/**
 * PreviewTestInputsForm
 *
 * Renders one input per userConfig field the AI declared, so the user
 * can fill in test values (e.g. `indexName="airports"`) and watch the
 * previewed widget re-render against real data — without leaving the
 * modal. Decoupled from the parent: parent owns the values state,
 * this component is a controlled view.
 *
 * Field types map to inputs:
 *   - text / number / password / color → <input>
 *   - textarea                         → <textarea>
 *   - boolean                          → <input type="checkbox">
 *   - select (with options[])          → <select>
 *   - anything else                    → falls back to <input>
 *
 * Empty / missing userConfig hides the form entirely (no chrome
 * shown for widgets that don't take inputs).
 */
function PreviewTestInputsForm({
    userConfig,
    defaults,
    values,
    onChange,
    onReset,
}) {
    const fields = userConfig
        ? Object.entries(userConfig).filter(
              ([, spec]) => spec && typeof spec === "object"
          )
        : [];

    // Slice 19D: buffer changes locally and only commit on Apply.
    // Live-as-you-type updates would fire one IPC call per keystroke
    // (e.g., listIndices/searchRules) since widgets typically run a
    // useEffect keyed on the userConfig prop. Per-keystroke API spam
    // is worse than an extra click.
    //
    // The committed snapshot — what's actually applied to the iframe
    // preview — is the parent's `values` prop. Local draft state is
    // independent until the user clicks Apply.
    const valueFor = React.useCallback(
        (fieldName, spec) => {
            if (
                values &&
                Object.prototype.hasOwnProperty.call(values, fieldName)
            ) {
                return values[fieldName];
            }
            if (
                defaults &&
                Object.prototype.hasOwnProperty.call(defaults, fieldName)
            ) {
                return defaults[fieldName];
            }
            if (spec && "defaultValue" in spec) return spec.defaultValue;
            return "";
        },
        [values, defaults]
    );

    // Initialize local draft from currently-effective values.
    const initialDraft = React.useMemo(() => {
        const draft = {};
        for (const [fieldName, spec] of fields) {
            draft[fieldName] = valueFor(fieldName, spec);
        }
        return draft;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userConfig]);

    const [localValues, setLocalValues] = React.useState(initialDraft);

    // Re-sync the local draft whenever the parent commits new values
    // (Apply, Reset, or external swap of userConfig). Non-dirty fields
    // pick up the latest effective value; dirty in-progress edits get
    // overwritten — by design, since the user just confirmed a commit
    // (or reset).
    React.useEffect(() => {
        const next = {};
        for (const [fieldName, spec] of fields) {
            next[fieldName] = valueFor(fieldName, spec);
        }
        setLocalValues(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [values, defaults, userConfig]);

    const appliedSnapshot = React.useMemo(() => {
        const snap = {};
        for (const [fieldName, spec] of fields) {
            snap[fieldName] = valueFor(fieldName, spec);
        }
        return snap;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [values, defaults, userConfig]);

    // All hooks above this line — early return goes BELOW so
    // useMemo / useEffect / useState always run in the same order
    // every render.
    if (fields.length === 0) return null;

    const valuesEqual = (a, b) => {
        const ak = Object.keys(a || {});
        const bk = Object.keys(b || {});
        if (ak.length !== bk.length) return false;
        for (const k of ak) {
            if (a[k] !== b[k]) return false;
        }
        return true;
    };

    const isDirtyLocal = !valuesEqual(localValues, appliedSnapshot);
    const hasAppliedOverrides = values && Object.keys(values).length > 0;

    const setLocal = (fieldName, value) => {
        setLocalValues((prev) => ({ ...prev, [fieldName]: value }));
    };

    const handleApply = () => {
        for (const [fieldName] of fields) {
            const localVal = localValues[fieldName];
            const appliedVal = appliedSnapshot[fieldName];
            if (localVal !== appliedVal) {
                onChange(fieldName, localVal);
            }
        }
    };

    return (
        <div className="px-4 pt-2 pb-3 border-b border-gray-800/60 shrink-0 space-y-2">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wider text-gray-500">
                    Test inputs
                    {isDirtyLocal && (
                        <span className="ml-2 text-amber-400 normal-case tracking-normal">
                            • unapplied changes
                        </span>
                    )}
                </span>
                <div className="flex items-center gap-2">
                    {hasAppliedOverrides && (
                        <button
                            type="button"
                            onClick={onReset}
                            className="text-[10px] text-gray-500 hover:text-gray-300 underline"
                        >
                            Reset to defaults
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleApply}
                        disabled={!isDirtyLocal}
                        data-testid="preview-test-inputs-apply"
                        className={
                            isDirtyLocal
                                ? "text-[11px] px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white"
                                : "text-[11px] px-2 py-1 rounded bg-gray-700/40 text-gray-500 cursor-not-allowed"
                        }
                    >
                        Apply to preview
                    </button>
                </div>
            </div>
            <div className="space-y-1.5">
                {fields.map(([fieldName, spec]) => {
                    const label = spec.displayName || fieldName;
                    const v = localValues[fieldName];
                    const t = spec.type || "text";
                    const common = {
                        value: v == null ? "" : v,
                        onChange: (e) => setLocal(fieldName, e.target.value),
                        className:
                            "flex-1 max-w-md px-2 py-1 bg-gray-800/70 border border-gray-700/50 rounded text-xs text-gray-200 focus:border-indigo-500/50 focus:outline-none",
                        "data-testid": `preview-test-input-${fieldName}`,
                    };
                    let input;
                    if (t === "boolean") {
                        input = (
                            <input
                                type="checkbox"
                                checked={Boolean(v)}
                                onChange={(e) =>
                                    setLocal(fieldName, e.target.checked)
                                }
                                className="w-4 h-4"
                            />
                        );
                    } else if (t === "textarea") {
                        input = <textarea rows={2} {...common} />;
                    } else if (t === "select" && Array.isArray(spec.options)) {
                        input = (
                            <select {...common}>
                                {spec.options.map((opt) => {
                                    const optVal =
                                        typeof opt === "object" && opt !== null
                                            ? opt.value
                                            : opt;
                                    const optLabel =
                                        typeof opt === "object" && opt !== null
                                            ? opt.displayName ||
                                              opt.label ||
                                              opt.value
                                            : opt;
                                    return (
                                        <option key={optVal} value={optVal}>
                                            {optLabel}
                                        </option>
                                    );
                                })}
                            </select>
                        );
                    } else if (t === "number") {
                        input = (
                            <input
                                type="number"
                                value={v == null ? "" : v}
                                onChange={(e) => {
                                    const n = e.target.value;
                                    setLocal(
                                        fieldName,
                                        n === "" ? "" : Number(n)
                                    );
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && isDirtyLocal) {
                                        e.preventDefault();
                                        handleApply();
                                    }
                                }}
                                className={common.className}
                            />
                        );
                    } else {
                        input = (
                            <input
                                type={t === "password" ? "password" : "text"}
                                {...common}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && isDirtyLocal) {
                                        e.preventDefault();
                                        handleApply();
                                    }
                                }}
                            />
                        );
                    }
                    return (
                        <label
                            key={fieldName}
                            className="flex items-center gap-2 text-xs"
                        >
                            <span
                                className="text-gray-400 shrink-0"
                                style={{ minWidth: "8rem" }}
                            >
                                {label}:
                            </span>
                            {input}
                        </label>
                    );
                })}
            </div>
        </div>
    );
}

// Slice 17c.7 — `PreviewContextWrapper` and `PreviewErrorBoundary`
// were the inline-preview wrappers that mounted AI-generated widget
// code directly in the host React tree. They were replaced by the
// iframe-isolated preview path (slices 17c.1 — 17c.6) and removed
// here. The iframe shell now owns the equivalent context wrapping
// (AppContext, ThemeContext, DashboardContext, WidgetContext) inside
// its own React tree, and React error boundaries inside the iframe
// catch render errors that previously needed PreviewErrorBoundary on
// the host side.

// ─── System prompt builder ──────────────────────────────────────────
//
// Slice 19B: the modal's system prompt was a ~1000-line monster that
// duplicated everything the project's dash-widget-builder skill
// already covers. Now it's a thin pointer. The cliController spawns
// claude-p with the parent process's cwd inherited (project root in
// dev, app.getAppPath() in packaged), so the project's
// .claude/skills/dash-widget-builder/ auto-loads. The skill carries
// the canonical guidance (tailwind safelist, dash-react prop names,
// providerApiRegistry, single-task widgets, defensive coding,
// install-time permission gate, etc.). This builder only contributes
// runtime context the skill can't know:
//   - which provider the user pre-selected (focused branch)
//   - which providers are installed at all (legacy branch)
//   - first-response style guidance ("ask one short question, then
//     output code")
//
// The DISCOVER_SYSTEM_PROMPT constant below is unchanged — it's for
// the modal's other mode (browse the registry), not the build mode.

/**
 * Format the user's currently-installed providers for the prompt.
 * Tells the AI "this widget needs algolia, the user already has an
 * algolia provider, no install required" — saving the user from
 * reconfiguring credentials they've already set up.
 */
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

- Do NOT run shell commands. No \`npm run dev\`, no \`npm run start\`, no \`widgetize\`, no \`ls\`, no \`cat\`, no \`grep\`. The skill mentions some of these — those instructions are for users running \`claude\` in a terminal, NOT for you here. You have all the context you need from this prompt and the skill.
- Do NOT scaffold files via Bash or Write. The widget builder writes the files itself when the user clicks Install. Your output is the widget code IN-CHAT (text + code blocks), nothing on disk.
- Do NOT explore the user's filesystem. The skill provides architectural guidance; this prompt provides the runtime context (which provider was picked, what providers are installed). That's everything.
- The Skill tool is allowed when the dash-widget-builder skill prescribes it — that's the skill's job. Other tools (Bash / Read / Write / Edit / Glob / Grep / Task / WebFetch / WebSearch) should not fire in this conversation.

Output format: text replies + fenced \`\`\`jsx and \`\`\`javascript code blocks per the skill's Output Protocol. The user copies nothing manually — the widget builder parses your code blocks and installs them.

## Cohesion rule (non-negotiable, audit-enforced)

Every UI element comes from a \`@trops/dash-react\` primitive whose color is delivered via ThemeContext. This is the rule the Dash *chrome* (sidebar, modals, settings) follows; widgets currently break it from the inside out, which is the gap this prompt is closing. The skill's "Color Rule" and "Primitive Palette" sections list the exact primitives — read those before writing code.

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
        return `${MODAL_CONTEXT_PREAMBLE}You are the Dash Widget Builder. Use the project's \`dash-widget-builder\` skill (auto-loaded from \`.claude/skills/dash-widget-builder/\`) for ALL architectural guidance — tailwind safelist, dash-react prop names, provider classes, IPC method registry, single-task widget rule, defensive coding rules, event publishing, scheduled tasks, and the install-time permission gate are all in the skill. Don't restate them; follow them.

## Pre-selected provider (from the user's pick)

- Type: \`${pickedType}\`
- Class: \`${pickedClass}\`

The widget config MUST declare:

\`\`\`javascript
providers: [{ type: "${pickedType}", providerClass: "${pickedClass}", required: true }]
\`\`\`

Use the consumption hook for class \`${pickedClass}\` (per the skill's "Provider Class — Credential vs MCP" section). Do NOT pick a different class or type — the user has already configured this provider.

## Other providers the user already has configured

${formatInstalledProvidersForPrompt(installedProviders)}

(Read-only context. Don't switch providers; build for the pre-selected one above.)

## First-response style

If this is your FIRST response in the conversation, do NOT output code. Reply with 1–2 short sentences acknowledging the **${pickedType}**${
            pickedClass ? ` (${pickedClass})` : ""
        } pick and asking what specific data or actions they want surfaced from ${pickedType}. Keep it under 30 words. No lists, no examples. After their reply, output the widget code per the skill's Output Protocol.`;
    }

    // No-provider branch — user explicitly picked "no external provider".
    if (isPickedNone) {
        return `${MODAL_CONTEXT_PREAMBLE}You are the Dash Widget Builder. Use the project's \`dash-widget-builder\` skill for ALL architectural guidance.

The user has chosen NOT to use any external provider — generate a self-contained widget (clock, counter, static display, etc.) with NO \`providers: [...]\` array in the config.

## First-response style

If this is your FIRST response, do NOT output code. Reply with 1–2 short sentences asking what they want the widget to do with local-only data or interactions (no provider talk). Keep it under 30 words. No lists, no examples.`;
    }

    // Legacy branch — picker hasn't fired yet (rare; the picker gates
    // chat input). Tell the AI to ask the user which provider before
    // writing code.
    return `${MODAL_CONTEXT_PREAMBLE}You are the Dash Widget Builder. Use the project's \`dash-widget-builder\` skill for ALL architectural guidance.

## Providers the user already has configured

${formatInstalledProvidersForPrompt(installedProviders)}

## First-response style

If this is your FIRST response, do NOT output code. Reply with 1–2 short sentences inviting the user to describe the widget they want — what it should show, what data source it pulls from, what interactions it needs. No lists, no examples — keep it under 30 words.`;
}

const DISCOVER_SYSTEM_PROMPT = `You are helping the user DISCOVER existing widgets in the Dash registry. Your only job this conversation is to search and describe registry matches. You MUST NOT generate widget code.

How to respond:
- On every user message, call the \`search_widgets\` MCP tool with a short keyword query derived from the user's request (e.g. "sales pipeline" for "help me find a sales pipeline widget").
- After the tool returns, give a brief 1–3 sentence summary of what you found. The app renders the widget list as interactive cards separately, so you do NOT need to list every result in prose — just highlight notable matches or gaps.
- If \`search_widgets\` returns zero results, tell the user plainly, and suggest they switch to Build mode to generate one from scratch.
- If the user's next message is a refinement (e.g. "sales pipeline" after "sales dashboard"), call \`search_widgets\` again with the new query. Treat every message as a search intent — do not silently switch modes.

Hard rules:
- Do NOT output widget code in any form.
- Do NOT use Skill, Read, Write, Edit, Bash, Glob, or Grep tools.
- Do NOT invoke the dash-widget-builder skill — the skill's guidance is already inlined above as the "Widget Builder Guidance" section. Its content is provided directly so calling the skill duplicates context and triggers forbidden tool exploration.
- The only tool you should use is \`search_widgets\`.`;

/**
 * Walk the most-recent assistant messages backwards looking for code
 * blocks. Returns BOTH the legacy `{ componentCode, configCode }` shape
 * AND the new `{ files: [{ path, content }] }` shape so callers can pick
 * whichever they need.
 *
 * Two response formats are supported, in priority order:
 *
 * 1. **Multi-file** — when blocks are preceded by `File: <relative-path>`
 *    markers, every block is captured with its declared path. The first
 *    matched assistant message that contains AT LEAST ONE `File:` marker
 *    is taken whole (so a multi-widget package with N siblings parses
 *    in one shot).
 *
 * 2. **Two-block legacy** — no `File:` markers, but at least 2 fenced
 *    code blocks. First is treated as the component, second as the
 *    config. Same heuristic as the old extractor — preserves
 *    backwards-compat with single-file widget responses.
 *
 * 3. **Single-block fix-up** — a single block that looks like a
 *    component (export default function / import React) or a config
 *    (workspace:/canHaveChildren). Used during edit cycles where the
 *    user only asks to change one half of the widget. Walks further
 *    back through history to fill in the other half.
 */
function extractCodeBlocks(messages) {
    // First pass: look for multi-file responses.
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role !== "assistant") continue;
        const text = textOfMessage(msg);
        if (!text) continue;

        const fileBlocks = extractFileBlocks(text);
        if (fileBlocks.length > 0) {
            const { componentCode, configCode } =
                derivePrimaryFromFileBlocks(fileBlocks);
            return { componentCode, configCode, files: fileBlocks };
        }
    }

    // Second pass: legacy two-block / single-block flow.
    let componentCode = null;
    let configCode = null;

    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role !== "assistant") continue;
        const text = textOfMessage(msg);
        if (!text) continue;

        const blocks = [];
        const regex =
            /```(?:jsx|javascript|js|react|tsx|typescript)?\s*\n([\s\S]*?)```/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            blocks.push(match[1].trim());
        }

        if (blocks.length >= 2 && !componentCode) {
            componentCode = blocks[0];
            configCode = blocks[1];
            break;
        } else if (blocks.length === 1) {
            const block = blocks[0];
            if (
                !componentCode &&
                (block.includes("export default function") ||
                    block.includes("import React"))
            ) {
                componentCode = block;
            } else if (
                !configCode &&
                (block.includes("workspace:") ||
                    block.includes("canHaveChildren"))
            ) {
                configCode = block;
            }
        }

        if (componentCode && configCode) break;
    }

    // Synthesize a files[] payload from the legacy two-block result so
    // downstream install code paths can take a uniform shape regardless
    // of which format the AI returned.
    const files = [];
    if (componentCode || configCode) {
        const widgetName = extractWidgetName(componentCode);
        const safeName = widgetName || "Widget";
        if (componentCode) {
            files.push({
                path: `widgets/${safeName}.js`,
                content: componentCode,
            });
        }
        if (configCode) {
            files.push({
                path: `widgets/${safeName}.dash.js`,
                content: configCode,
            });
        }
    }

    return { componentCode, configCode, files };
}

function textOfMessage(msg) {
    return typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
        ? msg.content
              .filter((c) => c.type === "text")
              .map((c) => c.text)
              .join("\n")
        : "";
}

/**
 * Parse `File: <path>\n```...```` markers out of a message body. Each
 * fenced code block immediately preceded by a `File:` marker becomes one
 * file entry. Blocks with no preceding marker are ignored here (the
 * legacy two-block path catches those separately).
 */
function extractFileBlocks(text) {
    if (!text) return [];
    // Match: a `File: <path>` line, optional blank, then a fenced block.
    // Allow common code-fence info strings (jsx/js/javascript/json/md/...).
    const regex =
        /(?:^|\n)\s*File:\s*([^\n`]+?)\s*\n+```[a-zA-Z0-9]*\s*\n([\s\S]*?)```/g;
    const out = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        const path = match[1].trim();
        const content = match[2];
        if (path && content !== undefined) {
            out.push({ path, content: content.replace(/\s+$/, "") });
        }
    }
    return out;
}

/**
 * Pick the "primary" widget out of a multi-file response so the legacy
 * preview / install pipeline can keep showing one widget. Strategy:
 *  - Find the first `widgets/<Name>.dash.js`. The matching
 *    `widgets/<Name>.js` is the component.
 *  - If there's no .dash.js at all, fall back to the first .js with
 *    `export default function`.
 */
function derivePrimaryFromFileBlocks(files) {
    let componentCode = null;
    let configCode = null;

    const dashFile = files.find((f) => f.path.endsWith(".dash.js"));
    if (dashFile) {
        configCode = dashFile.content;
        const baseName = dashFile.path.replace(/\.dash\.js$/, "");
        const componentFile = files.find(
            (f) => f.path === `${baseName}.js` || f.path === `${baseName}.jsx`
        );
        if (componentFile) componentCode = componentFile.content;
    }

    if (!componentCode) {
        const candidate = files.find(
            (f) =>
                /\.(js|jsx|tsx|ts)$/.test(f.path) &&
                !f.path.endsWith(".dash.js") &&
                /export\s+default\s+function/.test(f.content)
        );
        if (candidate) componentCode = candidate.content;
    }

    return { componentCode, configCode };
}

function extractWidgetName(code) {
    if (!code) return null;
    // Match common React component export patterns:
    //   export default function WidgetName
    //   export const WidgetName = (
    //   export function WidgetName(
    //   function WidgetName ... export default WidgetName
    const patterns = [
        /export\s+default\s+function\s+(\w+)/,
        /export\s+(?:const|let|var)\s+(\w+)\s*=/,
        /export\s+function\s+(\w+)/,
        /export\s+default\s+(\w+)\s*;/,
    ];
    for (const re of patterns) {
        const match = code.match(re);
        if (match) return match[1];
    }
    return null;
}

// Mirrors validateWidget.cjs::VALID_CATEGORIES — kept in sync manually
// (small enum, rarely changes). Used to populate the install-footer picker.
const VALID_CATEGORIES = [
    "general",
    "utilities",
    "productivity",
    "development",
    "social",
    "media",
    "finance",
    "health",
    "education",
    "entertainment",
];

/**
 * Build a default `.dash.js` config literal when the AI emitted only the
 * component block. Bakes in the user-picked provider (if any) so the Code
 * tab shows what's actually going to install rather than a blank file.
 * The category is injected later by handleInstall once the user picks one.
 */
function synthesizeDefaultConfigCode(widgetName, selectedProvider) {
    if (!widgetName) return "";
    const displayName = widgetName.replace(/([A-Z])/g, " $1").trim();
    const providersLine = (() => {
        if (!selectedProvider) return "";
        if (selectedProvider.sentinel === "none") return "";
        const { type, providerClass } = selectedProvider;
        if (!type || !providerClass) return "";
        return `\n    providers: [{ type: "${type}", providerClass: "${providerClass}", required: true }],`;
    })();
    return `export default {
    component: "${widgetName}",
    name: "${displayName}",
    package: "${displayName}",
    author: "AI Assistant",
    type: "widget",
    canHaveChildren: false,
    workspace: "ai-built",${providersLine}
};
`;
}

/**
 * Inject (or replace) a `category: "..."` field on an `export default { ... }`
 * config literal. The aiBuild IPC handler writes configCode verbatim to disk
 * with no parsing, so any string transform here lands directly in the saved
 * .dash.js file.
 */
function injectCategoryIntoConfigCode(configCode, category) {
    if (!configCode || !category) return configCode;
    // Replace existing category field if present
    if (/category:\s*["'][^"']*["']/.test(configCode)) {
        return configCode.replace(
            /category:\s*["'][^"']*["']/,
            `category: "${category}"`
        );
    }
    // Otherwise insert before the closing brace of `export default { … }`.
    // Capture head / body / tail so we can strip any trailing comma the
    // AI wrote on the last property (legal JS) before prepending our
    // own separator. Without this, `userConfig: { … },\n}` would turn
    // into `userConfig: { … },, category: "..."` and esbuild would
    // choke with "Expected identifier but found ','".
    return configCode.replace(
        /(export\s+default\s*\{)([\s\S]*?)(\s*\}\s*;?\s*)$/,
        (_match, head, body, tail) => {
            const cleanedBody = body.replace(/,\s*$/, "");
            const sep = cleanedBody.trim().length > 0 ? "," : "";
            return `${head}${cleanedBody}${sep} category: "${category}"${tail}`;
        }
    );
}

/**
 * Dedup duplicate provider-type entries in a `providers: [...]` array
 * inside an `export default { ... }` config literal. AI code-gen
 * occasionally produces `providers: [{type: "x"}, {type: "x"}]` — left
 * unchecked, the duplicates ship to the registry verbatim and double
 * up the rows in the Dashboard Config → Providers tab on every
 * downstream install. We dedup at AI-build write time so the .dash.js
 * file written to disk (and ultimately zipped on publish) is already
 * clean. The runtime dedup in dash-core/providerResolution.js stays
 * as defense-in-depth for older / hand-edited configs.
 *
 * Regex-based and intentionally conservative: only matches a single-
 * level array-of-object-literals form. Anything more exotic (computed
 * keys, spread, nested arrays) falls through unchanged and the
 * runtime dedup picks up the slack.
 */
function dedupProvidersInConfigCode(configCode) {
    if (!configCode) return configCode;
    return configCode.replace(
        /(providers\s*:\s*\[)([^[\]]*?)(\])/,
        (match, head, body, tail) => {
            // Split into individual `{...}` chunks. The split keeps the
            // braces — we just need to walk in order and drop dupes.
            const chunks = body
                .split(/(\{[^{}]*\})/)
                .filter((s) => s && /\S/.test(s));
            const seenTypes = new Set();
            const kept = [];
            let dropped = 0;
            for (const chunk of chunks) {
                if (!chunk.startsWith("{")) {
                    // Punctuation between objects (commas, whitespace).
                    // Suppress now and we'll re-emit our own separators.
                    continue;
                }
                const typeMatch = chunk.match(/type\s*:\s*["']([^"']+)["']/);
                if (!typeMatch) {
                    kept.push(chunk.trim());
                    continue;
                }
                const t = typeMatch[1];
                if (seenTypes.has(t)) {
                    dropped++;
                    continue;
                }
                seenTypes.add(t);
                kept.push(chunk.trim());
            }
            if (dropped === 0) return match;
            return `${head}${kept.join(", ")}${tail}`;
        }
    );
}

/**
 * Pull the list of provider types declared in a `.dash.js` config text.
 * Used by the Widget Builder to detect MCP types the freshly-generated
 * widget will need at runtime, so we can render an "install missing
 * provider" affordance even when the AI failed to call the
 * install_known_mcp_server tool.
 *
 * Conservative regex parser — handles the common literal shape
 * `providers: [{type:"x"}, {type:"y"}]`. Anything more exotic falls
 * through and the banner just doesn't appear (better than false
 * positives).
 */
function extractProviderTypesFromConfigCode(configCode) {
    if (!configCode) return [];
    const arrayMatch = configCode.match(/providers\s*:\s*\[([^[\]]*?)\]/);
    if (!arrayMatch) return [];
    const types = [];
    const typeRe = /type\s*:\s*["']([^"']+)["']/g;
    let m;
    while ((m = typeRe.exec(arrayMatch[1])) !== null) {
        types.push(m[1]);
    }
    return types;
}

/** Try to extract an existing category from a configCode string. */
function extractCategoryFromConfigCode(configCode) {
    if (!configCode) return null;
    const match = configCode.match(/category:\s*["']([^"']+)["']/);
    return match ? match[1] : null;
}

export const WidgetBuilderModal = ({
    isOpen,
    setIsOpen,
    onInstalled,
    cellContext,
    editContext,
}) => {
    // The modal renders outside DashboardStage's context tree, so
    // ThemeContext and AppContext are empty here. We bridge them via
    // window broadcasts from inside the tree:
    //   - previewThemeCtx → dashboard theme for the widget PREVIEW
    //   - previewAppCtx   → providers/settings for MCP provider access
    //   - currentTheme    → null (modal chrome uses fixed dark colors)
    const localThemeCtx = useContext(ThemeContext);
    const [previewTheme, setPreviewTheme] = useState(
        () => window.__dashThemeContext || null
    );
    const [previewApp, setPreviewApp] = useState(
        () => window.__dashAppContext || null
    );
    useEffect(() => {
        const themeHandler = () =>
            setPreviewTheme({ ...window.__dashThemeContext });
        const appHandler = () => setPreviewApp({ ...window.__dashAppContext });
        window.addEventListener("dash:theme-changed", themeHandler);
        window.addEventListener("dash:app-context-changed", appHandler);
        return () => {
            window.removeEventListener("dash:theme-changed", themeHandler);
            window.removeEventListener("dash:app-context-changed", appHandler);
        };
    }, []);
    const previewThemeCtx = previewTheme || localThemeCtx;
    const previewAppCtx = previewApp || null;
    const currentTheme = localThemeCtx?.currentTheme;
    if (false && previewAppCtx) {
        console.log("[WidgetBuilder] AppContext bridge:", {
            hasProviders: !!previewAppCtx.providers,
            providerCount: previewAppCtx.providers
                ? Object.keys(previewAppCtx.providers).length
                : 0,
            hasCredentials: !!previewAppCtx.credentials,
            appId: previewAppCtx.credentials?.appId,
            hasDashApi: !!previewAppCtx.dashApi,
        });
    }
    const appContext = useContext(AppContext);

    const [previewComponent, setPreviewComponent] = useState(null);
    // Slice 17c.2 — the raw esbuild bundle source string + the
    // component name the iframe should mount. Populated by the
    // compile pipeline alongside `previewComponent`. Only consumed
    // when the iframe-preview feature flag is on.
    const [previewBundleSource, setPreviewBundleSource] = useState(null);
    const [previewBundleComponentName, setPreviewBundleComponentName] =
        useState(null);
    // Slice 17c.4 — receive iframe-side errors and surface them
    // through the existing previewError UI. The shell posts every
    // error kind (`uncaught`, `unhandled-rejection`, `bundle-eval`,
    // `mount`, `no-component`, etc.) via `bridge:error`; we collapse
    // them into a friendly message + meta so the existing "Send
    // error to AI" button can post a corrective message to chat.
    // Slice 17c.5 — drive the empty-render detector from iframe-side
    // measurements. The shell measures its own DOM (the host can't
    // query iframe content via the previewWrapperRef because that
    // ref points at the inline preview div) and posts text length +
    // descendant count via `bridge:render-stats`. We mirror the same
    // double-check thresholds the inline detector uses
    // (`text.length === 0 && childCount <= 1`).
    const handleIframeRenderStats = useCallback((payload) => {
        const textLength =
            (payload && typeof payload.textLength === "number"
                ? payload.textLength
                : 0) | 0;
        const childCount =
            (payload && typeof payload.childCount === "number"
                ? payload.childCount
                : 0) | 0;
        const looksEmpty = textLength === 0 && childCount <= 1;
        setPreviewLooksEmpty(looksEmpty);
    }, []);
    const handleIframePreviewError = useCallback((payload) => {
        const kind = (payload && payload.kind) || "iframe-runtime";
        const message =
            (payload && payload.message) || "Widget runtime error in iframe";
        const stack = (payload && payload.stack) || null;
        const friendly = `Widget preview error (${kind}): ${message}`;
        setPreviewError(friendly);
        setPreviewErrorMeta({
            kind: "iframe-error",
            iframeErrorKind: kind,
            message,
            stack,
            // The Send-to-AI button reads previewErrorMeta.correction
            // (set by slice 17b.12 for hallucinated-method errors).
            // For iframe runtime errors we synthesize a similar
            // message so the button works the same way.
            correction:
                "The widget you generated threw a runtime error inside the iframe-isolated preview:\n\n" +
                friendly +
                (stack ? "\n\nStack:\n" + stack : "") +
                "\n\nFix the bug and re-emit BOTH the component and config code blocks. Trace through the user's first interaction (the dropdown selection, the form submit, etc.) and verify every hook, every async call, every prop access is null-safe.",
        });
    }, []);
    // True when the compiled widget mounted but produced a tree with
    // zero visible text — usually because the AI used wrong dash-react
    // prop names (e.g. `<Heading text=...>` instead of `title=`). The
    // detector runs after each preview compile (see useEffect below)
    // and flips this flag to surface a corrective banner. Without it,
    // the user just sees a black canvas with no error to act on.
    const [previewLooksEmpty, setPreviewLooksEmpty] = useState(false);
    // Default prop values derived from the parsed config's `userConfig`
    // schema. Live widgets receive their userConfig defaultValues as
    // FLAT props (see WidgetFactory.userPrefsForItem in dash-core); for
    // a brand-new widget being built in this modal there's no
    // editContext.userPrefs, so without this the widget would get
    // nothing for fields it expects to read off props.* — first render
    // would crash on `Cannot read properties of undefined`.
    // editContext.userPrefs (when editing an existing widget) takes
    // priority because that's the user's actually-saved value.
    const [previewWidgetDefaults, setPreviewWidgetDefaults] = useState({});
    // Resolved config object from the most recent successful preview
    // compile. The Configure tab reads from this directly so its form
    // populates with the AI's actual userConfig / providers / events
    // — same source the runtime renderer uses, no source-string drift.
    const [previewParsedConfig, setPreviewParsedConfig] = useState(null);
    // Provider the user selected for the widget being built. Drives the
    // system prompt (single deterministic provider section instead of a
    // catalog + decision tree the LLM has to navigate) AND the post-
    // processing rewrite that snaps the AI's generated config to the
    // selected type+class. See ChatProviderGate.
    //   - null                                    → not picked yet
    //   - { sentinel: "none" }                    → "no external provider"
    //   - { name, type, providerClass }           → an installed provider
    const [selectedProviderForBuild, setSelectedProviderForBuild] =
        useState(null);
    // Mirror into a ref so the message-poller closure (which captures
    // state at modal-open time) can read the latest pick without us
    // having to invalidate the interval on every change.
    const selectedProviderForBuildRef = useRef(null);
    useEffect(() => {
        selectedProviderForBuildRef.current = selectedProviderForBuild;
    }, [selectedProviderForBuild]);
    const [previewError, setPreviewError] = useState(null);
    // Test-inputs form state (slice 17b.9). One key per userConfig
    // field — the user types values here to exercise the previewed
    // widget with real data without leaving the modal. Reset when
    // a new config compiles so a stale value from a previous widget
    // doesn't leak into the new one.
    const [previewTestInputs, setPreviewTestInputs] = useState({});
    // Slice 17b: surfaces the main process's "we adjusted the AI's provider
    // config to match your installed provider" rewrite. Cleared whenever
    // a fresh compile starts so the banner doesn't linger after the AI
    // gets it right.
    const [providerCorrection, setProviderCorrection] = useState(null);
    // Structured error metadata from the main process (e.g. an
    // ESBUILD_SPAWN_FAILED with diagnostics). When present we render an
    // expanded diagnostics block under the error message — this is what
    // turns "spawn ENOENT" from a dead end into something the user (or
    // we) can act on. Cleared whenever previewError is cleared.
    const [previewErrorMeta, setPreviewErrorMeta] = useState(null);
    const [isCompiling, setIsCompiling] = useState(false);
    const [installStatus, setInstallStatus] = useState(null);
    // Slice 17d.2 — install-time permission gate. When the AI's
    // generated widget calls credentialed provider methods, we
    // pause the install flow, show the permission modal, and only
    // proceed once the user has explicitly granted (or denied)
    // each method. `pendingInstallContext` stores the original
    // install parameters so the actual install can resume after
    // the user's decision.
    const [pendingInstallContext, setPendingInstallContext] = useState(null);
    const [detectedCode, setDetectedCode] = useState({
        componentCode: null,
        configCode: null,
        // Multi-file payload (Phase 2). Includes the primary widget's
        // component + config plus any sibling utility files Claude
        // emitted with `File:` markers. Empty for legacy two-block
        // responses; downstream code synthesizes a 2-entry files[]
        // from componentCode + configCode in that case.
        files: [],
    });
    // Required category for the install — user must pick before Install enables.
    // Pre-filled in remix mode if the original config already declares one.
    const [selectedCategory, setSelectedCategory] = useState(null);
    // Editable widget name for remixes — defaults to <Original>Remix
    const [remixName, setRemixName] = useState("");
    // "update" = overwrite original in-place, "remix" = create new copy
    const [editMode, setEditMode] = useState("remix");

    // ── Drafts state ──────────────────────────────────────────────
    // viewMode: "drafts" → show the WidgetDraftsList entry view.
    //           "builder" → show the existing chat + preview UI.
    // The modal opens in "drafts" if there are any saved drafts AND
    // we aren't in remix mode (remix mode bypasses the list — the
    // user clicked Remix on a specific widget, not Build New). The
    // open-time decision happens in a one-shot effect below.
    // Starts null so the initial render doesn't flash the empty builder UI
    // before the async drafts check resolves. The drafts-gate useEffect
    // (~line 2099) sets this to "drafts" or "builder" once it knows.
    const [viewMode, setViewMode] = useState(null);
    // Current draft session id. Generated lazily on the first
    // parseable AI response; reused across saves within the same
    // session so we update one row, not pile up. Cleared on close /
    // install / new-chat.
    const draftSessionIdRef = useRef(null);
    // Schema metadata for the draft we resumed from (if any), so the
    // first save reuses its id rather than creating a duplicate row.
    const resumedDraftRef = useRef(null);
    // Registry auth — used to determine ownership for update vs remix
    const [registryUsername, setRegistryUsername] = useState(null);
    const [registryChecked, setRegistryChecked] = useState(false);
    const lastCompiledCode = useRef(null);
    // Monotonic request counter — bumped at the start of every compile
    // request so in-flight IPCs know if they've been superseded. Used to
    // ignore stale results when the user rapidly picks different widgets
    // from the Discover grid.
    const compileRequestIdRef = useRef(0);
    const [activeTab, setActiveTab] = useState("preview");
    // Console events from the widget under preview. Captured by
    // widgetConsoleCapture (see useEffect below). Cleared on each new
    // compile so the user sees only output relevant to the current
    // bundle. Append-only during a session — bounded to 500 entries
    // to keep the renderer responsive even with chatty widgets.
    const [consoleEvents, setConsoleEvents] = useState([]);
    const consoleEventsRef = useRef([]);
    const appendConsoleEvent = useCallback((evt) => {
        const next = consoleEventsRef.current.concat([evt]);
        // Drop oldest entries when over the cap.
        const trimmed =
            next.length > 500 ? next.slice(next.length - 500) : next;
        consoleEventsRef.current = trimmed;
        setConsoleEvents(trimmed);
    }, []);
    const clearConsoleEvents = useCallback(() => {
        consoleEventsRef.current = [];
        setConsoleEvents([]);
    }, []);

    // "User has acted in this modal session" gate — flips true the
    // first time the chat message count grows past its mount-time
    // snapshot. Used to suppress the scorecard tab badge + the
    // "Widget rendered with no visible content" warning on the
    // initial Build-mode screen: a stale draft loaded from
    // localStorage shouldn't make the user feel like they did
    // something wrong before they've even typed.
    //
    // ChatCore persists messages at the "dash-widget-builder"
    // localStorage key as { messages: [...] }. Same-window writes
    // don't fire the `storage` event, so we poll the key cheaply
    // (one JSON.parse every 500ms) until the count grows or the
    // user closes the modal — once the gate flips we tear the
    // interval down. Done as state, not a ref, so the gate flipping
    // triggers a re-render of the affected UI.
    const mountChatMessageCountRef = useRef(null);
    const [hasActedThisSession, setHasActedThisSession] = useState(false);
    useEffect(() => {
        try {
            const raw = localStorage.getItem("dash-widget-builder");
            const data = raw ? JSON.parse(raw) : null;
            mountChatMessageCountRef.current = Array.isArray(data?.messages)
                ? data.messages.length
                : 0;
        } catch {
            mountChatMessageCountRef.current = 0;
        }
    }, []);
    useEffect(() => {
        if (hasActedThisSession) return undefined;
        const id = setInterval(() => {
            try {
                const raw = localStorage.getItem("dash-widget-builder");
                const data = raw ? JSON.parse(raw) : null;
                const count = Array.isArray(data?.messages)
                    ? data.messages.length
                    : 0;
                if (
                    mountChatMessageCountRef.current !== null &&
                    count > mountChatMessageCountRef.current
                ) {
                    setHasActedThisSession(true);
                }
            } catch {
                // ignore — gate stays false on parse error
            }
        }, 500);
        return () => clearInterval(id);
    }, [hasActedThisSession]);

    // Acceptance scorecard counts — fed by the static-analysis pass
    // over the AI-generated widget source. Drives the Scorecard tab
    // badge (red count when ✗ items > 0). Recomputed only when the
    // emitted componentCode changes; for a 200-line widget the regex
    // pass is sub-millisecond, but memoizing keeps it off the render
    // hot path.
    //
    // Failure count zeroes out until the user has acted this session
    // — the tab still exists for the user who wants to peek at their
    // draft's score, but it doesn't ambush them with a red badge on
    // the initial render of a pre-loaded draft.
    const scorecardRows = useMemo(() => {
        if (!detectedCode?.componentCode) return [];
        return evaluateScorecard(detectedCode.componentCode);
    }, [detectedCode?.componentCode]);
    const scorecardFailCount = hasActedThisSession
        ? scorecardRows.filter((r) => r.pass === false).length
        : 0;

    // Slice 19G.2 + 19H — push a "fix this runtime error" user
    // message into the ChatCore conversation via the
    // dash:chat-core-send CustomEvent. ChatCore subscribes to this
    // event and calls handleSend on match (dash-core >= 0.1.553).
    // The previous localStorage-write approach silently dropped
    // messages because ChatCore only reads localStorage at mount.
    const handleSendConsoleErrorToAI = useCallback((evt) => {
        // Serialize args defensively: strings stay; non-strings get
        // JSON.stringify'd; truncate any single arg to 1000 chars so
        // the chat message stays terse.
        const argsText = (evt.args || [])
            .map((a) => {
                if (typeof a === "string") return a;
                if (a && typeof a === "object" && a.__isError) {
                    return `${a.name || "Error"}: ${a.message || ""}`;
                }
                try {
                    return JSON.stringify(a);
                } catch {
                    return String(a);
                }
            })
            .map((s) => (s.length > 1000 ? s.slice(0, 1000) + "…" : s))
            .join(" ");
        // Trim the stack to the first 8 frames — full stacks are
        // noisy and most of the signal is in the top frames.
        const stackTrim = (evt.stack || "").split("\n").slice(0, 8).join("\n");
        const sourceLabel =
            evt.source === "window.error"
                ? "uncaught error"
                : evt.source === "unhandledrejection"
                ? "unhandled promise rejection"
                : `console.${evt.severity || "error"}`;
        const content = `Runtime ${sourceLabel} in your widget:

\`\`\`
${argsText}
\`\`\`

${
    stackTrim ? `Stack (top 8 frames):\n\`\`\`\n${stackTrim}\n\`\`\`\n\n` : ""
}Re-emit BOTH code blocks (component + config) with the bug fixed. Add defensive guards (typeof / Array.isArray / optional chaining) so the same input doesn't crash again. If a \`catch\` block was silently swallowing the error, render it via \`<ErrorMessage message={err.message} />\` instead. Do not just retry the same code path.`;
        try {
            window.dispatchEvent(
                new CustomEvent("dash:chat-core-send", {
                    detail: {
                        persistKey: "dash-widget-builder",
                        content,
                    },
                })
            );
        } catch {
            /* ignore */
        }
    }, []);

    // Closes the scorecard loop: when the user clicks "Ask AI" on a
    // failing rule (or "Ask AI to fix all N"), push a structured
    // user message into the chat via the same dash:chat-core-send
    // event handleSendConsoleErrorToAI uses. We also flip to Build
    // mode so the AI's response goes to the chat the user is
    // actually looking at — the AI will re-emit BOTH code blocks
    // which the Build flow parses into detectedCode.
    const handleScorecardSendToAi = useCallback((rules) => {
        const content = buildScorecardChatMessage(rules);
        if (!content) return;
        setChatMode("build");
        setActiveTab("preview");
        try {
            window.dispatchEvent(
                new CustomEvent("dash:chat-core-send", {
                    detail: {
                        persistKey: "dash-widget-builder",
                        content,
                    },
                })
            );
        } catch {
            /* ignore */
        }
    }, []);

    // Surface auto-save activity in the build view: timestamp of the
    // last successful draft save + transient state so the user sees
    // their work is being persisted.
    const [draftLastSavedAt, setDraftLastSavedAt] = useState(null);
    const [draftSaveState, setDraftSaveState] = useState("idle"); // "idle" | "saving" | "saved" | "error"
    const [openingEditor, setOpeningEditor] = useState(false);
    const [editorOpenError, setEditorOpenError] = useState(null);

    // Provider-picker change feedback. When the user picks a different
    // provider, briefly flag that type so the picker can show a "Now
    // using <name> — preview reloaded" caption next to the dropdown.
    // Auto-clears after a short delay.
    const [providerJustChanged, setProviderJustChanged] = useState(null);
    const providerChangedTimerRef = useRef(null);
    const flagProviderChange = useCallback((type, name) => {
        if (providerChangedTimerRef.current) {
            clearTimeout(providerChangedTimerRef.current);
        }
        setProviderJustChanged({ type, name, at: Date.now() });
        providerChangedTimerRef.current = setTimeout(() => {
            setProviderJustChanged(null);
            providerChangedTimerRef.current = null;
        }, 3000);
    }, []);
    useEffect(() => {
        return () => {
            if (providerChangedTimerRef.current) {
                clearTimeout(providerChangedTimerRef.current);
            }
        };
    }, []);

    const [activeFile, setActiveFile] = useState("component");
    const manualEditRef = useRef(false);
    const lastMsgCount = useRef(0);
    // Local edit-context override, populated when the user clicks Remix
    // on a registry-preview card. Mirrors the shape of the prop editContext
    // so the rest of the modal (system prompt, install path, remix footer,
    // compilePreview sourcePackage) reads a single "effective" context.
    const [editContextOverride, setEditContextOverride] = useState(null);
    const effectiveEditContext = editContextOverride || editContext;
    const isRemixMode = !!effectiveEditContext?.originalWidgetId;

    // Chat-pane mode ("build" = AI generates widgets, "discover" = AI
    // searches the registry, "compose" = stepwise composer with no
    // chat). Resets to "compose" each time the modal opens — it's
    // the more reliable surface today; Build remains one click away.
    const [chatMode, setChatMode] = useState("compose");
    // Mirror of chatMode in a ref so the chat-messages poller (which
    // stays mounted across mode changes) can read the current mode
    // without resubscribing on every flip. Required so the
    // "messages.length===0 + hadActivity" New-Chat reset branch can
    // skip compose mode, which intentionally never writes messages.
    const chatModeRef = useRef("compose");
    useEffect(() => {
        chatModeRef.current = chatMode;
    }, [chatMode]);

    // Composer tree state. Lifted out of ComposerPane so we can
    // persist the user's composition in the draft alongside the
    // generated code. `composerInitialTree` is set from a resumed
    // draft (paired with a remount via composerSessionKey so the
    // pane picks up the new tree); composerTree is the live mirror
    // updated on every in-pane edit via onTreeChange.
    const [composerTree, setComposerTree] = useState(null);
    const [composerInitialTree, setComposerInitialTree] = useState(null);
    const [composerSessionKey, setComposerSessionKey] = useState(0);
    // V2 grid composer state. Lives alongside the tree state during
    // the dogfood phase — once G3 flips the default, the tree state
    // gets migrated and the old fields go away.
    const [composerGrid, setComposerGrid] = useState(null);
    // composerInitialGrid will be wired into G3's draft restore path.
    // For G2, fresh sessions only.
    // eslint-disable-next-line no-unused-vars
    const [composerInitialGrid, setComposerInitialGrid] = useState(null);
    const composerGridRef = useRef(null);
    useEffect(() => {
        composerGridRef.current = composerGrid;
    }, [composerGrid]);
    // Selected composer node, lifted out of ComposerPane so the
    // preview iframe's click-to-pick can drive the composer's
    // inspector. Also lets us pass the current selection back into
    // the iframe so the highlighted outline stays in sync when the
    // user picks a node in the composition tree.
    const [composerSelectedNodeId, setComposerSelectedNodeId] = useState(null);
    // Mirror in a ref so the auto-save useEffect can read the latest
    // tree without re-binding on every keystroke. The save effect's
    // deps already cover code+files; using a ref for tree avoids
    // re-scheduling the entire effect when the tree mutates.
    const composerTreeRef = useRef(null);
    useEffect(() => {
        composerTreeRef.current = composerTree;
    }, [composerTree]);
    // Widgets returned by registry.search for the most recent user message
    // in Discover mode. Rendered as cards above the chat.
    const [discoverResults, setDiscoverResults] = useState([]);
    const [discoverSearching, setDiscoverSearching] = useState(false);
    // Set of locally-installed package IDs ("@scope/name"). Populated once
    // when the modal opens so Discover cards can show an "Installed ✓"
    // badge — the raw registry.search result doesn't carry this flag.
    const [installedPackageIds, setInstalledPackageIds] = useState(
        () => new Set()
    );
    // Remember the last query we searched for so we don't re-hit the
    // registry on every poll tick for the same user message.
    const lastDiscoverQueryRef = useRef("");
    // When previewing a registry widget (user clicked a Discover card),
    // this holds the package metadata so the Preview footer can swap to
    // "Install from registry" instead of the AI-built install flow.
    const [browsingPackage, setBrowsingPackage] = useState(null);
    const [registryInstalling, setRegistryInstalling] = useState(false);
    // User's explicit provider selection for the preview, keyed by the
    // widget-declared provider type (e.g. { algolia: "My Algolia Account" }).
    // Passed through to PreviewContextWrapper so the widget sees a real
    // provider and renders its live UX. In Edit-with-AI mode this is
    // pre-filled from the dashboard widget instance's selectedProviders
    // so the dropdown reflects the live binding instead of showing
    // blank — see the editContext-change effect below.
    const [previewProviderSelection, setPreviewProviderSelection] = useState(
        {}
    );
    // Pre-fill the provider picker from the dashboard widget's existing
    // bindings whenever a new Edit-with-AI context opens. Without this,
    // the dropdown reads empty and the user can't tell which provider
    // the live widget is currently wired to. Keyed by originalWidgetId
    // (not selectedProviders) so switching between edited widgets
    // resets correctly but the user's in-session dropdown changes
    // don't get clobbered by this initializer.
    React.useEffect(() => {
        if (effectiveEditContext?.selectedProviders) {
            setPreviewProviderSelection({
                ...effectiveEditContext.selectedProviders,
            });
        } else {
            setPreviewProviderSelection({});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveEditContext?.originalWidgetId]);

    // Pre-fill the preview's test-input form from the dashboard
    // widget's saved userPrefs whenever a new Edit-with-AI context
    // opens. Without this the user re-types every field (path,
    // query, refresh interval, etc.) they already configured on
    // the live dashboard instance — the editContext carries those
    // values through verbatim, so consuming them here is a pure
    // ergonomic win. The compile-driven prune at the bottom of
    // compilePreview keeps only keys the new userConfig schema
    // still declares, so a stale prefs key from the original widget
    // won't haunt the preview if the user's edit drops a field.
    React.useEffect(() => {
        if (
            effectiveEditContext?.userPrefs &&
            typeof effectiveEditContext.userPrefs === "object"
        ) {
            setPreviewTestInputs({ ...effectiveEditContext.userPrefs });
        } else {
            setPreviewTestInputs({});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveEditContext?.originalWidgetId]);

    // Augment the preview's provider selection with global-default
    // fallbacks once the parsed config arrives. The dashboard
    // widget instance's `selectedProviders` only carries per-
    // instance overrides — when it's empty (or missing entries for
    // some required types), the live runtime falls through to the
    // global `isDefaultForType: true` provider for that type
    // (see useMcpProvider.js resolution chain). The preview needs
    // to mirror that fallback so the user sees the same provider
    // their dashboard widget is actually using, not an empty
    // dropdown with the misleading impression that nothing's wired.
    React.useEffect(() => {
        if (!effectiveEditContext?.originalWidgetId) return;
        if (
            !previewParsedConfig?.providers ||
            !Array.isArray(previewParsedConfig.providers)
        )
            return;
        const appProvs = previewAppCtx?.providers;
        if (!appProvs || typeof appProvs !== "object") return;
        const requiredTypes = previewParsedConfig.providers
            .filter((p) => p && p.required !== false && p.type)
            .map((p) => p.type);
        if (requiredTypes.length === 0) return;
        setPreviewProviderSelection((prev) => {
            const next = { ...(prev || {}) };
            let changed = false;
            for (const type of requiredTypes) {
                if (next[type]) continue;
                // Walk appProviders for a default of this type.
                for (const [name, data] of Object.entries(appProvs)) {
                    if (
                        data &&
                        data.type === type &&
                        data.isDefaultForType === true
                    ) {
                        next[type] = name;
                        changed = true;
                        break;
                    }
                }
            }
            return changed ? next : prev;
        });
    }, [
        effectiveEditContext?.originalWidgetId,
        previewParsedConfig,
        previewAppCtx,
    ]);

    // Pre-populate the provider picker from edit-context when editing
    // an existing widget. If the existing config declares a provider
    // type that matches one of the user's installed providers, pick
    // that one. Otherwise leave the picker null so the user picks
    // explicitly.
    React.useEffect(() => {
        if (!effectiveEditContext?.configCode) return;
        const types = extractProviderTypesFromConfigCode(
            effectiveEditContext.configCode
        );
        if (types.length === 0) {
            // Existing widget has no provider declared → "no external".
            setSelectedProviderForBuild({ sentinel: "none" });
            return;
        }
        // Type-first architecture: derive just { type, providerClass }
        // from the existing widget's config. Class is determined by
        // matching an installed provider of that type, or falling back
        // to "credential" (the more common case for non-MCP providers).
        const wantedType = types[0];
        const installed = Object.values(providers || {}).find(
            (p) => p && typeof p === "object" && p.type === wantedType
        );
        setSelectedProviderForBuild({
            type: wantedType,
            providerClass:
                installed?.providerClass ||
                // No installed match — guess "mcp" if the type appears
                // in the MCP catalog (heuristic), else default to
                // "credential". Either way the user can change later.
                "credential",
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        effectiveEditContext?.configCode,
        effectiveEditContext?.originalWidgetId,
    ]);
    // Device-code sign-in flow for the registry. When the user clicks
    // "Sign in to preview", we stash the flow here so we can display the
    // user code + poll for completion.
    const [signInFlow, setSignInFlow] = useState(null);
    const signInPollRef = useRef(null);

    const settings = appContext?.settings || {};
    const providers = appContext?.providers || {};
    const aiSettings = settings.aiAssistant || {};
    const preferredBackend = aiSettings.preferredBackend || "claude-code";
    const model = aiSettings.model || "claude-sonnet-4-20250514";

    const anthropicEntry = Object.entries(providers).find(
        ([, p]) =>
            p.type === "anthropic" &&
            (p.providerClass || "credential") === "credential"
    );
    const apiKey = anthropicEntry?.[1]?.credentials?.apiKey || null;
    const bgDark = currentTheme?.["bg-primary-dark"] || "bg-gray-900";
    const borderColor =
        currentTheme?.["border-primary-dark"] || "border-gray-700";

    const widgetName = extractWidgetName(detectedCode.componentCode);

    // Check registry auth to determine widget ownership
    useEffect(() => {
        (async () => {
            try {
                const status = await window.mainApi?.registryAuth?.getStatus();
                if (status?.authenticated) {
                    const profile =
                        await window.mainApi?.registryAuth?.getProfile();
                    setRegistryUsername(profile?.username || null);
                }
            } catch {
                /* ignore */
            }
            setRegistryChecked(true);
        })();
    }, []);

    // Derive ownership: @ai-built = always owner, else scope must match username
    const widgetScope =
        effectiveEditContext?.originalPackage?.match(/^@([^/]+)\//)?.[1];
    const isOwner =
        widgetScope === "ai-built" ||
        (registryUsername && widgetScope === registryUsername);

    // Reset the chat mode toggle to "compose" each time the modal
    // reopens. Compose is the more reliable surface today (build
    // depends on the AI emitting compilable code first try); the
    // user can flip to Build via the tab strip if they want chat.
    useEffect(() => {
        if (isOpen) {
            setChatMode("compose");
            setDiscoverResults([]);
            lastDiscoverQueryRef.current = "";
        }
    }, [isOpen]);

    // Slice 19G.2 — host-side console / error capture is OBSOLETE.
    // Widgets render in an isolated iframe (slice 17c+); the host
    // window's console.* and window.error never see widget-scoped
    // events. The Console tab is now driven entirely by
    // `bridge:console` events forwarded from inside the iframe via
    // <PreviewIframe onConsoleEvent={appendConsoleEvent} />, wired
    // below where PreviewIframe is rendered. The
    // installWidgetConsoleCapture import + tests stay (they're still
    // useful for any future inline-rendering surface), but production
    // installs nothing on the host.

    // On open: decide whether to show the Drafts list or jump straight
    // into the builder. Skip the list in remix mode (the user clicked
    // Remix on a specific widget — they don't want a chooser) and in
    // edit mode (an existing widget is being modified). Otherwise, if
    // any drafts exist, show the list as the entry view. Always reset
    // the per-session draft id so the next save creates a NEW draft
    // unless the user clicks Resume on the list.
    useEffect(() => {
        if (!isOpen) {
            draftSessionIdRef.current = null;
            resumedDraftRef.current = null;
            // Reset to loading sentinel so the next open shows the loading
            // skeleton instead of whatever view was active when last closed.
            setViewMode(null);
            return;
        }
        if (effectiveEditContext) {
            // Remix / edit flow — skip the drafts gate entirely.
            setViewMode("builder");
            return;
        }
        // Reset to loading on every open so we don't briefly show the
        // previous view's leftover state before the async check resolves.
        setViewMode(null);
        let cancelled = false;
        (async () => {
            try {
                const list = (await window.mainApi?.drafts?.list?.()) || [];
                if (cancelled) return;
                if (Array.isArray(list) && list.length > 0) {
                    setViewMode("drafts");
                } else {
                    setViewMode("builder");
                }
            } catch {
                if (!cancelled) setViewMode("builder");
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Auto-save the in-flight widget whenever a parseable AI response
    // produces componentCode. We persist BOTH the latest code and the
    // chat history (read from the same localStorage key ChatCore
    // uses), so resuming restores the conversation exactly. Same
    // session = same draft id (one row updated, not piled up). The
    // first save of a session generates the id; subsequent saves
    // reuse it via draftSessionIdRef. A draft we resumed from reuses
    // its id via resumedDraftRef so we don't duplicate the row.
    useEffect(() => {
        if (!isOpen) return;
        if (effectiveEditContext) return; // remix path doesn't auto-save
        if (!detectedCode?.componentCode) return;
        let id = draftSessionIdRef.current;
        if (!id) {
            id =
                resumedDraftRef.current?.id ||
                `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            draftSessionIdRef.current = id;
        }
        let chatHistory = [];
        try {
            const raw = localStorage.getItem("dash-widget-builder");
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed?.messages))
                    chatHistory = parsed.messages;
            }
        } catch {
            /* ignore */
        }
        const componentName =
            extractWidgetName(detectedCode.componentCode) || null;
        const draftName =
            componentName ||
            (chatHistory
                .find((m) => m && (m.role === "user" || m.author === "user"))
                ?.content?.slice?.(0, 60) ??
                "") ||
            "Untitled draft";
        // Build the files[] payload for the main process to
        // materialize on disk. Synthesize a 2-entry array if the AI's
        // multi-file payload was empty (legacy single-file response).
        let files = Array.isArray(detectedCode.files)
            ? detectedCode.files.slice()
            : [];
        if (files.length === 0 && componentName && detectedCode.componentCode) {
            files = [
                {
                    path: `widgets/${componentName}.js`,
                    content: detectedCode.componentCode,
                },
            ];
            if (detectedCode.configCode) {
                files.push({
                    path: `widgets/${componentName}.dash.js`,
                    content: detectedCode.configCode,
                });
            }
        }
        const draft = {
            id,
            name: draftName,
            componentName,
            chatHistory,
            pickedProvider: selectedProviderForBuildRef.current,
            mode: "ai",
            // Compose-mode persistence: stash the live tree + the
            // active chat mode so resuming restores the composer
            // back to the user's last composition (not just the
            // emitted code).
            chatMode: chatModeRef.current || "build",
            composerTree: composerTreeRef.current || null,
        };
        // Pass files alongside so the main process materializes them
        // under @ai-built/<name>-draft-<id>/ and stamps packageDir
        // onto the draft entry. Track save state on the parent so the
        // toolbar's "Saving / Saved Xs ago" indicator can render.
        setDraftSaveState("saving");
        Promise.resolve(window.mainApi?.drafts?.save?.(draft, files))
            .then(() => {
                setDraftSaveState("saved");
                setDraftLastSavedAt(Date.now());
            })
            .catch((err) => {
                console.warn("[WidgetBuilder] draft save failed:", err);
                setDraftSaveState("error");
            });
    }, [
        isOpen,
        effectiveEditContext,
        detectedCode?.componentCode,
        detectedCode?.configCode,
        detectedCode?.files,
    ]);

    // Probe Claude CLI / esbuild / @ai-built dir on every modal open so
    // we can surface failures BEFORE the user tries to compile and hits
    // a raw "spawn ENOENT" with no path forward. Result is rendered as a
    // yellow banner at the top of the modal — only shown when something
    // is actually wrong.
    const [healthCheck, setHealthCheck] = useState(null);
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        (async () => {
            try {
                const result =
                    await window.mainApi?.aiAssistant?.healthCheck?.();
                if (!cancelled) setHealthCheck(result || null);
            } catch (err) {
                if (!cancelled)
                    setHealthCheck({
                        cli: { ok: false, error: err.message },
                        compiler: { ok: false, error: err.message },
                        aiBuiltDir: { ok: false, error: err.message },
                    });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    // Pull both MCP catalogs (built-in + known-external) so the system
    // prompt can advertise them to Claude. Refetched on every open so a
    // newly-added custom MCP shows up without restarting the modal.
    const [builtInCatalog, setBuiltInCatalog] = useState([]);
    const [knownExternalCatalog, setKnownExternalCatalog] = useState([]);
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        (async () => {
            try {
                const [local, external] = await Promise.all([
                    window.mainApi?.mcp?.getCatalog?.(),
                    window.mainApi?.mcp?.getKnownExternalCatalog?.(),
                ]);
                if (cancelled) return;
                setBuiltInCatalog(local?.catalog || []);
                setKnownExternalCatalog(external?.servers || []);
            } catch (err) {
                console.warn(
                    "[WidgetBuilderModal] MCP catalog fetch failed:",
                    err
                );
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    const healthCheckIssues = healthCheck
        ? [
              healthCheck.cli && healthCheck.cli.ok === false
                  ? {
                        label: "Claude CLI",
                        detail:
                            healthCheck.cli.error ||
                            "Not found — chat will not work until installed",
                    }
                  : null,
              healthCheck.compiler && healthCheck.compiler.ok === false
                  ? {
                        label: "Widget compiler",
                        detail:
                            (healthCheck.compiler.error ||
                                "esbuild not available") +
                            (healthCheck.compiler.diagnostics
                                ? ` (arch ${
                                      healthCheck.compiler.diagnostics.arch
                                  }, native binary ${
                                      healthCheck.compiler.diagnostics
                                          .nativeBinaryExists
                                          ? "present"
                                          : "missing"
                                  } at ${
                                      healthCheck.compiler.diagnostics
                                          .nativeBinaryPath || "<unresolved>"
                                  })`
                                : ""),
                        diagnostics: healthCheck.compiler.diagnostics,
                    }
                  : null,
              healthCheck.aiBuiltDir && healthCheck.aiBuiltDir.ok === false
                  ? {
                        label: "Widget output dir",
                        detail: `${
                            healthCheck.aiBuiltDir.error || "Not writable"
                        } (${healthCheck.aiBuiltDir.path || "unknown path"})`,
                    }
                  : null,
          ].filter(Boolean)
        : [];

    // Fetch the set of installed package IDs whenever the modal opens so
    // Discover cards can show accurate "Installed ✓" badges. Refreshed
    // after a successful install so the badge updates in-place.
    const refreshInstalledPackageIds = useCallback(async () => {
        try {
            const list = await window.mainApi?.widgets?.list();
            const ids = new Set();
            for (const w of list || []) {
                const id = w?.packageId || w?.name;
                if (id) ids.add(id);
            }
            setInstalledPackageIds(ids);
        } catch {
            /* ignore — cards just won't show badges */
        }
    }, []);

    useEffect(() => {
        if (isOpen) refreshInstalledPackageIds();
    }, [isOpen, refreshInstalledPackageIds]);

    // When the installed set changes (e.g. user just installed a package
    // via this modal), re-compute the `installed` flag on already-rendered
    // cards in-place so badges light up without re-running the AI search.
    useEffect(() => {
        setDiscoverResults((prev) => {
            if (!prev.length) return prev;
            let changed = false;
            const next = prev.map((pkg) => {
                const scopedId = pkg.scope
                    ? `@${pkg.scope.replace(/^@/, "")}/${
                          pkg.package || pkg.name
                      }`
                    : pkg.package || pkg.name;
                const installed =
                    !!pkg.installed || installedPackageIds.has(scopedId);
                if (installed === pkg.installed) return pkg;
                changed = true;
                return { ...pkg, installed };
            });
            return changed ? next : prev;
        });
    }, [installedPackageIds]);

    // Clear results when switching away from Discover so stale cards don't
    // linger when the user goes back to Discover later; re-running a new
    // search will repopulate them.
    useEffect(() => {
        if (chatMode !== "discover") {
            lastDiscoverQueryRef.current = "";
        }
    }, [chatMode]);

    // Populate the Discover results strip by watching ChatCore's persisted
    // messages for the AI's own search_widgets tool call. Priority:
    //  1. The AI's extracted input.query (best: "clock" vs "find some clock widgets")
    //  2. The user's most recent message text (fallback when the tool
    //     name doesn't match or tool_use is still streaming)
    //
    // The poll runs any time the modal is open — not gated by chatMode —
    // so if the AI searches in Build mode the cards are still ready to
    // show when the user flips to Discover, and users who chat freely
    // see results sooner.
    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(async () => {
            try {
                const raw = localStorage.getItem("dash-widget-builder");
                if (!raw) return;
                const data = JSON.parse(raw);
                const msgs = data?.messages || [];
                // Claude Code CLI prefixes MCP tools as
                // "mcp__<server>__<tool>"; the Anthropic API backend
                // passes the bare name. Match anything that contains
                // "search_widgets" as a defensive net.
                const isSearchWidgets = (name) =>
                    typeof name === "string" &&
                    name.toLowerCase().includes("search_widgets");
                let query = "";
                outer: for (let i = msgs.length - 1; i >= 0; i--) {
                    const m = msgs[i];
                    const calls = Array.isArray(m?.toolCalls)
                        ? m.toolCalls
                        : [];
                    for (let j = calls.length - 1; j >= 0; j--) {
                        const c = calls[j];
                        if (!isSearchWidgets(c?.toolName)) continue;
                        const q =
                            c?.input?.query ??
                            (typeof c?.input === "string" ? c.input : "");
                        if (q && String(q).trim()) {
                            query = String(q).trim();
                            break outer;
                        }
                    }
                }
                // Fallback: if no tool-call query found, use the latest
                // user message as the search keyword. Imperfect (raw
                // conversational text rarely substring-matches widget
                // metadata) but strictly better than no cards at all.
                if (!query) {
                    for (let i = msgs.length - 1; i >= 0; i--) {
                        const m = msgs[i];
                        if (m?.role !== "user") continue;
                        const t =
                            typeof m.content === "string"
                                ? m.content
                                : Array.isArray(m.content)
                                ? m.content
                                      .filter((c) => c?.type === "text")
                                      .map((c) => c.text)
                                      .join(" ")
                                : "";
                        if (t && t.trim()) {
                            query = t.trim();
                            break;
                        }
                    }
                }
                if (!query) return;
                if (query === lastDiscoverQueryRef.current) return;
                lastDiscoverQueryRef.current = query;
                setDiscoverSearching(true);
                try {
                    const result = await window.mainApi?.registry?.search(
                        query,
                        { type: "widget" }
                    );
                    // Flatten packages → widget cards (same shape our cards
                    // expect: {name, displayName, description, package,
                    // scope, installed, downloadUrl, version}).
                    const widgets = [];
                    for (const pkg of result?.packages || []) {
                        const scopedId = pkg.scope
                            ? `@${pkg.scope.replace(/^@/, "")}/${pkg.name}`
                            : pkg.name;
                        // registry.search doesn't set `installed`; consult
                        // the locally-cached set we populated on open.
                        const installed =
                            !!pkg.installed ||
                            installedPackageIds.has(scopedId);
                        const base = {
                            package: pkg.name,
                            scope: pkg.scope || null,
                            installed,
                            downloadUrl: pkg.downloadUrl,
                            version: pkg.version,
                        };
                        const sub = pkg.widgets || [];
                        if (sub.length === 0) {
                            widgets.push({
                                ...base,
                                name: pkg.name,
                                displayName: pkg.displayName || pkg.name,
                                description: pkg.description || "",
                            });
                        } else {
                            for (const w of sub) {
                                widgets.push({
                                    ...base,
                                    name:
                                        pkg.scope && w.name
                                            ? `${pkg.scope}.${pkg.name}.${w.name}`
                                            : w.name || pkg.name,
                                    displayName:
                                        w.displayName ||
                                        w.name ||
                                        pkg.displayName ||
                                        pkg.name,
                                    description:
                                        w.description || pkg.description || "",
                                });
                            }
                        }
                    }
                    setDiscoverResults(widgets);
                } finally {
                    setDiscoverSearching(false);
                }
            } catch {
                /* ignore — next tick will retry */
            }
        }, 1200);
        return () => clearInterval(interval);
    }, [isOpen, installedPackageIds]);

    // End session + clear chat on unmount (modal close) so the next
    // open starts fresh. The open-side clear happens in Dash.js before
    // this component mounts (avoids race with ChatCore loading stale data).
    useEffect(() => {
        return () => {
            try {
                localStorage.setItem(
                    "dash-widget-builder",
                    JSON.stringify({ messages: [] })
                );
            } catch (_) {
                /* ignore */
            }
            if (window.mainApi?.llm?.endCliSession) {
                window.mainApi.llm.endCliSession("dash-widget-builder");
            }
        };
    }, []);

    // Isolate widget-preview runtime errors so buggy user code (AI-
    // generated or registry) can't crash the rest of the app. React's
    // PreviewErrorBoundary catches RENDER errors only; event-handler
    // and async errors bypass it, and in dev mode react-error-overlay
    // will blanket the Electron window with its red full-screen UI if
    // any such error reaches the window-level error handler.
    //
    // While the modal is open we trap EVERY unhandled error at the
    // window level — filtering by stack is unreliable (callbacks from
    // fetch, timers, MCP IPC all come in through different frames).
    // This briefly suppresses errors from anywhere in the app, but
    // the trade-off is worth it: the modal is ephemeral, and the cost
    // of one missed app error is far lower than an AI widget
    // whiting-out the entire Electron window with no recovery.
    useEffect(() => {
        if (!isOpen) return;

        // Tells the early-boot error listener in public/index.html to
        // stay quiet — we own all error handling while the modal is
        // open, and double-logging just confuses the user.
        window.__DASH_WIDGET_BUILDER_OPEN = true;

        const handleCapture = (message) => {
            console.warn("[WidgetBuilderModal] suppressed error:", message);
            setPreviewError(message || "Widget runtime error");
            setPreviewComponent(null);
        };

        const errorHandler = (event) => {
            const msg =
                event.error?.message || event.message || "Widget runtime error";
            event.preventDefault();
            event.stopImmediatePropagation();
            handleCapture(msg);
        };

        const rejectionHandler = (event) => {
            const msg =
                event.reason?.message ||
                String(event.reason || "Widget async error");
            event.preventDefault();
            event.stopImmediatePropagation();
            handleCapture(msg);
        };

        // Silence the classic window.onerror hook too — react-error-overlay
        // uses addEventListener, but some polyfills / logging layers still
        // hit the old hook. Returning true tells the browser the error was
        // handled and should not be reported further.
        const prevOnError = window.onerror;
        const prevOnRejection = window.onunhandledrejection;
        window.onerror = (message, _src, _ln, _col, error) => {
            handleCapture(error?.message || message || "Widget runtime error");
            return true;
        };
        window.onunhandledrejection = (event) => {
            handleCapture(
                event?.reason?.message || String(event?.reason || "async error")
            );
            return true;
        };

        // Capture phase so we run BEFORE react-error-overlay's listeners
        // and can stopImmediatePropagation to keep its full-screen red
        // overlay from taking over the window.
        window.addEventListener("error", errorHandler, true);
        window.addEventListener("unhandledrejection", rejectionHandler, true);
        return () => {
            window.removeEventListener("error", errorHandler, true);
            window.removeEventListener(
                "unhandledrejection",
                rejectionHandler,
                true
            );
            window.onerror = prevOnError;
            window.onunhandledrejection = prevOnRejection;
            delete window.__DASH_WIDGET_BUILDER_OPEN;
        };
    }, [isOpen]);

    // Poll for code blocks and auto-compile for preview
    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(() => {
            try {
                const raw = localStorage.getItem("dash-widget-builder");
                if (raw) {
                    const data = JSON.parse(raw);
                    const msgs = data?.messages || [];

                    // Detect New Chat (messages cleared) — but not in remix mode
                    // where we intentionally start with empty messages.
                    // Triggers if the user had ANY activity in the chat
                    // (either compiled code OR sent at least one message),
                    // so clicking New Chat after Skip-for-now (no compile
                    // yet) still re-opens the provider gate.
                    //
                    // Slice 20.C1+ — also skip the reset branch while
                    // the user is in compose mode. Compose never writes
                    // chat messages, so `msgs.length === 0` is true for
                    // every poll tick; combined with `hadActivity` from
                    // the composer's own compiles, the reset would fire
                    // continuously and nuke the live composer preview.
                    //
                    // Use lastMsgCount alone (not lastCompiledCode) as
                    // the "had activity" signal. The previous OR with
                    // lastCompiledCode meant that ANY prior compile —
                    // including ones from the composer — counted as
                    // chat activity, so switching compose → build
                    // (still messages.length===0 from the never-used
                    // chat) would immediately nuke the composer's
                    // emitted code. Only a real prior chat turn should
                    // gate this reset.
                    const hadActivity = lastMsgCount.current > 0;
                    if (
                        msgs.length === 0 &&
                        hadActivity &&
                        chatModeRef.current !== "compose" &&
                        !effectiveEditContext?.componentCode
                    ) {
                        setPreviewComponent(null);
                        setPreviewError(null);
                        setDetectedCode({
                            componentCode: null,
                            configCode: null,
                        });
                        setInstallStatus(null);
                        // Reset the provider gate so it reappears for the
                        // user to re-pick (matches user-stated UX: "if the
                        // user would like to change the provider, the
                        // session would end, a new chat would begin and the
                        // provider view would show as if they started from
                        // the beginning").
                        setSelectedProviderForBuild(null);
                        lastCompiledCode.current = null;
                        // Reset the message counter so this block doesn't
                        // re-fire on the next poll tick (msgs is still []
                        // until the user types something new).
                        lastMsgCount.current = 0;
                        return;
                    }

                    // Reset manualEdit when user sends a new message
                    if (msgs.length !== lastMsgCount.current) {
                        lastMsgCount.current = msgs.length;
                        if (manualEditRef.current)
                            manualEditRef.current = false;
                    }

                    // Skip polling if user is manually editing code
                    if (manualEditRef.current) return;

                    const extracted = extractCodeBlocks(msgs);
                    if (extracted.componentCode) {
                        if (
                            extracted.componentCode !== lastCompiledCode.current
                        ) {
                            console.log(
                                "[WidgetBuilder] New code detected, compiling preview..."
                            );
                            // If AI emitted only the component (no .dash.js
                            // block), synthesize a default config bound to
                            // the picker selection so the Code tab shows
                            // the file the user is actually going to
                            // install. Without this the .dash.js editor
                            // appears empty and the user can't see that
                            // their picked provider is wired in.
                            let normalized = extracted;
                            if (!extracted.configCode) {
                                // Derive widgetName from the AI's component
                                // code rather than reading the stale captured
                                // closure variable (this poller was set up
                                // when the modal first opened and detectedCode
                                // was empty).
                                const liveWidgetName = extractWidgetName(
                                    extracted.componentCode
                                );
                                const livePick =
                                    selectedProviderForBuildRef.current;
                                const synthesized = synthesizeDefaultConfigCode(
                                    liveWidgetName,
                                    livePick
                                );
                                if (synthesized && liveWidgetName) {
                                    const filesWithConfig = (() => {
                                        const out = Array.isArray(
                                            extracted.files
                                        )
                                            ? [...extracted.files]
                                            : [];
                                        const dashPath = `widgets/${liveWidgetName}.dash.js`;
                                        const existing = out.findIndex(
                                            (f) => f?.path === dashPath
                                        );
                                        if (existing >= 0) {
                                            out[existing] = {
                                                path: dashPath,
                                                content: synthesized,
                                            };
                                        } else {
                                            out.push({
                                                path: dashPath,
                                                content: synthesized,
                                            });
                                        }
                                        return out;
                                    })();
                                    normalized = {
                                        ...extracted,
                                        configCode: synthesized,
                                        files: filesWithConfig,
                                    };
                                }
                            }
                            setDetectedCode(normalized);
                            compilePreview(normalized);
                        }
                    } else if (msgs.length > 0 && false) {
                        // Debug: check if assistant responded but no code blocks found
                        const lastAssistant = [...msgs]
                            .reverse()
                            .find((m) => m.role === "assistant");
                        if (lastAssistant) {
                            const text =
                                typeof lastAssistant.content === "string"
                                    ? lastAssistant.content
                                    : Array.isArray(lastAssistant.content)
                                    ? lastAssistant.content
                                          .filter((c) => c.type === "text")
                                          .map((c) => c.text)
                                          .join("\n")
                                    : "";
                            if (text.includes("```")) {
                                console.warn(
                                    "[WidgetBuilder] Code fences found but extractCodeBlocks returned null. Check fence language tags."
                                );
                            }
                        }
                    }
                }
            } catch (e) {
                /* ignore */
            }
        }, 2000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Pre-load source code for remix/edit mode
    useEffect(() => {
        if (editContext?.componentCode && isOpen) {
            const code = {
                componentCode: editContext.componentCode,
                configCode: editContext.configCode || "",
            };
            setDetectedCode(code);
            lastCompiledCode.current = code.componentCode;
            // Try to compile a preview — if it fails (e.g. multi-file
            // widget with unresolvable imports), fall back to Code tab.
            setActiveTab("preview");
            compilePreview(code).catch(() => {});

            // Land the user in Build mode (chat-driven edit), not
            // the default Compose mode. Edit-with-AI is about
            // iterating on existing code via the AI chat — Compose's
            // grid-based building would discard the loaded code and
            // start fresh (ComposerPaneV2's empty-grid mount used to
            // overwrite detectedCode here; even with that guarded,
            // Compose isn't the right entry point for a widget the
            // user already has).
            setChatMode("build");

            // Pre-fill the category picker from the original config so the user
            // can install the remix without re-picking. Falls through to null
            // (forcing a pick) if the original widget had no category declared.
            const existing = extractCategoryFromConfigCode(
                editContext.configCode
            );
            if (existing && VALID_CATEGORIES.includes(existing)) {
                setSelectedCategory(existing);
            }

            // Default remix name: use the bare component name (strip scope
            // prefix like "trops.algolia."), strip trailing "Remix" to
            // avoid stacking, then re-append.
            const origName = editContext.originalComponentName || "";
            const bareName = origName.includes(".")
                ? origName.split(".").pop()
                : origName;
            const base = bareName.replace(/Remix\d*$/, "");
            setRemixName(base ? base + "Remix" : "");

            // Default mode based on ownership — set once registry check completes.
            // @ai-built is always "update"; for others, wait for ownership check.

            // Clear previous chat so the user starts fresh
            try {
                localStorage.setItem(
                    "dash-widget-builder",
                    JSON.stringify({ messages: [] })
                );
            } catch (_) {
                /* ignore */
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editContext, isOpen]);

    // Set default edit mode once ownership is determined
    useEffect(() => {
        if (!isRemixMode || !registryChecked) return;
        setEditMode(isOwner ? "update" : "remix");
    }, [isRemixMode, isOwner, registryChecked]);

    const compilePreview = useCallback(
        async (code, sourcePackageOverride = null) => {
            const name = extractWidgetName(code.componentCode);
            if (!name || !code.componentCode) return;

            // Bump the request counter. Any in-flight compile for an
            // earlier widget will see that its id is stale and bail out
            // before overwriting state. Fixes the A → Back → B race where
            // A's slower compile could overwrite B's rendered preview.
            const requestId = ++compileRequestIdRef.current;
            const isStale = () => compileRequestIdRef.current !== requestId;

            setIsCompiling(true);
            setPreviewError(null);
            setPreviewComponent(null);
            setProviderCorrection(null);
            setInstallStatus(null);
            // Console output from a previous bundle is no longer
            // relevant to the new compile — clear so the user only
            // sees output for the widget they're currently looking at.
            clearConsoleEvents();
            lastCompiledCode.current = code.componentCode;

            try {
                const result =
                    await window.mainApi?.widgetBuilder?.compilePreview(
                        name,
                        code.componentCode,
                        code.configCode ||
                            (() => {
                                const displayName = name
                                    .replace(/([A-Z])/g, " $1")
                                    .trim();
                                // Preview-only template — category is a placeholder
                                // here; the user-selected value gets injected at
                                // install time in handleInstall.
                                return `export default { component: "${name}", name: "${displayName}", package: "${displayName}", author: "AI Assistant", category: "general", type: "widget", canHaveChildren: false, workspace: "ai-built" };`;
                            })(),
                        // Pass the source package so multi-file widgets can
                        // resolve relative imports from the installed
                        // package (e.g. Algolia widgets that import from
                        // ../hooks/, ../components/, etc.). Callers can
                        // pass a per-call override (used by the Discover
                        // flow before editContext gets promoted).
                        sourcePackageOverride ||
                            effectiveEditContext?.originalPackage ||
                            null,
                        // Multi-file payload (Phase 2): when the AI
                        // emitted sibling utility files alongside the
                        // primary widget, hand them to the main process
                        // so esbuild sees the full package and can
                        // resolve relative imports during preview.
                        Array.isArray(code.files) && code.files.length > 0
                            ? code.files
                            : null,
                        // Provider the user pre-selected — main process
                        // auto-corrects any drift in the AI's config.
                        selectedProviderForBuild
                    );

                if (isStale()) return;

                // Slice 17b: capture provider auto-correct so the UI can show
                // a banner explaining why the rendered preview differs from
                // what the AI emitted (e.g. AI declared `mcp` but user has
                // the provider configured as `credential`).
                if (result?.providerCorrection) {
                    setProviderCorrection(result.providerCorrection);
                }

                if (!result?.success) {
                    setPreviewError(result?.error || "Compilation failed");
                    setPreviewErrorMeta(
                        result?.code || result?.diagnostics
                            ? {
                                  code: result?.code || null,
                                  diagnostics: result?.diagnostics || null,
                              }
                            : null
                    );
                    setPreviewComponent(null);
                    setIsCompiling(false);
                    return;
                }

                // Evaluate the bundle to get the React component
                const bundleExports = evaluateBundle(
                    result.bundleSource,
                    `@ai-built/${name.toLowerCase()}`
                );
                const configs = extractWidgetConfigs(bundleExports);
                // Match by exact key OR by bare name suffix (scoped IDs
                // like "trops.algolia.AlgoliaSearchWidget" end with the
                // bare component name).
                const match =
                    configs.find((c) => c.key === name) ||
                    configs.find((c) => c.key.endsWith(`.${name}`)) ||
                    configs.find(
                        (c) => c.key === name || c.config?.name === name
                    );

                if (isStale()) return;

                if (match && typeof match.config.component === "function") {
                    // Compute default props from the parsed userConfig
                    // schema. Each entry of the form
                    // `{ fieldName: { defaultValue: X } }` becomes a
                    // flat prop `fieldName: X`. This mirrors what
                    // dash-core's WidgetFactory does for live-rendered
                    // widgets, so AI-generated code that reads
                    // `props.defaultJql` / `props.title` / etc. gets a
                    // sensible value instead of undefined.
                    const userConfig = match.config?.userConfig || {};
                    const defaults = {};
                    for (const [fieldName, spec] of Object.entries(
                        userConfig
                    )) {
                        if (
                            spec &&
                            typeof spec === "object" &&
                            "defaultValue" in spec
                        ) {
                            defaults[fieldName] = spec.defaultValue;
                        }
                    }
                    setPreviewWidgetDefaults(defaults);
                    // Preserve typed test-input values whose key still
                    // exists in the new userConfig schema; drop only
                    // keys the new schema doesn't have. Recompile fires
                    // on every grid edit / streamed-AI keystroke, so a
                    // blanket reset wiped values the user had just typed
                    // into unrelated fields (e.g. editing a Heading
                    // would clear the `indexName` they entered for the
                    // SearchInput's Algolia wire).
                    setPreviewTestInputs((prev) => {
                        const next = {};
                        for (const key of Object.keys(prev || {})) {
                            if (
                                Object.prototype.hasOwnProperty.call(
                                    userConfig,
                                    key
                                )
                            ) {
                                next[key] = prev[key];
                            }
                        }
                        return next;
                    });

                    // Provider API hallucination guardrail (slice
                    // 17b.12). Walk the AI's component code looking
                    // for `window.mainApi.<service>.<method>(` calls
                    // where <method> isn't in the registry. If the
                    // AI invented a method (e.g. algolia.getRules,
                    // saveRule, deleteRule), set previewError with
                    // a corrective message instead of mounting a
                    // widget that's guaranteed to fail at runtime.
                    // Use `code.componentCode` (the param) rather than
                    // `detectedCode.componentCode` (closed-over state) so
                    // we don't need to add detectedCode to this
                    // useCallback's deps — recompiling the callback on
                    // every keystroke during streaming is unnecessary.
                    const componentSrc = code.componentCode || "";

                    // Slice 17b.13: widgets must not contain Modal /
                    // Dialog / Drawer chrome. Run BEFORE the provider-
                    // API check so a Modal-using widget surfaces the
                    // single-purpose rule first (it's the more
                    // architectural fix; the prop-API hallucination
                    // is downstream of choosing the wrong shape).
                    const modalCheck = validateNoModalUsage(componentSrc);
                    if (!modalCheck.ok) {
                        const list = modalCheck.errors
                            .map(
                                (e) =>
                                    `\`<${e.tag}>\` (line ${e.line}) — ${e.suggestion}`
                            )
                            .join("\n");
                        setPreviewError(
                            "Widget uses popup chrome that's forbidden inside widgets:\n" +
                                list +
                                '\n\nClick "Send error to AI" to request a corrected version.'
                        );
                        setPreviewErrorMeta({
                            kind: "modal-in-widget",
                            errors: modalCheck.errors,
                            correction: buildNoModalCorrectionMessage(
                                modalCheck.errors
                            ),
                        });
                        setPreviewComponent(null);
                        setPreviewParsedConfig(match.config);
                        return;
                    }

                    const apiCheck = validateProviderApiUsage(componentSrc);
                    if (!apiCheck.ok) {
                        const list = apiCheck.errors
                            .map(
                                (e) =>
                                    `\`mainApi.${e.service}.${e.method}\` (line ${e.line}) — try: ${e.suggestion}`
                            )
                            .join("\n");
                        setPreviewError(
                            "Widget calls provider methods that don't exist:\n" +
                                list +
                                '\n\nClick "Send error to AI" to request a corrected version.'
                        );
                        setPreviewErrorMeta({
                            kind: "provider-api-hallucination",
                            errors: apiCheck.errors,
                            correction: buildAiCorrectionMessage(
                                apiCheck.errors
                            ),
                        });
                        setPreviewComponent(null);
                        setPreviewParsedConfig(match.config);
                        return;
                    }

                    // Slice 19G — catch hallucinated / typo'd JSX
                    // component names BEFORE the iframe tries to
                    // render. React's "Element type is invalid" error
                    // shows up deep in the reconciler with no
                    // line-pointer; a static check on the AI's source
                    // gives the user a clean "<Bogus> doesn't exist"
                    // message + Send-to-AI fix.
                    const componentCheck =
                        validateComponentReferences(componentSrc);
                    if (!componentCheck.ok) {
                        const list = componentCheck.errors
                            .map(
                                (e) =>
                                    `\`<${e.name}>\` (line ${e.line}) — ${e.suggestion}`
                            )
                            .join("\n");
                        setPreviewError(
                            "Widget uses component names that don't exist:\n" +
                                list +
                                '\n\nClick "Send error to AI" to request a corrected version.'
                        );
                        setPreviewErrorMeta({
                            kind: "component-name-hallucination",
                            errors: componentCheck.errors,
                            correction:
                                buildComponentReferenceCorrectionMessage(
                                    componentCheck.errors
                                ),
                        });
                        setPreviewComponent(null);
                        setPreviewParsedConfig(match.config);
                        return;
                    }

                    // Let PreviewErrorBoundary catch runtime errors in React's context
                    setPreviewComponent(() => match.config.component);
                    // Slice 17c.2 — also store the raw bundle source +
                    // component name so the iframe-preview path can
                    // ship them to the iframe when the flag is on.
                    // Inline path doesn't read these; cost of carrying
                    // them is one extra setState per compile.
                    setPreviewBundleSource(result.bundleSource);
                    setPreviewBundleComponentName(match.key || name);
                    // Slice 17c.7 — the inline empty-render detector
                    // useEffect previously reset this on every compile.
                    // With the inline path gone, do the reset here in
                    // the same place we set bundle source. Iframe
                    // render-stats will flip it back true if the
                    // widget really does render empty.
                    setPreviewLooksEmpty(false);
                    // Hand the resolved config to the Configure tab so
                    // its form reflects what the AI actually generated
                    // (string-parsing the .dash.js source breaks on
                    // imports + identifier component refs).
                    setPreviewParsedConfig(match.config);
                    setPreviewError(null);
                } else {
                    setPreviewWidgetDefaults({});
                    setPreviewTestInputs({});
                    setPreviewParsedConfig(null);
                    setPreviewError(
                        "Could not resolve widget component from bundle."
                    );
                    setPreviewComponent(null);
                }
            } catch (err) {
                if (isStale()) return;
                setPreviewError(err.message);
                setPreviewComponent(null);
            } finally {
                if (!isStale()) setIsCompiling(false);
            }
        },
        [
            effectiveEditContext?.originalPackage,
            selectedProviderForBuild,
            clearConsoleEvents,
        ]
    );

    // Fetch a registry widget's source (no install), hand it to the existing
    // compilePreview pipeline, and switch to the Preview tab.
    //
    // `pkg` may come from two shapes:
    //  1. registryController.searchRegistry — .name is the bare package name
    //  2. MCP search_widgets tool result — .name is a dotted scoped id
    //     (e.g. "trops.clock.Analog") and .package is the bare name
    // We normalize on .package (bare) when present, falling back to .name.
    //
    // If the widget is already installed locally, read the source from disk
    // (mainApi.widgets.readSources) to avoid the registry's auth-gated
    // download endpoint. Only un-installed widgets fall back to previewFetch.
    const handleSelectRegistryPackage = useCallback(
        async (pkg) => {
            const packageName = pkg.package || pkg.name;
            const scopedPackage = pkg.scope
                ? `@${pkg.scope.replace(/^@/, "")}/${packageName}`
                : packageName;
            // Bump the shared compile request counter up front so any
            // in-flight readSources/previewFetch/compile from a
            // previously-clicked card knows it's stale and bails out
            // before overwriting state. Fixes the A → Back → B race.
            const requestId = ++compileRequestIdRef.current;
            const isStale = () => compileRequestIdRef.current !== requestId;

            // Extract the bare widget component name from the card's
            // dotted id (e.g. "trops.chat.ChatClaudeCodeWidget" →
            // "ChatClaudeCodeWidget"). Used for readSources (disk files
            // are named by the bare name).
            const widgetComponentName = pkg.name?.includes(".")
                ? pkg.name.split(".").pop()
                : pkg.name;
            // The full dotted scoped id is what ComponentManager actually
            // keys widgets by (from config.id in the bundle). Dash.js's
            // `dash:place-widget-in-cell` does exact-match lookup, so we
            // need THIS value — not the bare component name — when handing
            // off to onInstalled for placement.
            const registryId =
                pkg.scope && packageName && widgetComponentName
                    ? `${pkg.scope.replace(
                          /^@/,
                          ""
                      )}.${packageName}.${widgetComponentName}`
                    : pkg.name || widgetComponentName;
            setBrowsingPackage({
                packageName,
                scopedPackage,
                componentName: widgetComponentName,
                registryId,
                displayName: pkg.displayName || packageName,
                description: pkg.description || "",
                downloadUrl: pkg.downloadUrl,
                version: pkg.version,
                installed: !!pkg.installed,
                scope: pkg.scope,
            });
            setActiveTab("preview");
            setPreviewError(null);
            setPreviewComponent(null);
            setInstallStatus(null);
            setPreviewProviderSelection({});
            setIsCompiling(true);
            try {
                let componentCode = null;
                let configCode = null;
                let resolvedDownloadUrl = null;

                // Always try the local installed copy first — it's the
                // only path that can read a specific widget out of a
                // multi-widget package by componentName. `mainApi.registry.search`
                // doesn't tell us whether the package is installed, so we
                // can't gate on `pkg.installed` (it's undefined and would
                // force every click into the registry-download fallback,
                // which always returns the alphabetically-first widget).
                const local = await window.mainApi?.widgets?.readSources(
                    scopedPackage,
                    widgetComponentName
                );
                if (isStale()) return;
                if (local?.success && local.componentCode) {
                    componentCode = local.componentCode;
                    configCode = local.configCode;
                }

                if (!componentCode) {
                    // Package isn't installed locally — fall back to the
                    // registry download. dash-core v0.1.391+ honors the
                    // componentName hint so multi-widget packages return
                    // the right widget.
                    const source = await window.mainApi?.registry?.previewFetch(
                        packageName,
                        widgetComponentName
                    );
                    if (isStale()) return;
                    if (!source?.componentCode) {
                        throw new Error(
                            "This package has no previewable component source."
                        );
                    }
                    componentCode = source.componentCode;
                    configCode = source.configCode;
                    resolvedDownloadUrl = source.downloadUrl;
                }

                if (isStale()) return;
                setDetectedCode({ componentCode, configCode });
                if (resolvedDownloadUrl) {
                    setBrowsingPackage((prev) =>
                        prev
                            ? { ...prev, downloadUrl: resolvedDownloadUrl }
                            : prev
                    );
                }
                // Pass scopedPackage so the compile IPC can resolve
                // sibling imports from the installed package dir (or
                // short-circuit to the pre-built bundle when the source
                // hasn't been modified yet).
                await compilePreview(
                    { componentCode, configCode },
                    scopedPackage
                );
            } catch (err) {
                if (isStale()) return;
                setPreviewError(err?.message || "Failed to load preview");
                setIsCompiling(false);
            }
        },
        [compilePreview]
    );

    // Install the currently-previewed registry package through the existing
    // widget install IPC. Uses the scoped ID (@scope/name) as the install
    // key and resolves {version}/{name} placeholders in the downloadUrl.
    const handleInstallRegistryPackage = useCallback(async () => {
        if (!browsingPackage || browsingPackage.installed) return;
        const scopedId = browsingPackage.scope
            ? `@${browsingPackage.scope.replace(/^@/, "")}/${
                  browsingPackage.packageName
              }`
            : browsingPackage.packageName;
        const resolvedUrl = (browsingPackage.downloadUrl || "")
            .replace(/\{version\}/g, browsingPackage.version || "")
            .replace(/\{name\}/g, browsingPackage.packageName);
        setRegistryInstalling(true);
        try {
            await window.mainApi?.widgets?.install(scopedId, resolvedUrl);
            setInstallStatus({ success: true, widgetName: scopedId });
            setBrowsingPackage((prev) =>
                prev ? { ...prev, installed: true } : prev
            );
            setDiscoverResults((prev) =>
                prev.map((p) =>
                    p.name === browsingPackage.packageName
                        ? { ...p, installed: true }
                        : p
                )
            );
            // Refresh the installed-package set so other cards from the
            // same package also show the badge, and so a subsequent
            // AI search re-flattens with the accurate install state.
            refreshInstalledPackageIds();
            if (typeof onInstalled === "function") {
                // Pass the full dotted registry id (e.g.
                // "trops.chat.ChatClaudeCodeWidget") as the first arg —
                // that's the key ComponentManager registers under and
                // LayoutBuilder looks up when placing into the cell.
                onInstalled(
                    browsingPackage.registryId || browsingPackage.packageName,
                    scopedId
                );
            }
        } catch (err) {
            setInstallStatus({
                error: err?.message || "Install failed",
            });
        } finally {
            setRegistryInstalling(false);
        }
    }, [browsingPackage, onInstalled, refreshInstalledPackageIds]);

    // Clear the current registry-widget preview so the user can pick
    // another card from the Discover results strip.
    const handleBackToDiscover = useCallback(() => {
        setBrowsingPackage(null);
        setDetectedCode({ componentCode: null, configCode: null });
        setPreviewComponent(null);
        setPreviewError(null);
        setInstallStatus(null);
        setEditContextOverride(null);
        setPreviewProviderSelection({});
        lastCompiledCode.current = null;
    }, []);

    // Place an already-installed registry widget into the user's current
    // grid cell. Mirrors what the AI-build flow does at the end — calls
    // the onInstalled callback so Dash.js dispatches the
    // `dash:place-widget-in-cell` event, then shows the success screen.
    const handleAddInstalledToDashboard = useCallback(() => {
        if (!browsingPackage) return;
        const scopedId = browsingPackage.scopedPackage
            ? browsingPackage.scopedPackage
            : browsingPackage.scope
            ? `@${browsingPackage.scope.replace(/^@/, "")}/${
                  browsingPackage.packageName
              }`
            : browsingPackage.packageName;
        setInstallStatus({ success: true, widgetName: scopedId });
        if (typeof onInstalled === "function") {
            // Full dotted registry id is required for the cell-placement
            // handoff — see the comment in handleInstallRegistryPackage.
            onInstalled(
                browsingPackage.registryId || browsingPackage.packageName,
                scopedId
            );
        }
    }, [browsingPackage, onInstalled]);

    // Remix a registry widget: keep the fetched source + preview in place,
    // promote the package into an internal edit-context override so the
    // modal transitions to its edit/remix flow (AI chat now knows the
    // source code; Install footer becomes the existing remix/rename
    // footer; handleInstall records remixedFrom attribution).
    const handleRemixRegistryPackage = useCallback(() => {
        if (!browsingPackage || !detectedCode?.componentCode) return;
        const scoped = browsingPackage.scopedPackage
            ? browsingPackage.scopedPackage
            : browsingPackage.scope
            ? `@${browsingPackage.scope.replace(/^@/, "")}/${
                  browsingPackage.packageName
              }`
            : browsingPackage.packageName;
        const originalComponentName = extractWidgetName(
            detectedCode.componentCode
        );
        setEditContextOverride({
            componentCode: detectedCode.componentCode,
            configCode: detectedCode.configCode || "",
            originalPackage: scoped,
            originalComponentName,
            originalWidgetId: `${scoped}/${
                originalComponentName || browsingPackage.packageName
            }`,
            manifest: {
                author: "Unknown",
                version: browsingPackage.version || "1.0.0",
            },
        });
        // Seed the remix name so the footer's rename input is pre-filled.
        const base = (originalComponentName || "").replace(/Remix\d*$/, "");
        setRemixName(base ? `${base}Remix` : "");
        setEditMode("remix");
        // Hand off from browsing-registry footer to the normal remix
        // footer by clearing browsingPackage.
        setBrowsingPackage(null);
        setInstallStatus(null);
        // Clear the chat so the user can describe their changes from a
        // clean slate — the system prompt will now include the source.
        try {
            localStorage.setItem(
                "dash-widget-builder",
                JSON.stringify({ messages: [] })
            );
        } catch {
            /* ignore */
        }
    }, [browsingPackage, detectedCode]);

    // Kick off the registry device-code sign-in flow: open the browser
    // to the verification URL and start polling for the resulting token.
    // When polling succeeds, auto-retry the current registry preview.
    const handleSignInForPreview = useCallback(async () => {
        try {
            const flow = await window.mainApi?.registryAuth?.initiateLogin();
            if (!flow?.deviceCode) {
                throw new Error(
                    "Could not start sign-in flow. Please try again."
                );
            }
            setSignInFlow(flow);
            if (flow.verificationUrlComplete) {
                window.mainApi?.shell?.openExternal?.(
                    flow.verificationUrlComplete
                );
            }
            if (signInPollRef.current) {
                clearInterval(signInPollRef.current);
            }
            const intervalMs = (flow.interval || 5) * 1000;
            signInPollRef.current = setInterval(async () => {
                try {
                    const res = await window.mainApi?.registryAuth?.pollToken(
                        flow.deviceCode
                    );
                    if (res?.status === "authorized") {
                        clearInterval(signInPollRef.current);
                        signInPollRef.current = null;
                        setSignInFlow(null);
                        setPreviewError(null);
                        // Refresh auth status so the Discover "sign in as
                        // guest" banner disappears and any edit-with-AI
                        // ownership checks see the user as logged in.
                        try {
                            const status =
                                await window.mainApi?.registryAuth?.getStatus();
                            if (status?.authenticated) {
                                const profile =
                                    await window.mainApi?.registryAuth?.getProfile();
                                setRegistryUsername(profile?.username || null);
                            }
                        } catch {
                            /* ignore */
                        }
                        // Auto-retry the current registry package
                        if (browsingPackage) {
                            const retry = {
                                name: browsingPackage.packageName,
                                package: browsingPackage.packageName,
                                scope: browsingPackage.scope,
                                displayName: browsingPackage.displayName,
                                description: browsingPackage.description,
                                downloadUrl: browsingPackage.downloadUrl,
                                version: browsingPackage.version,
                                installed: browsingPackage.installed,
                            };
                            handleSelectRegistryPackage(retry);
                        }
                    } else if (res?.status === "expired") {
                        clearInterval(signInPollRef.current);
                        signInPollRef.current = null;
                        setSignInFlow(null);
                        setPreviewError(
                            "Sign-in code expired. Click Sign in to try again."
                        );
                    }
                } catch {
                    /* keep polling */
                }
            }, intervalMs);
        } catch (err) {
            setPreviewError(err?.message || "Could not start sign-in flow.");
        }
    }, [browsingPackage, handleSelectRegistryPackage]);

    useEffect(() => {
        return () => {
            if (signInPollRef.current) {
                clearInterval(signInPollRef.current);
                signInPollRef.current = null;
            }
        };
    }, []);

    // Track in-progress edits (not yet saved/compiled)
    const [editBuffer, setEditBuffer] = useState({
        component: null,
        config: null,
    });
    const hasUnsavedEdits =
        editBuffer.component !== null || editBuffer.config !== null;

    // Handle manual code edits from the Code tab (buffers only, no compile)
    const handleCodeEdit = useCallback(
        (newCode) => {
            manualEditRef.current = true;
            setEditBuffer((prev) => ({
                ...prev,
                [activeFile]: newCode,
            }));
        },
        [activeFile]
    );

    // Save: apply buffered edits and recompile
    const handleSaveEdits = useCallback(() => {
        const updated = {
            componentCode: editBuffer.component ?? detectedCode.componentCode,
            configCode: editBuffer.config ?? detectedCode.configCode,
        };
        setDetectedCode(updated);
        setEditBuffer({ component: null, config: null });
        lastCompiledCode.current = null;
        compilePreview(updated);
    }, [editBuffer, detectedCode, compilePreview]);

    // Cancel: discard buffered edits
    const handleCancelEdits = useCallback(() => {
        setEditBuffer({ component: null, config: null });
        manualEditRef.current = false;
    }, []);

    const handleInstall = useCallback(
        async (opts = {}) => {
            if (!detectedCode.componentCode || !widgetName) return;
            // Category is required — install button is disabled until picked, but
            // guard here too in case this is invoked programmatically.
            if (!selectedCategory) return;

            // Determine install name based on edit mode:
            //   "update" → keep original name (overwrites source in-place)
            //   "remix"  → use the user-chosen remix name (new package)
            let installName = widgetName;
            let installComponentCode = detectedCode.componentCode;
            if (
                isRemixMode &&
                editMode === "remix" &&
                remixName &&
                remixName !== widgetName
            ) {
                installName = remixName;
                // Rename the export in the source code
                installComponentCode = installComponentCode.replace(
                    new RegExp(
                        `(export\\s+default\\s+function\\s+)${widgetName}\\b`
                    ),
                    `$1${installName}`
                );
            }

            // Slice 17d.2 — install-time permission gate. When the
            // widget calls credentialed provider methods, pause here
            // and let the user decide which calls to grant. The modal
            // calls back into handleInstall with `opts.skipPermissionGate`
            // once the user has decided.
            if (!opts.skipPermissionGate) {
                const calls = scanCredentialMethodCalls(installComponentCode);
                if (calls.length > 0) {
                    const packageName = `@ai-built/${installName.toLowerCase()}`;
                    setPendingInstallContext({ packageName, calls });
                    return;
                }
            }

            setInstallStatus("installing");
            try {
                // Build remix metadata when creating a new copy
                const remixMeta =
                    isRemixMode && editMode === "remix"
                        ? {
                              remixedFrom: {
                                  package:
                                      effectiveEditContext.originalPackage ||
                                      "unknown",
                                  component:
                                      effectiveEditContext.originalComponentName ||
                                      "unknown",
                                  author:
                                      effectiveEditContext.manifest?.author ||
                                      "Unknown",
                                  version:
                                      effectiveEditContext.manifest?.version ||
                                      "1.0.0",
                              },
                          }
                        : null;

                // Build the final configCode with the user-selected category baked in.
                // Two paths:
                //  - AI generated its own config → inject/replace `category` via regex
                //  - No config from AI → use the default template, interpolating category
                let finalConfigCode;
                if (detectedCode.configCode) {
                    finalConfigCode = injectCategoryIntoConfigCode(
                        detectedCode.configCode,
                        selectedCategory
                    );
                    finalConfigCode =
                        dedupProvidersInConfigCode(finalConfigCode);
                    // Update the component reference in config to match the rename
                    if (installName !== widgetName) {
                        finalConfigCode = finalConfigCode.replace(
                            new RegExp(
                                `(component\\s*:\\s*["'])${widgetName}(["'])`,
                                "g"
                            ),
                            `$1${installName}$2`
                        );
                    }
                } else {
                    // Same synthesizer the message-poller uses, with the
                    // user-picked category baked in. Picker selection drives
                    // the providers array.
                    finalConfigCode = synthesizeDefaultConfigCode(
                        installName,
                        selectedProviderForBuild
                    );
                    finalConfigCode = injectCategoryIntoConfigCode(
                        finalConfigCode,
                        selectedCategory
                    );
                }

                // Build the final multi-file payload. Start from the
                // detected files[] (which may contain sibling utilities)
                // and replace the primary widget's component + config with
                // the post-processed strings (category injected, rename
                // applied). For legacy two-block responses where files[]
                // was synthesized from componentCode+configCode, this just
                // overwrites the same two entries we already had.
                const finalFiles = (() => {
                    const out = [];
                    const primaryComponentPath = `widgets/${installName}.js`;
                    const primaryConfigPath = `widgets/${installName}.dash.js`;
                    const detectedFiles = Array.isArray(detectedCode.files)
                        ? detectedCode.files
                        : [];
                    let wroteComponent = false;
                    let wroteConfig = false;

                    for (const f of detectedFiles) {
                        if (!f?.path || f.content == null) continue;
                        const isPrimaryConfig =
                            f.path.endsWith(".dash.js") &&
                            !wroteConfig &&
                            // Match either the original or the renamed widget
                            (f.path === primaryConfigPath ||
                                f.path === `widgets/${widgetName}.dash.js`);
                        const isPrimaryComponent =
                            !isPrimaryConfig &&
                            !f.path.endsWith(".dash.js") &&
                            !wroteComponent &&
                            (f.path === primaryComponentPath ||
                                f.path === `widgets/${widgetName}.js` ||
                                f.path === `widgets/${widgetName}.jsx`);
                        if (isPrimaryConfig) {
                            out.push({
                                path: primaryConfigPath,
                                content: finalConfigCode,
                            });
                            wroteConfig = true;
                        } else if (isPrimaryComponent) {
                            out.push({
                                path: primaryComponentPath,
                                content: installComponentCode,
                            });
                            wroteComponent = true;
                        } else {
                            out.push({ path: f.path, content: f.content });
                        }
                    }

                    if (!wroteComponent) {
                        out.push({
                            path: primaryComponentPath,
                            content: installComponentCode,
                        });
                    }
                    if (!wroteConfig) {
                        out.push({
                            path: primaryConfigPath,
                            content: finalConfigCode,
                        });
                    }
                    return out;
                })();

                const result = await window.mainApi?.widgetBuilder?.aiBuild(
                    installName,
                    installComponentCode,
                    finalConfigCode,
                    `AI-generated widget: ${installName}`,
                    cellContext || null,
                    process.env.REACT_APP_IDENTIFIER || "@trops/dash-electron",
                    remixMeta,
                    finalFiles,
                    // Provider the user pre-selected — main process
                    // auto-corrects any drift in the AI's config to match.
                    selectedProviderForBuild
                );
                if (result?.success) {
                    // The widget is now installed — its draft is no longer
                    // useful and shouldn't clutter the Drafts list.
                    const sessionId = draftSessionIdRef.current;
                    if (sessionId) {
                        try {
                            await window.mainApi?.drafts?.delete?.(sessionId);
                        } catch {
                            /* ignore */
                        }
                        draftSessionIdRef.current = null;
                        resumedDraftRef.current = null;
                    }
                    setInstallStatus({
                        success: true,
                        widgetName: result.widgetName,
                    });
                    if (onInstalled) {
                        // Pass the canonical scoped component id (e.g.
                        // "ai-built.mywidget.MyWidget") — that's the key
                        // ComponentManager registers under post-v0.1.432
                        // and the cell-placement handler expects. Passing
                        // the bare component name lands a layout item
                        // whose `component:` field doesn't resolve via the
                        // render-path lookups, so the new widget silently
                        // doesn't appear on the dashboard. The registry-
                        // install path was fixed for this in ca166ff; the
                        // AI-build path was missed.
                        const scopedRegistryId = result.widgetName
                            ? makeScopedComponentId(
                                  result.widgetName,
                                  installName
                              )
                            : installName;
                        onInstalled(scopedRegistryId, result.widgetName);
                    }
                } else {
                    setInstallStatus({
                        error: result?.error || "Install failed",
                    });
                }
            } catch (err) {
                setInstallStatus({ error: err.message });
            }
        },
        [
            detectedCode,
            widgetName,
            selectedCategory,
            onInstalled,
            cellContext,
            effectiveEditContext,
            isRemixMode,
            editMode,
            remixName,
            selectedProviderForBuild,
        ]
    );

    // Slice 17d.2 — install-time permission confirm/cancel handlers.
    // The user opens the modal by clicking "Install Widget" when
    // the widget makes credentialed calls. After they choose grants
    // and click confirm, we persist via the localStorage-backed
    // grants store (see widgetCredentialGrants.js) and re-enter
    // handleInstall with `skipPermissionGate: true` to actually
    // install. Cancel clears the pending state and returns the
    // user to the build view.
    const handlePermissionConfirm = useCallback(
        (grants) => {
            const ctx = pendingInstallContext;
            if (!ctx) return;
            try {
                setCredentialGrants(ctx.packageName, grants);
            } catch {
                // localStorage failure is silent — proceed anyway.
                // Future runtime gate (slice 17d.3) will re-prompt.
            }
            setPendingInstallContext(null);
            // Resume install — the gate is now satisfied for this run.
            handleInstall({ skipPermissionGate: true });
        },
        [pendingInstallContext, handleInstall]
    );

    const handlePermissionCancel = useCallback(() => {
        setPendingInstallContext(null);
        setInstallStatus(null);
    }, []);

    // Slice 17c.7 — the inline empty-render detector that read
    // previewWrapperRef.current.textContent has been removed. With
    // the iframe preview as the only path, the iframe shell measures
    // its own DOM after each render commit and posts
    // `bridge:render-stats`, which the host's
    // `handleIframeRenderStats` callback turns into the same
    // `setPreviewLooksEmpty(...)` flip. Cross-document text
    // measurement isn't needed anymore. Reset on each fresh compile
    // happens inside the compile success path.

    if (!isOpen) return null;

    const PreviewComponent = previewComponent;
    const displayName =
        widgetName?.replace(/([A-Z])/g, " $1").trim() || "Widget";

    return (
        <Modal
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            width="w-11/12"
            height="h-5/6"
        >
            {/* e2e anchor — `data-testid="widget-builder-modal"` lets the
                Playwright spec wait for the modal to be in the DOM after
                dispatching `dash:open-widget-builder`. Bound to a wrapper
                div instead of `<Modal>` because dash-react's Modal does
                not forward arbitrary HTML attributes to its root. */}
            <div data-testid="widget-builder-modal" className="contents"></div>
            {/* Header */}
            <div
                className={`flex items-center justify-between px-4 py-3 border-b ${borderColor} ${bgDark} shrink-0`}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <FontAwesomeIcon
                        icon="wand-magic-sparkles"
                        className="h-4 w-4 text-indigo-400 shrink-0"
                    />
                    <span className="text-base font-semibold text-gray-100 shrink-0">
                        {isRemixMode
                            ? "Edit Widget with AI"
                            : "Build Widget with AI"}
                    </span>
                    {/* Widget identity subtitle — shown only in edit
                        mode so the user can see which widget they're
                        editing without having to look at the footer's
                        "Installs to …" line. originalComponentName
                        carries the full scoped ID
                        (e.g. "ai-built.composedwidget3.ComposedWidget3"),
                        which is the canonical identifier the user
                        recognizes from their dashboard layout. */}
                    {isRemixMode &&
                        effectiveEditContext?.originalComponentName && (
                            <>
                                <span className="text-gray-500 shrink-0">
                                    —
                                </span>
                                <code
                                    className="text-xs text-indigo-300 font-mono truncate"
                                    title={
                                        effectiveEditContext.originalComponentName
                                    }
                                >
                                    {effectiveEditContext.originalComponentName}
                                </code>
                            </>
                        )}
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 rounded hover:bg-white/10 transition-colors text-gray-400"
                >
                    <FontAwesomeIcon icon="times" className="h-4 w-4" />
                </button>
            </div>

            {/* Health-check banner — only renders when something is
                actually broken. Kept above the split pane so it's
                visible regardless of which tab the user is on. */}
            {healthCheckIssues.length > 0 && (
                <div className="flex flex-col gap-1 px-4 py-2 bg-amber-900/20 border-b border-amber-700/30 shrink-0">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                        <FontAwesomeIcon
                            icon="triangle-exclamation"
                            className="h-3 w-3"
                        />
                        AI Assistant setup issue
                        {healthCheckIssues.length > 1
                            ? ` (${healthCheckIssues.length})`
                            : ""}
                    </div>
                    {healthCheckIssues.map((issue, idx) => (
                        <div
                            key={idx}
                            className="text-xs text-amber-200/80 pl-5"
                        >
                            <span className="font-medium">{issue.label}:</span>{" "}
                            {issue.detail}
                        </div>
                    ))}
                </div>
            )}

            {/* Loading sentinel — viewMode is null while the async drafts
                check resolves on open. Without this, the previous viewMode's
                content briefly flashes before the gate decides between
                "drafts" and "builder". */}
            {viewMode === null && (
                <div className="flex-1 min-h-0 flex items-center justify-center text-sm text-gray-400">
                    Loading…
                </div>
            )}

            {/* Drafts entry view — shown on open when the user has
                unfinished widgets from prior sessions. Resume restores
                state into the builder; Build New jumps straight in. */}
            {viewMode === "drafts" && (
                <div className="flex-1 min-h-0 overflow-hidden">
                    <WidgetDraftsList
                        onInstalled={(scopedRegistryId, componentName) => {
                            // Hand off to the modal's normal post-install
                            // flow so the dashboard picks up the new
                            // widget. Same callback the modal's "Install"
                            // button uses after a fresh AI build.
                            if (typeof onInstalled === "function") {
                                onInstalled(scopedRegistryId, componentName);
                            }
                            setIsOpen(false);
                        }}
                        onOpenedInEditor={() => {
                            // Editor handoff is a clean break — close
                            // the modal so the in-pane editor doesn't
                            // get out of sync with whatever the user
                            // does in VS Code. They can reopen and
                            // Install from the drafts list later.
                            setIsOpen(false);
                        }}
                        onStartNew={() => {
                            draftSessionIdRef.current = null;
                            resumedDraftRef.current = null;
                            // Clear ChatCore's persisted history so the
                            // new build starts fresh.
                            try {
                                localStorage.setItem(
                                    "dash-widget-builder",
                                    JSON.stringify({ messages: [] })
                                );
                            } catch {
                                /* ignore */
                            }
                            setDetectedCode({
                                componentCode: null,
                                configCode: null,
                                files: [],
                            });
                            setPreviewComponent(null);
                            setPreviewError(null);
                            setInstallStatus(null);
                            setSelectedProviderForBuild(null);
                            // Reset compose-mode state so a fresh
                            // session doesn't inherit the tree from
                            // whatever was last loaded.
                            setComposerInitialTree(null);
                            setComposerTree(null);
                            setComposerSessionKey((k) => k + 1);
                            setViewMode("builder");
                        }}
                        onResume={async (draft) => {
                            // For v2 (disk-backed) drafts the list row
                            // doesn't carry componentCode/configCode —
                            // fetch the full draft via drafts.get which
                            // folds disk-read code into the response.
                            // Falls back to the row data for legacy v1
                            // drafts that still have JSON-stored code.
                            let full = draft;
                            try {
                                const fetched =
                                    await window.mainApi?.drafts?.get?.(
                                        draft.id
                                    );
                                if (fetched) full = fetched;
                            } catch {
                                /* ignore — use list-row fallback */
                            }
                            // Reuse the draft id so subsequent saves
                            // update this row instead of creating a new
                            // one.
                            resumedDraftRef.current = full;
                            draftSessionIdRef.current = full.id;
                            // Restore chat history into ChatCore's
                            // persistKey so the conversation reappears.
                            try {
                                localStorage.setItem(
                                    "dash-widget-builder",
                                    JSON.stringify({
                                        messages: Array.isArray(
                                            full.chatHistory
                                        )
                                            ? full.chatHistory
                                            : [],
                                    })
                                );
                            } catch {
                                /* ignore */
                            }
                            // Restore the latest code so the preview +
                            // editor pick up where the user left off.
                            const restoredCode = {
                                componentCode: full.componentCode || null,
                                configCode: full.configCode || null,
                                files: Array.isArray(full.files)
                                    ? full.files
                                    : [],
                            };
                            setDetectedCode(restoredCode);
                            // Compile the restored code so the Preview
                            // tab actually renders instead of showing
                            // the empty placeholder from modal open.
                            // Mirrors the remix/editContext useEffect
                            // a few hundred lines up — drafts went
                            // through setDetectedCode but never
                            // through the compile pipeline, so the
                            // preview stayed blank until the user
                            // typed a new message (chat) or edited
                            // the code tab manually.
                            if (restoredCode.componentCode) {
                                compilePreview(restoredCode).catch(() => {});
                            }
                            // Restore the picked provider so the chat
                            // gate doesn't reappear and the post-process
                            // auto-correct stays consistent.
                            if (full.pickedProvider !== undefined) {
                                setSelectedProviderForBuild(
                                    full.pickedProvider
                                );
                            }
                            // Restore compose mode + the saved
                            // composer tree so the user picks up
                            // exactly where they left off (palette,
                            // selected node, wires, field maps).
                            // composerSessionKey bump forces the
                            // pane to remount with the new initial
                            // tree — useState wouldn't otherwise pick
                            // up the change after the first mount.
                            if (full.composerTree) {
                                setComposerInitialTree(full.composerTree);
                                setComposerTree(full.composerTree);
                                setComposerSessionKey((k) => k + 1);
                            }
                            if (full.chatMode) {
                                setChatMode(full.chatMode);
                            }
                            setInstallStatus(null);
                            setViewMode("builder");
                        }}
                    />
                </div>
            )}

            {/* Split pane */}
            {viewMode === "builder" && (
                <div className={`flex flex-row flex-1 min-h-0 ${bgDark}`}>
                    {/* Left: Live Preview (2/3) */}
                    <div className="flex flex-col flex-[2] min-w-0 min-h-0 overflow-hidden">
                        {/* Tab bar */}
                        <div
                            className={`flex items-center justify-between px-2 py-1.5 border-b ${borderColor} shrink-0`}
                        >
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setActiveTab("preview")}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors ${
                                        activeTab === "preview"
                                            ? "bg-indigo-600/20 text-indigo-300"
                                            : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                                    }`}
                                >
                                    <FontAwesomeIcon
                                        icon="eye"
                                        className="h-2.5 w-2.5"
                                    />
                                    Preview
                                </button>
                                <button
                                    onClick={() => setActiveTab("code")}
                                    disabled={!detectedCode.componentCode}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors ${
                                        activeTab === "code"
                                            ? "bg-indigo-600/20 text-indigo-300"
                                            : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                                    } ${
                                        !detectedCode.componentCode
                                            ? "opacity-30 cursor-not-allowed"
                                            : ""
                                    }`}
                                >
                                    <FontAwesomeIcon
                                        icon="code"
                                        className="h-2.5 w-2.5"
                                    />
                                    Code
                                </button>
                                <button
                                    onClick={() => setActiveTab("configure")}
                                    disabled={!detectedCode.componentCode}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors ${
                                        activeTab === "configure"
                                            ? "bg-indigo-600/20 text-indigo-300"
                                            : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                                    } ${
                                        !detectedCode.componentCode
                                            ? "opacity-30 cursor-not-allowed"
                                            : ""
                                    }`}
                                >
                                    <FontAwesomeIcon
                                        icon="cog"
                                        className="h-2.5 w-2.5"
                                    />
                                    Configure
                                </button>
                                <button
                                    onClick={() => setActiveTab("console")}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors ${
                                        activeTab === "console"
                                            ? "bg-indigo-600/20 text-indigo-300"
                                            : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                                    }`}
                                    data-testid="tab-console"
                                >
                                    <FontAwesomeIcon
                                        icon="terminal"
                                        className="h-2.5 w-2.5"
                                    />
                                    Console
                                    {consoleEvents.some(
                                        (e) => e.severity === "error"
                                    ) && (
                                        <span
                                            className="ml-1 px-1 rounded bg-red-700 text-red-100 text-[10px]"
                                            title="Error in widget output"
                                        >
                                            {
                                                consoleEvents.filter(
                                                    (e) =>
                                                        e.severity === "error"
                                                ).length
                                            }
                                        </span>
                                    )}
                                </button>
                                {chatMode === "build" && (
                                    <button
                                        onClick={() =>
                                            setActiveTab("scorecard")
                                        }
                                        disabled={!detectedCode.componentCode}
                                        className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-colors ${
                                            activeTab === "scorecard"
                                                ? "bg-indigo-600/20 text-indigo-300"
                                                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                                        } ${
                                            !detectedCode.componentCode
                                                ? "opacity-30 cursor-not-allowed"
                                                : ""
                                        }`}
                                        data-testid="tab-scorecard"
                                        title="Cohesion-rule checklist for the generated widget"
                                    >
                                        <FontAwesomeIcon
                                            icon="circle-check"
                                            className="h-2.5 w-2.5"
                                        />
                                        Scorecard
                                        {scorecardFailCount > 0 && (
                                            <span
                                                className="ml-1 px-1 rounded bg-rose-700 text-rose-100 text-[10px]"
                                                title={`${scorecardFailCount} cohesion rule${
                                                    scorecardFailCount === 1
                                                        ? ""
                                                        : "s"
                                                } failing`}
                                            >
                                                {scorecardFailCount}
                                            </span>
                                        )}
                                    </button>
                                )}
                            </div>
                            {isCompiling && (
                                <div className="flex items-center gap-1.5 text-xs text-indigo-400">
                                    <span className="inline-flex gap-0.5">
                                        <span
                                            className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                                            style={{ animationDelay: "0ms" }}
                                        />
                                        <span
                                            className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                                            style={{ animationDelay: "150ms" }}
                                        />
                                        <span
                                            className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
                                            style={{ animationDelay: "300ms" }}
                                        />
                                    </span>
                                    Compiling...
                                </div>
                            )}
                            {installStatus?.success && (
                                <span className="text-xs text-green-400 flex items-center gap-1">
                                    <FontAwesomeIcon
                                        icon="check-circle"
                                        className="h-3 w-3"
                                    />
                                    {isRemixMode
                                        ? "Remixed as"
                                        : "Installed as"}{" "}
                                    {installStatus.widgetName}
                                </span>
                            )}
                            {/* Slice 17b: provider auto-correct surface.
                                Main process snaps the AI's declared
                                providerClass to whatever the user has
                                installed; this banner explains why the
                                preview's providers section may differ
                                from what the AI emitted. */}
                            {providerCorrection && !previewError && (
                                <span
                                    className="text-xs text-amber-300 flex items-center gap-1"
                                    title={providerCorrection.reason || ""}
                                >
                                    <FontAwesomeIcon
                                        icon="wrench"
                                        className="h-3 w-3"
                                    />
                                    Provider config auto-corrected to match your
                                    installed provider
                                </span>
                            )}
                            {/* Right-side draft toolbar — Open in Editor +
                                Save Draft + save status. Visible once
                                the AI has emitted code AND we're in
                                build mode (not remix). Lives in the
                                tab bar row so the user can act on
                                their in-flight draft without leaving
                                the modal to find the drafts list. */}
                            {detectedCode.componentCode &&
                                !effectiveEditContext &&
                                draftSessionIdRef.current && (
                                    <div className="ml-auto flex items-center gap-2">
                                        {editorOpenError && (
                                            <span className="text-xs text-red-300 max-w-xs truncate">
                                                {editorOpenError}
                                            </span>
                                        )}
                                        <span className="text-xs text-gray-400">
                                            {draftSaveState === "saving"
                                                ? "Saving draft…"
                                                : draftSaveState === "error"
                                                ? "Save failed"
                                                : draftLastSavedAt
                                                ? `Draft saved ${Math.max(
                                                      0,
                                                      Math.round(
                                                          (Date.now() -
                                                              draftLastSavedAt) /
                                                              1000
                                                      )
                                                  )}s ago`
                                                : ""}
                                        </span>
                                        <button
                                            onClick={() => {
                                                // Re-fire the auto-save
                                                // effect by re-setting
                                                // detectedCode to its
                                                // current value. The
                                                // useEffect deps include
                                                // componentCode/configCode/
                                                // files (by reference) so a
                                                // new object identity is
                                                // enough to retrigger.
                                                setDetectedCode((prev) => ({
                                                    ...prev,
                                                }));
                                            }}
                                            disabled={
                                                draftSaveState === "saving"
                                            }
                                            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                                                draftSaveState === "saving"
                                                    ? "bg-blue-900 text-blue-300 cursor-wait"
                                                    : "bg-blue-700 hover:bg-blue-600 text-blue-100"
                                            }`}
                                            title="Force a draft save now"
                                            data-testid="builder-save-draft"
                                        >
                                            <FontAwesomeIcon
                                                icon="save"
                                                className="h-2.5 w-2.5"
                                            />
                                            Save Draft
                                        </button>
                                        <button
                                            onClick={async () => {
                                                const id =
                                                    draftSessionIdRef.current;
                                                if (!id) return;
                                                setOpeningEditor(true);
                                                setEditorOpenError(null);
                                                try {
                                                    const result =
                                                        await window.mainApi?.drafts?.openInEditor?.(
                                                            id
                                                        );
                                                    if (!result?.success) {
                                                        setEditorOpenError(
                                                            result?.error ||
                                                                "Couldn't open the editor"
                                                        );
                                                    } else {
                                                        // Clean break — user
                                                        // is now editing in
                                                        // VS Code. The
                                                        // in-pane editor
                                                        // would drift, so
                                                        // close.
                                                        setIsOpen(false);
                                                    }
                                                } catch (err) {
                                                    setEditorOpenError(
                                                        err?.message ||
                                                            String(err)
                                                    );
                                                } finally {
                                                    setOpeningEditor(false);
                                                }
                                            }}
                                            disabled={openingEditor}
                                            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                                                openingEditor
                                                    ? "bg-indigo-900 text-indigo-300 cursor-wait"
                                                    : "bg-indigo-700 hover:bg-indigo-600 text-indigo-100"
                                            }`}
                                            title="Open this widget's package directory in your editor (VS Code if installed)"
                                            data-testid="builder-open-editor"
                                        >
                                            <FontAwesomeIcon
                                                icon="up-right-from-square"
                                                className="h-2.5 w-2.5"
                                            />
                                            {openingEditor
                                                ? "Opening…"
                                                : "Open in editor"}
                                        </button>
                                    </div>
                                )}
                        </div>

                        {/* Preview content (visible when Preview tab is active) */}
                        {activeTab === "preview" && (
                            <div className="flex-1 overflow-auto p-4">
                                {/* Source unavailable error (widget needs re-publish) */}
                                {effectiveEditContext?.sourceError &&
                                    !previewComponent &&
                                    !previewError &&
                                    !isCompiling && (
                                        <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                                            <div className="w-16 h-16 rounded-2xl bg-amber-900/30 border border-amber-700/30 flex items-center justify-center">
                                                <FontAwesomeIcon
                                                    icon="exclamation-triangle"
                                                    className="h-7 w-7 text-amber-400/60"
                                                />
                                            </div>
                                            <div className="space-y-2 max-w-md">
                                                <p className="text-sm font-medium text-gray-300">
                                                    Can't load widget source
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {effectiveEditContext.originalComponentName
                                                        ? `"${effectiveEditContext.originalComponentName}" `
                                                        : "This widget "}
                                                    source couldn't be read. Try
                                                    re-publishing the widget
                                                    package with source files
                                                    included, or generate a
                                                    fresh widget below.
                                                </p>
                                                {effectiveEditContext.originalPackage && (
                                                    <p className="text-[10px] text-gray-600 font-mono">
                                                        package:{" "}
                                                        {
                                                            effectiveEditContext.originalPackage
                                                        }
                                                    </p>
                                                )}
                                                <p className="text-[10px] text-gray-600 font-mono break-words">
                                                    reason:{" "}
                                                    {
                                                        effectiveEditContext.sourceError
                                                    }
                                                </p>
                                                <p className="text-xs text-gray-600 mt-2">
                                                    You can still describe a new
                                                    widget from scratch using
                                                    the chat.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                {/* Empty state: Discover cards grid OR
                                "Describe your widget" prompt for Build mode. */}
                                {!previewComponent &&
                                    !previewError &&
                                    !isCompiling &&
                                    !effectiveEditContext?.sourceError &&
                                    (() => {
                                        const hasDiscoverActivity =
                                            discoverSearching ||
                                            discoverResults.length > 0 ||
                                            !!lastDiscoverQueryRef.current;
                                        if (hasDiscoverActivity) {
                                            return (
                                                <div className="flex flex-col h-full">
                                                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-800/60">
                                                        <div className="flex items-baseline gap-2 min-w-0">
                                                            <span className="text-sm font-semibold text-gray-200">
                                                                {discoverSearching
                                                                    ? "Searching registry..."
                                                                    : `${
                                                                          discoverResults.length
                                                                      } match${
                                                                          discoverResults.length ===
                                                                          1
                                                                              ? ""
                                                                              : "es"
                                                                      }`}
                                                            </span>
                                                            {lastDiscoverQueryRef.current && (
                                                                <span className="text-xs text-gray-500 truncate">
                                                                    for “
                                                                    {
                                                                        lastDiscoverQueryRef.current
                                                                    }
                                                                    ”
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] uppercase tracking-wide text-gray-500 shrink-0">
                                                            Click a widget to
                                                            preview
                                                        </span>
                                                    </div>
                                                    {/* Sign-in nudge: the
                                                    registry only returns
                                                    public packages to
                                                    anonymous users, so
                                                    missing private/entitled
                                                    widgets can be surfaced
                                                    with one click. */}
                                                    {registryChecked &&
                                                        !registryUsername && (
                                                            <div className="mt-2 flex items-center gap-3 px-3 py-2 rounded-lg bg-amber-900/15 border border-amber-700/30">
                                                                <p className="flex-1 text-xs text-amber-200 leading-snug">
                                                                    You're
                                                                    browsing as
                                                                    a guest —
                                                                    sign in to
                                                                    also see
                                                                    private
                                                                    widgets you
                                                                    own or have
                                                                    access to.
                                                                </p>
                                                                <button
                                                                    type="button"
                                                                    onClick={
                                                                        handleSignInForPreview
                                                                    }
                                                                    className="px-3 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 transition-colors"
                                                                >
                                                                    Sign in
                                                                </button>
                                                            </div>
                                                        )}
                                                    {!discoverSearching &&
                                                        discoverResults.length ===
                                                            0 && (
                                                            <div className="flex-1 flex items-center justify-center text-center text-sm text-gray-500 px-6">
                                                                No registry
                                                                widgets matched
                                                                “
                                                                {
                                                                    lastDiscoverQueryRef.current
                                                                }
                                                                ”. Try different
                                                                keywords, or
                                                                switch to Build
                                                                mode to generate
                                                                one.
                                                            </div>
                                                        )}
                                                    {discoverResults.length >
                                                        0 && (
                                                        <div className="flex-1 overflow-auto pt-3">
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                {discoverResults.map(
                                                                    (pkg) => (
                                                                        <button
                                                                            key={`${
                                                                                pkg.scope ||
                                                                                ""
                                                                            }/${
                                                                                pkg.name
                                                                            }`}
                                                                            onClick={() =>
                                                                                handleSelectRegistryPackage(
                                                                                    pkg
                                                                                )
                                                                            }
                                                                            className="group text-left rounded-lg border border-gray-700/60 bg-gray-800/40 hover:bg-gray-800/80 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-950/50 p-4 transition-all cursor-pointer"
                                                                        >
                                                                            <div className="flex items-start justify-between gap-2 mb-1.5">
                                                                                <div className="font-semibold text-sm text-gray-200 truncate group-hover:text-indigo-200">
                                                                                    {pkg.displayName ||
                                                                                        pkg.name}
                                                                                </div>
                                                                                {pkg.installed && (
                                                                                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide bg-green-900/40 text-green-300 border border-green-700/40">
                                                                                        Installed
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className="text-[11px] text-gray-500 truncate font-mono mb-2">
                                                                                {pkg.scope
                                                                                    ? `@${pkg.scope.replace(
                                                                                          /^@/,
                                                                                          ""
                                                                                      )}/${
                                                                                          pkg.package ||
                                                                                          pkg.name
                                                                                      }`
                                                                                    : pkg.package ||
                                                                                      pkg.name}
                                                                            </div>
                                                                            {pkg.description && (
                                                                                <div
                                                                                    className="text-xs text-gray-400 overflow-hidden leading-relaxed"
                                                                                    style={{
                                                                                        display:
                                                                                            "-webkit-box",
                                                                                        WebkitLineClamp: 3,
                                                                                        WebkitBoxOrient:
                                                                                            "vertical",
                                                                                    }}
                                                                                >
                                                                                    {
                                                                                        pkg.description
                                                                                    }
                                                                                </div>
                                                                            )}
                                                                            <div className="mt-3 text-[10px] uppercase tracking-wide text-indigo-400/60 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                Click
                                                                                to
                                                                                preview
                                                                                →
                                                                            </div>
                                                                        </button>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return (
                                            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                                                <div className="w-16 h-16 rounded-2xl bg-gray-800/80 border border-gray-700/30 flex items-center justify-center">
                                                    <FontAwesomeIcon
                                                        icon="wand-magic-sparkles"
                                                        className="h-7 w-7 text-indigo-400/40"
                                                    />
                                                </div>
                                                <div className="space-y-2 max-w-sm">
                                                    <p className="text-sm font-medium text-gray-300">
                                                        {chatMode === "discover"
                                                            ? "Search the registry"
                                                            : "Describe your widget"}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {chatMode === "discover"
                                                            ? "Tell the AI what kind of widget you're looking for and registry matches will appear here."
                                                            : "The AI will generate code and a live preview will appear here automatically."}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                {/* Auth-gated preview: friendlier than a red error */}
                                {previewError &&
                                    /authentic|unauth|401|sign.?in/i.test(
                                        previewError
                                    ) && (
                                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                                            <div className="w-full max-w-lg rounded-lg border border-amber-700/30 bg-amber-900/10 p-4 space-y-3">
                                                <div className="flex items-center gap-2 text-amber-300 text-sm font-medium">
                                                    <FontAwesomeIcon
                                                        icon="lock"
                                                        className="h-4 w-4"
                                                    />
                                                    Sign in to preview
                                                </div>
                                                <p className="text-xs text-amber-100/80 leading-relaxed">
                                                    The registry requires
                                                    sign-in to download this
                                                    package. Click below to open
                                                    the sign-in page in your
                                                    browser.
                                                </p>
                                                {signInFlow ? (
                                                    <div className="space-y-2">
                                                        <p className="text-xs text-amber-100/90">
                                                            A browser tab should
                                                            have opened. Verify
                                                            the code there
                                                            matches:
                                                        </p>
                                                        <div className="font-mono text-lg tracking-widest text-amber-200 bg-black/30 rounded px-3 py-2 text-center select-all">
                                                            {signInFlow.userCode ||
                                                                "—"}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[11px] text-amber-200/70">
                                                            <span className="inline-flex gap-0.5">
                                                                <span
                                                                    className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce"
                                                                    style={{
                                                                        animationDelay:
                                                                            "0ms",
                                                                    }}
                                                                />
                                                                <span
                                                                    className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce"
                                                                    style={{
                                                                        animationDelay:
                                                                            "150ms",
                                                                    }}
                                                                />
                                                                <span
                                                                    className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce"
                                                                    style={{
                                                                        animationDelay:
                                                                            "300ms",
                                                                    }}
                                                                />
                                                            </span>
                                                            Waiting for sign-in…
                                                            we'll retry
                                                            automatically.
                                                        </div>
                                                        {signInFlow.verificationUrlComplete && (
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    window.mainApi?.shell?.openExternal?.(
                                                                        signInFlow.verificationUrlComplete
                                                                    )
                                                                }
                                                                className="text-xs text-indigo-300 hover:text-indigo-200 underline"
                                                            >
                                                                Reopen sign-in
                                                                page
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={
                                                            handleSignInForPreview
                                                        }
                                                        className="px-3 py-1.5 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                                                    >
                                                        Sign in
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                {/* Compile error (non-auth) */}
                                {previewError &&
                                    !/authentic|unauth|401|sign.?in/i.test(
                                        previewError
                                    ) && (
                                        <div className="flex flex-col items-center justify-center h-full space-y-4">
                                            <div className="w-full max-w-lg rounded-lg border border-red-700/30 bg-red-900/10 p-4 space-y-2">
                                                <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
                                                    <FontAwesomeIcon
                                                        icon="exclamation-circle"
                                                        className="h-4 w-4"
                                                    />
                                                    {previewErrorMeta?.code ===
                                                    "ESBUILD_SPAWN_FAILED"
                                                        ? "Widget compiler unavailable"
                                                        : "Compilation Error"}
                                                </div>
                                                <pre className="text-xs text-red-300/70 bg-black/20 rounded p-2 overflow-auto max-h-32">
                                                    {previewError}
                                                </pre>
                                                {/* Slice 17b: pretty-print esbuild's
                                                    structured errors so users see line
                                                    numbers + the offending source line
                                                    instead of bare "SyntaxError: ...". */}
                                                {Array.isArray(
                                                    previewErrorMeta
                                                        ?.diagnostics?.esbuild
                                                ) &&
                                                    previewErrorMeta.diagnostics
                                                        .esbuild.length > 0 && (
                                                        <div className="text-xs space-y-2">
                                                            {previewErrorMeta.diagnostics.esbuild.map(
                                                                (e, idx) => (
                                                                    <div
                                                                        key={
                                                                            idx
                                                                        }
                                                                        className="bg-black/30 rounded p-2 space-y-1"
                                                                    >
                                                                        <div className="text-red-300 font-medium">
                                                                            {e
                                                                                .location
                                                                                ?.file &&
                                                                                e.location.file
                                                                                    .split(
                                                                                        "/"
                                                                                    )
                                                                                    .pop()}
                                                                            {e
                                                                                .location
                                                                                ?.line
                                                                                ? `:${
                                                                                      e
                                                                                          .location
                                                                                          .line
                                                                                  }${
                                                                                      e
                                                                                          .location
                                                                                          .column
                                                                                          ? ":" +
                                                                                            e
                                                                                                .location
                                                                                                .column
                                                                                          : ""
                                                                                  }`
                                                                                : ""}
                                                                            {e
                                                                                .location
                                                                                ?.line
                                                                                ? "  "
                                                                                : ""}
                                                                            {
                                                                                e.text
                                                                            }
                                                                        </div>
                                                                        {e
                                                                            .location
                                                                            ?.lineText && (
                                                                            <pre className="text-[11px] text-red-200/70 bg-black/30 rounded px-2 py-1 overflow-x-auto whitespace-pre">
                                                                                {
                                                                                    e
                                                                                        .location
                                                                                        .lineText
                                                                                }
                                                                            </pre>
                                                                        )}
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                {/* Slice 17b: heuristic hint for the
                                                    common "AI emitted utility imports
                                                    but no File: markers" failure. */}
                                                {/Could not resolve|cannot find module/i.test(
                                                    previewError || ""
                                                ) && (
                                                    <div className="text-xs text-amber-300/90 bg-amber-900/10 border border-amber-700/30 rounded p-2">
                                                        This widget references
                                                        files that weren't
                                                        included in the AI's
                                                        response. Ask the AI to
                                                        emit every imported file
                                                        as a separate{" "}
                                                        <code>File:</code>{" "}
                                                        marker (e.g.{" "}
                                                        <code>
                                                            File:
                                                            widgets/utils.js
                                                        </code>
                                                        ).
                                                    </div>
                                                )}
                                                {previewErrorMeta?.diagnostics && (
                                                    <details className="text-xs text-red-300/70 bg-black/20 rounded p-2 overflow-auto">
                                                        <summary className="cursor-pointer text-red-400 select-none">
                                                            Diagnostics — share
                                                            this if you report a
                                                            bug
                                                        </summary>
                                                        <pre className="mt-2 whitespace-pre-wrap break-all">
                                                            {JSON.stringify(
                                                                previewErrorMeta.diagnostics,
                                                                null,
                                                                2
                                                            )}
                                                        </pre>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                try {
                                                                    navigator.clipboard.writeText(
                                                                        `${previewError}\n\n${JSON.stringify(
                                                                            previewErrorMeta.diagnostics,
                                                                            null,
                                                                            2
                                                                        )}`
                                                                    );
                                                                } catch {
                                                                    /* noop */
                                                                }
                                                            }}
                                                            className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                                                        >
                                                            Copy diagnostics
                                                        </button>
                                                    </details>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        // Slice 19H: dispatch the
                                                        // dash:chat-core-send window
                                                        // CustomEvent so the ChatCore
                                                        // bound to this modal actually
                                                        // sends the message. The
                                                        // previous localStorage-write
                                                        // approach silently dropped
                                                        // the message because ChatCore
                                                        // only reads localStorage at
                                                        // mount. Use the validator's
                                                        // specific correction message
                                                        // when present (slice 17b.12);
                                                        // otherwise fall back to the
                                                        // generic compile-error prompt.
                                                        const content =
                                                            previewErrorMeta?.correction
                                                                ? previewErrorMeta.correction
                                                                : `Fix this compilation error:\n\n${previewError}\n\nPlease output both the corrected jsx component code block and the javascript config code block.`;
                                                        try {
                                                            window.dispatchEvent(
                                                                new CustomEvent(
                                                                    "dash:chat-core-send",
                                                                    {
                                                                        detail: {
                                                                            persistKey:
                                                                                "dash-widget-builder",
                                                                            content,
                                                                        },
                                                                    }
                                                                )
                                                            );
                                                        } catch (_) {
                                                            /* ignore */
                                                        }
                                                    }}
                                                    className="text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                                                >
                                                    Send error to AI
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                {/* Live widget preview */}
                                {PreviewComponent && !installStatus && (
                                    <div className="flex flex-col h-full">
                                        {/* Provider picker — shown when the
                                        widget declares providers. Without a
                                        selection the widget renders its own
                                        "not configured" empty state, same
                                        as on a real dashboard. */}
                                        <PreviewProviderPicker
                                            configCode={detectedCode.configCode}
                                            appProviders={
                                                (previewAppCtx || appContext)
                                                    ?.providers
                                            }
                                            selection={previewProviderSelection}
                                            justChanged={providerJustChanged}
                                            onChange={(
                                                next,
                                                changedType,
                                                changedValue
                                            ) => {
                                                setPreviewProviderSelection(
                                                    next
                                                );
                                                if (changedType) {
                                                    flagProviderChange(
                                                        changedType,
                                                        changedValue
                                                    );
                                                }
                                            }}
                                        />
                                        {/* Test-inputs form (slice 17b.9) —
                                        renders one row per userConfig field
                                        the AI declared, so the user can
                                        type values into the widget without
                                        leaving the modal (e.g. set
                                        indexName="airports" on an Algolia
                                        rules manager and watch the preview
                                        fetch real data). Empty when the
                                        widget declares no userConfig. */}
                                        <PreviewTestInputsForm
                                            userConfig={
                                                previewParsedConfig?.userConfig
                                            }
                                            defaults={previewWidgetDefaults}
                                            values={previewTestInputs}
                                            onChange={(field, value) =>
                                                setPreviewTestInputs(
                                                    (prev) => ({
                                                        ...prev,
                                                        [field]: value,
                                                    })
                                                )
                                            }
                                            onReset={() =>
                                                setPreviewTestInputs({})
                                            }
                                        />
                                        {/* Empty-render banner — surfaces the
                                        common case where the widget mounted
                                        but produced no visible content (the
                                        AI used wrong dash-react prop names,
                                        e.g. `text=` on Heading). Without
                                        this the user sees a black canvas
                                        with no clue what's wrong.

                                        Suppressed in compose mode: an empty
                                        preview while the user is still
                                        dragging components into cells is
                                        expected, not an error. The "Send
                                        to AI to fix" CTA also doesn't apply
                                        — compose doesn't go through chat. */}
                                        {previewLooksEmpty &&
                                            chatMode !== "compose" &&
                                            hasActedThisSession && (
                                                <div className="mx-4 mt-2 px-3 py-2 rounded-md border border-amber-700/40 bg-amber-900/20 text-xs text-amber-200 space-y-1">
                                                    <div className="font-semibold text-amber-300">
                                                        Widget rendered with no
                                                        visible content
                                                    </div>
                                                    <div className="text-amber-200/80">
                                                        Most common cause: wrong
                                                        prop names on dash-react
                                                        components. Use{" "}
                                                        <code className="bg-black/30 px-1 rounded">
                                                            title
                                                        </code>{" "}
                                                        on{" "}
                                                        <code className="bg-black/30 px-1 rounded">
                                                            Heading
                                                        </code>
                                                        /
                                                        <code className="bg-black/30 px-1 rounded">
                                                            Button
                                                        </code>
                                                        /
                                                        <code className="bg-black/30 px-1 rounded">
                                                            EmptyState
                                                        </code>{" "}
                                                        (not{" "}
                                                        <code className="bg-black/30 px-1 rounded">
                                                            text
                                                        </code>{" "}
                                                        or{" "}
                                                        <code className="bg-black/30 px-1 rounded">
                                                            message
                                                        </code>
                                                        ). Click "Send to AI to
                                                        fix" and the chat will
                                                        request a corrected
                                                        version.
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            try {
                                                                const raw =
                                                                    localStorage.getItem(
                                                                        "dash-widget-builder"
                                                                    );
                                                                const data = raw
                                                                    ? JSON.parse(
                                                                          raw
                                                                      )
                                                                    : {
                                                                          messages:
                                                                              [],
                                                                      };
                                                                const msgs =
                                                                    data?.messages ||
                                                                    [];
                                                                msgs.push({
                                                                    role: "user",
                                                                    content: `The widget compiled and mounted but rendered no visible content (preview is black). This is almost always a dash-react prop-name mismatch. Please re-emit the component AND config code blocks with corrected prop names: \`<Heading title="...">\` (NOT text=), \`<Button title="...">\` (NOT text=), \`<EmptyState title="..." description="...">\` (NOT message=). Output BOTH the \`\`\`jsx component block and the \`\`\`javascript config block.`,
                                                                });
                                                                localStorage.setItem(
                                                                    "dash-widget-builder",
                                                                    JSON.stringify(
                                                                        {
                                                                            ...data,
                                                                            messages:
                                                                                msgs,
                                                                        }
                                                                    )
                                                                );
                                                                setPreviewLooksEmpty(
                                                                    false
                                                                );
                                                            } catch {
                                                                /* ignore */
                                                            }
                                                        }}
                                                        className="mt-1 px-2 py-1 text-xs rounded border border-amber-600/50 bg-amber-700/30 hover:bg-amber-700/50 text-amber-100"
                                                    >
                                                        Send to AI to fix
                                                    </button>
                                                </div>
                                            )}
                                        {/* Widget preview — fills available space */}
                                        <div className="flex-1 p-4 overflow-auto">
                                            <div
                                                className={`h-full rounded-lg border overflow-hidden shadow-lg ${
                                                    previewThemeCtx
                                                        ?.currentTheme?.[
                                                        "border-primary-dark"
                                                    ] || "border-gray-700/30"
                                                } ${
                                                    previewThemeCtx
                                                        ?.currentTheme?.[
                                                        "bg-primary-dark"
                                                    ] || "bg-gray-800/30"
                                                }`}
                                            >
                                                {/* Slice 17c — iframe-isolated preview is the
                                                    only path now. Bundle source flows through
                                                    postMessage; module references go via direct
                                                    cross-window assignment (not serializable).
                                                    Theme, AppContext.providers, and widgetData
                                                    (the shape useWidgetProviders reads) are
                                                    posted as plain JSON; the iframe shell wraps
                                                    the widget in matching context providers so
                                                    dash-core hooks resolve correctly. Errors
                                                    of every kind (render, event-handler,
                                                    async, commit-phase, CSS, globals, memory)
                                                    stay kernel-isolated from the host React
                                                    tree. */}
                                                {previewBundleSource && (
                                                    <PreviewIframe
                                                        bundleSource={
                                                            previewBundleSource
                                                        }
                                                        componentName={
                                                            previewBundleComponentName
                                                        }
                                                        props={{
                                                            title: displayName,
                                                            ...previewWidgetDefaults,
                                                            ...previewTestInputs,
                                                            ...(effectiveEditContext?.userPrefs ||
                                                                {}),
                                                        }}
                                                        themeContext={
                                                            previewThemeCtx
                                                        }
                                                        appContext={{
                                                            providers:
                                                                (
                                                                    previewAppCtx ||
                                                                    appContext
                                                                )?.providers ||
                                                                {},
                                                            credentials:
                                                                (
                                                                    previewAppCtx ||
                                                                    appContext
                                                                )
                                                                    ?.credentials ||
                                                                null,
                                                        }}
                                                        widgetData={buildPreviewWidgetData(
                                                            {
                                                                editContext:
                                                                    effectiveEditContext,
                                                                previewConfigCode:
                                                                    detectedCode.configCode,
                                                                previewProviderSelection,
                                                            }
                                                        )}
                                                        onError={
                                                            handleIframePreviewError
                                                        }
                                                        onRenderStats={
                                                            handleIframeRenderStats
                                                        }
                                                        onConsoleEvent={
                                                            appendConsoleEvent
                                                        }
                                                        // Compose-mode
                                                        // click-to-select.
                                                        // Only active in
                                                        // compose mode —
                                                        // chat/build keep
                                                        // the preview
                                                        // passive so
                                                        // installed-widget
                                                        // interactions
                                                        // (button clicks,
                                                        // selections)
                                                        // aren't
                                                        // intercepted.
                                                        selectable={
                                                            chatMode ===
                                                            "compose"
                                                        }
                                                        selectedNodeId={
                                                            composerSelectedNodeId
                                                        }
                                                        onComposerNodeClick={({
                                                            nodeId,
                                                        }) =>
                                                            setComposerSelectedNodeId(
                                                                nodeId
                                                            )
                                                        }
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        {/* Registry-preview footer (shown when user is browsing a registry widget) */}
                                        {browsingPackage && (
                                            <div
                                                className={`px-6 py-3 border-t ${borderColor} shrink-0 space-y-2`}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={
                                                            handleBackToDiscover
                                                        }
                                                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                                    >
                                                        <FontAwesomeIcon
                                                            icon="arrow-left"
                                                            className="h-2.5 w-2.5"
                                                        />
                                                        Back to Discover
                                                    </button>
                                                    <div className="text-xs text-gray-400 truncate flex-1 text-right font-mono">
                                                        {browsingPackage.scope
                                                            ? `@${browsingPackage.scope.replace(
                                                                  /^@/,
                                                                  ""
                                                              )}/${
                                                                  browsingPackage.packageName
                                                              }`
                                                            : browsingPackage.packageName}
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-xs text-gray-500 truncate">
                                                        {browsingPackage.installed
                                                            ? "Already installed in your widget library."
                                                            : "Preview this widget, then install or remix."}
                                                    </span>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={
                                                                handleRemixRegistryPackage
                                                            }
                                                            disabled={
                                                                !detectedCode?.componentCode
                                                            }
                                                            title="Fork this widget into @ai-built/ and edit it with AI"
                                                            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-gray-200 text-sm font-medium transition-colors"
                                                        >
                                                            Remix
                                                        </button>
                                                        {browsingPackage.installed ? (
                                                            <button
                                                                type="button"
                                                                onClick={
                                                                    handleAddInstalledToDashboard
                                                                }
                                                                disabled={
                                                                    !cellContext
                                                                }
                                                                title={
                                                                    cellContext
                                                                        ? "Place this widget in the dashboard cell you opened the builder from"
                                                                        : "Open the builder from an empty grid cell to place widgets"
                                                                }
                                                                className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                                                            >
                                                                Add to Dashboard
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={
                                                                    handleInstallRegistryPackage
                                                                }
                                                                disabled={
                                                                    registryInstalling
                                                                }
                                                                className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                                                            >
                                                                {registryInstalling
                                                                    ? "Installing..."
                                                                    : cellContext
                                                                    ? "Install + Add to Dashboard"
                                                                    : "Install"}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                {installStatus?.error && (
                                                    <div className="text-xs text-red-400">
                                                        {installStatus.error}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Footer — mode toggle, name (remix), category + Install */}
                                        {!browsingPackage && (
                                            <div
                                                className={`px-6 py-3 border-t ${borderColor} shrink-0`}
                                            >
                                                {isRemixMode && (
                                                    <div className="mb-2 space-y-2">
                                                        {/* Sign-in nudge for non-ai-built widgets when not authenticated */}
                                                        {!isOwner &&
                                                            registryChecked &&
                                                            !registryUsername &&
                                                            widgetScope !==
                                                                "ai-built" && (
                                                                <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-amber-900/15 border border-amber-700/30">
                                                                    <p className="flex-1 text-xs text-amber-200 leading-snug">
                                                                        Sign in
                                                                        to the
                                                                        registry
                                                                        to
                                                                        update
                                                                        your own
                                                                        widgets
                                                                        in place
                                                                        instead
                                                                        of
                                                                        duplicating.
                                                                    </p>
                                                                    <button
                                                                        type="button"
                                                                        onClick={async () => {
                                                                            try {
                                                                                await window.mainApi?.registryAuth?.initiateLogin();
                                                                            } catch {
                                                                                /* ignore */
                                                                            }
                                                                        }}
                                                                        className="px-3 py-1 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 transition-colors"
                                                                    >
                                                                        Sign in
                                                                    </button>
                                                                </div>
                                                            )}
                                                        {/* Update / Remix toggle — only when user is the owner */}
                                                        {isOwner && (
                                                            <div className="flex items-center gap-1 bg-gray-800/50 rounded-md border border-gray-700/50 p-0.5 w-fit">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setEditMode(
                                                                            "update"
                                                                        )
                                                                    }
                                                                    className={`px-3 py-1 text-xs rounded transition-colors ${
                                                                        editMode ===
                                                                        "update"
                                                                            ? "bg-indigo-600/30 text-indigo-300 font-medium"
                                                                            : "text-gray-500 hover:text-gray-300"
                                                                    }`}
                                                                >
                                                                    Update
                                                                    Original
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setEditMode(
                                                                            "remix"
                                                                        )
                                                                    }
                                                                    className={`px-3 py-1 text-xs rounded transition-colors ${
                                                                        editMode ===
                                                                        "remix"
                                                                            ? "bg-indigo-600/30 text-indigo-300 font-medium"
                                                                            : "text-gray-500 hover:text-gray-300"
                                                                    }`}
                                                                >
                                                                    Remix as New
                                                                </button>
                                                            </div>
                                                        )}
                                                        {editMode ===
                                                            "remix" && (
                                                            <input
                                                                type="text"
                                                                value={
                                                                    remixName
                                                                }
                                                                onChange={(
                                                                    e
                                                                ) => {
                                                                    const raw =
                                                                        e.target.value.replace(
                                                                            /[^a-zA-Z0-9]/g,
                                                                            ""
                                                                        );
                                                                    setRemixName(
                                                                        raw
                                                                            .charAt(
                                                                                0
                                                                            )
                                                                            .toUpperCase() +
                                                                            raw.slice(
                                                                                1
                                                                            )
                                                                    );
                                                                }}
                                                                placeholder="RemixWidgetName"
                                                                className="w-full px-3 py-1.5 text-sm bg-gray-800/70 border border-gray-700/50 rounded text-gray-200 focus:border-indigo-500/50 focus:outline-none"
                                                                title="Name for the remixed widget (PascalCase)"
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-xs text-gray-500 truncate">
                                                        {!isRemixMode
                                                            ? `Installs to @ai-built/${widgetName?.toLowerCase()}`
                                                            : editMode ===
                                                              "update"
                                                            ? `Updates ${
                                                                  effectiveEditContext.originalPackage ||
                                                                  `@ai-built/${widgetName?.toLowerCase()}`
                                                              }`
                                                            : `Remixes ${
                                                                  effectiveEditContext.originalComponentName
                                                              } → @ai-built/${(
                                                                  remixName ||
                                                                  widgetName
                                                              )?.toLowerCase()}`}
                                                    </span>
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <select
                                                            value={
                                                                selectedCategory ||
                                                                ""
                                                            }
                                                            onChange={(e) =>
                                                                setSelectedCategory(
                                                                    e.target
                                                                        .value ||
                                                                        null
                                                                )
                                                            }
                                                            className="px-2 py-1.5 text-xs bg-gray-800/70 border border-gray-700/50 rounded text-gray-200 focus:border-indigo-500/50 focus:outline-none"
                                                            title="Pick a category before installing"
                                                        >
                                                            <option
                                                                value=""
                                                                disabled
                                                            >
                                                                Pick a category…
                                                            </option>
                                                            {VALID_CATEGORIES.map(
                                                                (c) => (
                                                                    <option
                                                                        key={c}
                                                                        value={
                                                                            c
                                                                        }
                                                                    >
                                                                        {c}
                                                                    </option>
                                                                )
                                                            )}
                                                        </select>
                                                        <button
                                                            onClick={
                                                                handleInstall
                                                            }
                                                            disabled={
                                                                !selectedCategory ||
                                                                (isRemixMode &&
                                                                    editMode ===
                                                                        "remix" &&
                                                                    !remixName)
                                                            }
                                                            className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                                                            title={
                                                                !selectedCategory
                                                                    ? "Pick a category first"
                                                                    : editMode ===
                                                                          "remix" &&
                                                                      !remixName
                                                                    ? "Enter a name for the remix"
                                                                    : undefined
                                                            }
                                                        >
                                                            {!isRemixMode
                                                                ? "Install Widget"
                                                                : editMode ===
                                                                  "update"
                                                                ? "Update Widget"
                                                                : "Remix Widget"}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Installed success */}
                                {installStatus?.success && (
                                    <div className="flex flex-col items-center justify-center h-full gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-green-600/20 flex items-center justify-center">
                                            <FontAwesomeIcon
                                                icon="check-circle"
                                                className="h-6 w-6 text-green-400"
                                            />
                                        </div>
                                        <div className="text-center space-y-1">
                                            <p className="text-base font-semibold text-green-300">
                                                {!isRemixMode
                                                    ? "Widget Installed!"
                                                    : editMode === "update"
                                                    ? "Widget Updated!"
                                                    : "Widget Remixed!"}
                                            </p>
                                            <p className="text-sm text-gray-400">
                                                <span className="font-mono text-gray-300">
                                                    {installStatus.widgetName}
                                                </span>{" "}
                                                {!isRemixMode
                                                    ? "is now in the widget selector."
                                                    : editMode === "update"
                                                    ? "has been updated in place."
                                                    : "has been swapped into your dashboard."}
                                            </p>
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setIsOpen(false)}
                                                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
                                            >
                                                Done
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setInstallStatus(null);
                                                    setPreviewComponent(null);
                                                    setDetectedCode({
                                                        componentCode: null,
                                                        configCode: null,
                                                    });
                                                    lastCompiledCode.current =
                                                        null;
                                                    if (browsingPackage) {
                                                        setBrowsingPackage(
                                                            null
                                                        );
                                                    }
                                                }}
                                                className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium transition-colors"
                                            >
                                                {browsingPackage
                                                    ? "Browse More"
                                                    : "Build Another"}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Install error */}
                                {installStatus?.error && (
                                    <div className="flex flex-col items-center justify-center h-full gap-4">
                                        <div className="text-center space-y-2">
                                            <p className="text-red-400 font-medium">
                                                Installation failed
                                            </p>
                                            <pre className="text-xs text-red-300/70 bg-black/20 rounded p-2 max-w-md overflow-auto">
                                                {installStatus.error}
                                            </pre>
                                        </div>
                                        <button
                                            onClick={() =>
                                                setInstallStatus(null)
                                            }
                                            className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium transition-colors"
                                        >
                                            Try Again
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Code editor (visible when Code tab is active) */}
                        {activeTab === "code" && detectedCode.componentCode && (
                            <div className="flex flex-1 min-h-0 overflow-hidden">
                                {/* File explorer sidebar */}
                                <div
                                    className={`w-48 border-r ${borderColor} shrink-0 overflow-auto py-1`}
                                >
                                    <div className="px-2 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                        Files
                                    </div>
                                    <button
                                        onClick={() =>
                                            setActiveFile("component")
                                        }
                                        className={`w-full text-left px-3 py-1.5 text-xs font-mono truncate transition-colors ${
                                            activeFile === "component"
                                                ? "bg-indigo-600/15 text-indigo-300"
                                                : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                                        }`}
                                    >
                                        <FontAwesomeIcon
                                            icon="file-code"
                                            className="h-2.5 w-2.5 mr-1.5"
                                        />
                                        {widgetName || "Widget"}.js
                                    </button>
                                    <button
                                        onClick={() => setActiveFile("config")}
                                        className={`w-full text-left px-3 py-1.5 text-xs font-mono truncate transition-colors ${
                                            activeFile === "config"
                                                ? "bg-indigo-600/15 text-indigo-300"
                                                : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                                        }`}
                                    >
                                        <FontAwesomeIcon
                                            icon="cog"
                                            className="h-2.5 w-2.5 mr-1.5"
                                        />
                                        {widgetName || "Widget"}.dash.js
                                    </button>
                                </div>
                                {/* Editor pane with breadcrumb header */}
                                <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
                                    {/* Breadcrumb path */}
                                    <div
                                        className={`flex items-center gap-1 px-3 py-1.5 border-b ${borderColor} shrink-0 text-xs`}
                                    >
                                        <span className="text-gray-600">
                                            @ai-built
                                        </span>
                                        <span className="text-gray-700">/</span>
                                        <span className="text-gray-600">
                                            {(
                                                widgetName || "widget"
                                            ).toLowerCase()}
                                        </span>
                                        <span className="text-gray-700">/</span>
                                        <span className="text-gray-600">
                                            widgets
                                        </span>
                                        <span className="text-gray-700">/</span>
                                        <span className="text-gray-300 font-medium">
                                            {widgetName || "Widget"}
                                            {activeFile === "config"
                                                ? ".dash.js"
                                                : ".js"}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-h-0 overflow-hidden relative">
                                        <div className="absolute inset-0">
                                            <CodeEditorVS
                                                key={activeFile}
                                                code={
                                                    editBuffer[activeFile] ??
                                                    (activeFile === "component"
                                                        ? detectedCode.componentCode
                                                        : detectedCode.configCode ||
                                                          "")
                                                }
                                                language="javascript"
                                                onChange={handleCodeEdit}
                                                readOnly={false}
                                                minimapEnabled={false}
                                                padding="p-0"
                                            />
                                        </div>
                                    </div>
                                    {/* Footer bar — always visible */}
                                    <div
                                        className={`flex items-center justify-between px-3 py-2 border-t ${borderColor} shrink-0`}
                                    >
                                        <span className="text-[10px] text-gray-600">
                                            {hasUnsavedEdits
                                                ? "Unsaved changes"
                                                : ""}
                                        </span>
                                        {hasUnsavedEdits ? (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleCancelEdits}
                                                    className="px-3 py-1 rounded text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleSaveEdits}
                                                    className="px-3 py-1 rounded text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors"
                                                >
                                                    Save &amp; Compile
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] text-gray-600">
                                                JavaScript
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Configure tab */}
                        {activeTab === "configure" &&
                            detectedCode.componentCode && (
                                <WidgetConfigureTab
                                    configCode={detectedCode.configCode || ""}
                                    parsedConfig={previewParsedConfig}
                                    componentName={widgetName}
                                    borderColor={borderColor}
                                    onSave={(newConfigCode, diff) => {
                                        // Apply matching code transforms
                                        // for any events/handlers added or
                                        // removed in the Configure tab —
                                        // this is what keeps the .dash.js
                                        // declaration in sync with the
                                        // widget's actual publishEvent /
                                        // listen calls. Stubs for adds,
                                        // surgical removes for deletes.
                                        let nextComponentCode =
                                            detectedCode.componentCode;
                                        if (diff && nextComponentCode) {
                                            for (const name of diff.eventsRemoved ||
                                                []) {
                                                nextComponentCode =
                                                    transforms.removePublishEvent(
                                                        nextComponentCode,
                                                        name
                                                    );
                                            }
                                            for (const name of diff.eventsAdded ||
                                                []) {
                                                nextComponentCode =
                                                    transforms.addPublishEventStub(
                                                        nextComponentCode,
                                                        name,
                                                        widgetName
                                                    );
                                            }
                                            for (const name of diff.handlersRemoved ||
                                                []) {
                                                nextComponentCode =
                                                    transforms.removeEventHandler(
                                                        nextComponentCode,
                                                        name
                                                    );
                                            }
                                            for (const name of diff.handlersAdded ||
                                                []) {
                                                nextComponentCode =
                                                    transforms.addEventHandlerStub(
                                                        nextComponentCode,
                                                        name,
                                                        widgetName
                                                    );
                                            }
                                            for (const key of diff.tasksRemoved ||
                                                []) {
                                                nextComponentCode =
                                                    transforms.removeScheduledTask(
                                                        nextComponentCode,
                                                        key
                                                    );
                                            }
                                            for (const key of diff.tasksAdded ||
                                                []) {
                                                nextComponentCode =
                                                    transforms.addScheduledTaskStub(
                                                        nextComponentCode,
                                                        key,
                                                        widgetName
                                                    );
                                            }
                                        }
                                        const updated = {
                                            ...detectedCode,
                                            componentCode: nextComponentCode,
                                            configCode: newConfigCode,
                                        };
                                        setDetectedCode(updated);
                                        lastCompiledCode.current = null;
                                        compilePreview(updated);
                                    }}
                                />
                            )}
                        {activeTab === "console" && (
                            <WidgetConsolePane
                                events={consoleEvents}
                                onClear={clearConsoleEvents}
                                onSendErrorToAI={handleSendConsoleErrorToAI}
                            />
                        )}
                        {activeTab === "scorecard" &&
                            detectedCode.componentCode && (
                                <div
                                    className="px-4 py-4 overflow-y-auto flex flex-col gap-3"
                                    data-testid="build-mode-acceptance-scorecard"
                                >
                                    <div className="text-sm text-gray-300 leading-relaxed">
                                        <div className="font-medium text-gray-100">
                                            Scoring{" "}
                                            <code className="px-1.5 py-0.5 rounded bg-gray-800 text-indigo-300 font-mono text-xs">
                                                {widgetName || "current widget"}
                                            </code>
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">
                                            The scorecard runs over whatever
                                            widget code is currently in the
                                            editor — your draft, a remixed
                                            registry widget, or a fresh AI
                                            generation. Drafts from before the
                                            cohesion rubric existed will show
                                            failures here; to fix them, ask the
                                            AI in the chat panel to regenerate,
                                            or edit directly in the{" "}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setActiveTab("code")
                                                }
                                                className="underline text-indigo-300 hover:text-indigo-200"
                                            >
                                                Code
                                            </button>{" "}
                                            tab.
                                        </div>
                                    </div>
                                    <AcceptanceScorecard
                                        code={detectedCode.componentCode}
                                        onSendToAi={handleScorecardSendToAi}
                                    />
                                </div>
                            )}
                    </div>

                    {/* Right: Chat (1/3) */}
                    <div
                        className={`flex flex-col flex-1 min-w-0 border-l ${borderColor}`}
                    >
                        {/* Build / Compose are the two CREATE paths,
                            grouped in a segmented control. Discover is
                            a separate path entirely (search the
                            registry for existing widgets, not build a
                            new one) so it sits outside the toggle as
                            its own button with different styling. */}
                        <div className="flex items-center justify-between gap-2 px-3 pt-2 shrink-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="flex items-center gap-1 bg-gray-800/50 rounded-md border border-gray-700/50 p-0.5">
                                    <button
                                        type="button"
                                        onClick={() => setChatMode("build")}
                                        className={`px-3 py-1 text-xs rounded transition-colors ${
                                            chatMode === "build"
                                                ? "bg-indigo-600/30 text-indigo-300 font-medium"
                                                : "text-gray-500 hover:text-gray-300"
                                        }`}
                                        title="Generate a custom widget from scratch with AI"
                                    >
                                        Build
                                    </button>
                                    {/* Slice 20.C1: Compose mode —
                                        stepwise widget composition (pick
                                        components, wire data slots)
                                        without going through an AI
                                        prompt. Replaces the chat pane
                                        with the ComposerPane when
                                        active. */}
                                    <button
                                        type="button"
                                        onClick={() => setChatMode("compose")}
                                        className={`px-3 py-1 text-xs rounded transition-colors ${
                                            chatMode === "compose"
                                                ? "bg-indigo-600/30 text-indigo-300 font-medium"
                                                : "text-gray-500 hover:text-gray-300"
                                        }`}
                                        title="Build a widget by picking components and wiring data slots — no AI prompt needed"
                                        data-testid="chat-mode-compose"
                                    >
                                        Compose
                                    </button>
                                </div>
                                <span className="text-[11px] text-gray-500 truncate">
                                    {chatMode === "compose"
                                        ? "Pick components, wire data slots — no prompt needed"
                                        : chatMode === "discover"
                                        ? "Searching the registry for existing widgets"
                                        : "AI will generate a custom widget"}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    setChatMode(
                                        chatMode === "discover"
                                            ? "build"
                                            : "discover"
                                    )
                                }
                                className={`flex items-center gap-1 px-2.5 py-1 text-[11px] rounded border transition-colors shrink-0 ${
                                    chatMode === "discover"
                                        ? "bg-amber-600/20 border-amber-700/50 text-amber-200"
                                        : "border-gray-700/50 text-gray-400 hover:text-gray-200 hover:border-gray-600"
                                }`}
                                title={
                                    chatMode === "discover"
                                        ? "Back to Build mode"
                                        : "Search the Dash registry for existing widgets instead of building one"
                                }
                                data-testid="chat-mode-discover"
                            >
                                <FontAwesomeIcon
                                    icon={
                                        chatMode === "discover"
                                            ? "arrow-left"
                                            : "magnifying-glass"
                                    }
                                    className="h-2.5 w-2.5"
                                />
                                {chatMode === "discover"
                                    ? "Back to Build"
                                    : "Discover existing"}
                            </button>
                        </div>

                        {/* Chat content + provider gate. Relative wrapper
                        so the gate's `absolute inset-0` covers only
                        this region — the mode toggle above stays
                        clickable so the user can switch to Discover.
                        The gate appears when in build mode and no
                        provider has been picked yet (Edit-with-AI
                        auto-derives via the useEffect at line ~1467
                        and skips the gate). New Chat clears messages
                        which triggers the message-poller's reset
                        block to also null `selectedProviderForBuild`,
                        re-opening the gate. */}
                        <div className="relative flex flex-col flex-1 min-h-0">
                            {/* Slice 20.C1: Compose-mode UI replaces
                                the chat pane and the provider gate.
                                Stage 1 (component picker) emits a
                                data-less widget skeleton on every
                                edit through the same compilePreview
                                pipeline the chat path uses, so the
                                left-side Preview tab updates live. */}
                            {chatMode === "compose" && USE_COMPOSER_V2 && (
                                <ComposerPaneV2
                                    key={composerSessionKey}
                                    initialGrid={composerInitialGrid}
                                    onChange={setComposerGrid}
                                    selectedCellId={composerSelectedNodeId}
                                    onSelectedCellChange={
                                        setComposerSelectedNodeId
                                    }
                                    providers={providers}
                                    apiKey={apiKey}
                                    model={model}
                                    backend={preferredBackend}
                                    // Edit-mode awareness so the pane's
                                    // mount-time auto-name + empty-grid
                                    // emit don't overwrite the loaded
                                    // editContext.componentCode. See
                                    // ComposerPaneV2's editContext prop
                                    // docs for the failure mode this
                                    // prevents.
                                    editContext={effectiveEditContext}
                                    onEmit={(code) => {
                                        setDetectedCode({
                                            componentCode: code.componentCode,
                                            configCode: code.configCode,
                                            files: code.files || null,
                                        });
                                        compilePreview(code).catch(() => {});
                                    }}
                                />
                            )}
                            {chatMode === "compose" && !USE_COMPOSER_V2 && (
                                <ComposerPane
                                    key={composerSessionKey}
                                    initialTree={composerInitialTree}
                                    onTreeChange={setComposerTree}
                                    selectedNodeId={composerSelectedNodeId}
                                    onSelectedNodeChange={
                                        setComposerSelectedNodeId
                                    }
                                    providers={providers}
                                    apiKey={apiKey}
                                    model={model}
                                    backend={preferredBackend}
                                    onEmit={(code) => {
                                        // Mirror the composer's
                                        // emitted code into
                                        // detectedCode so the Code
                                        // and Configure tabs (gated
                                        // on detectedCode.componentCode)
                                        // become active. Without
                                        // this, the user can't see
                                        // or edit the source the
                                        // composer is generating.
                                        setDetectedCode({
                                            componentCode: code.componentCode,
                                            configCode: code.configCode,
                                            files: code.files || null,
                                        });
                                        compilePreview(code).catch(() => {});
                                        // Intentionally NOT yanking
                                        // the user back to Preview
                                        // on every composer edit —
                                        // when they're reading the
                                        // Code tab, the auto-switch
                                        // is disruptive. Preview
                                        // content updates regardless
                                        // of which tab is active.
                                    }}
                                />
                            )}
                            {chatMode === "build" &&
                                selectedProviderForBuild === null &&
                                !detectedCode?.componentCode && (
                                    <ChatProviderGate
                                        onChange={setSelectedProviderForBuild}
                                        builtInCatalog={builtInCatalog}
                                        knownExternalCatalog={
                                            knownExternalCatalog
                                        }
                                    />
                                )}

                            {/* Slice 17b.1: provider-aware status row.
                                Shows the active provider type so users
                                know what context the AI has — also
                                offers a quick "Change" button to
                                re-open the gate. */}
                            {chatMode === "build" &&
                                selectedProviderForBuild !== null && (
                                    <div className="flex flex-row items-center justify-between gap-2 px-3 py-1.5 text-xs border-b border-white/10 bg-indigo-900/10">
                                        <div className="flex flex-row items-center gap-2 text-indigo-300">
                                            <FontAwesomeIcon
                                                icon="bolt"
                                                className="h-3 w-3"
                                            />
                                            <span>
                                                {selectedProviderForBuild?.sentinel ===
                                                "none"
                                                    ? "Building without an external provider"
                                                    : `Building with ${
                                                          selectedProviderForBuild?.type ||
                                                          "(unknown)"
                                                      }${
                                                          selectedProviderForBuild?.providerClass
                                                              ? ` (${selectedProviderForBuild.providerClass})`
                                                              : ""
                                                      }`}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setSelectedProviderForBuild(
                                                    null
                                                )
                                            }
                                            className="text-indigo-300 hover:text-indigo-100 underline cursor-pointer"
                                            title="Pick a different provider"
                                        >
                                            Change
                                        </button>
                                    </div>
                                )}

                            {/* Render ChatCore only after the provider
                                gate is resolved (or skipped via edit
                                mode). Otherwise the AI's first response
                                is generated against a system prompt
                                that doesn't know about the user's
                                pick — locking in a generic "what kind
                                of widget?" message even after the
                                user selects. */}
                            {chatMode !== "compose" &&
                                (chatMode !== "build" ||
                                    selectedProviderForBuild !== null ||
                                    detectedCode?.componentCode) && (
                                    <ChatCore
                                        title=""
                                        model={model}
                                        // Lock the modal's CLI invocation: replace
                                        // Claude Code's default system prompt
                                        // (which advertises tools + auto-loads
                                        // project skills by description match)
                                        // with ours, and disable all built-in
                                        // tools. Without this, the
                                        // dash-widget-builder skill auto-loads
                                        // here and the AI uses Bash/Read/Glob
                                        // despite the prompt forbidding them.
                                        // Replace Claude Code's default preamble
                                        // with the modal's terse skill-pointer
                                        // prompt — the dash-widget-builder skill
                                        // (auto-loaded from .claude/skills/) does
                                        // the heavy lifting; the default preamble
                                        // would otherwise override our concise
                                        // first-response guidance.
                                        replaceSystemPrompt={true}
                                        // Skip auto-wiring the dash MCP — the
                                        // widget builder doesn't need
                                        // dashboard-management tools while
                                        // generating a widget. (No effect on
                                        // CLI argv as of slice 19B; gates the
                                        // dash MCP plumbing only.)
                                        disableTools={true}
                                        systemPrompt={(() => {
                                            if (chatMode === "discover") {
                                                return DISCOVER_SYSTEM_PROMPT;
                                            }
                                            const base = buildSystemPrompt({
                                                builtInCatalog,
                                                knownExternalCatalog,
                                                installedProviders: providers,
                                                selectedProvider:
                                                    selectedProviderForBuild,
                                            });
                                            // Edit mode: append the existing
                                            // widget source so the AI sees what
                                            // it's modifying. The new
                                            // buildSystemPrompt handles
                                            // first-response style for build
                                            // mode; edit mode needs its own
                                            // first-response wording (confirm by
                                            // name, ask what to change) so it
                                            // appends here.
                                            if (
                                                effectiveEditContext?.componentCode
                                            ) {
                                                return `${base}\n\nYou are editing an existing widget. The user will describe what changes they want. Here is the CURRENT source code you are modifying:\n\nComponent (jsx):\n\`\`\`jsx\n${
                                                    effectiveEditContext.componentCode
                                                }\n\`\`\`\n\nConfig (.dash.js):\n\`\`\`javascript\n${
                                                    effectiveEditContext.configCode ||
                                                    ""
                                                }\n\`\`\`\n\nWhen the user describes changes, output BOTH updated code blocks (the full component and full config) incorporating their requested changes. Do NOT ask the user to share the code — you already have it above.\n\nIf this is your FIRST response in the conversation, do NOT output code. Reply with 1–2 short sentences: confirm you see the widget by name and ask what they'd like to change. No lists, no bullet points, no sections, no suggestions — keep it under 30 words total.`;
                                            }
                                            // Hand-off path: user
                                            // composed a widget in
                                            // Compose mode, then
                                            // switched to Build to
                                            // ask AI for tweaks.
                                            // detectedCode is
                                            // populated but there's
                                            // no editContext (this
                                            // isn't an install they
                                            // came back to edit).
                                            // Treat the composed code
                                            // as the starting point
                                            // so the AI iterates
                                            // instead of generating
                                            // from scratch.
                                            if (detectedCode?.componentCode) {
                                                return `${base}\n\nThe user started this widget in Compose mode and now wants AI help to refine it. Here is the CURRENT source they composed:\n\nComponent (jsx):\n\`\`\`jsx\n${
                                                    detectedCode.componentCode
                                                }\n\`\`\`\n\nConfig (.dash.js):\n\`\`\`javascript\n${
                                                    detectedCode.configCode ||
                                                    ""
                                                }\n\`\`\`\n\nWhen the user describes changes, output BOTH updated code blocks (the full component and full config) incorporating their requested changes. Do NOT ask the user to share the code — you already have it above. Do NOT throw away what they composed unless they explicitly ask you to start over.\n\nIf this is your FIRST response in the conversation, do NOT output code. Reply with 1–2 short sentences acknowledging what they've built so far and asking what they'd like to change. No lists, no bullet points, under 30 words.`;
                                            }
                                            return base;
                                        })()}
                                        maxToolRounds="10"
                                        apiKey={apiKey}
                                        backend={preferredBackend}
                                        persistKey="dash-widget-builder"
                                        hideToolsBanner={true}
                                        initialMessage={
                                            chatMode === "discover"
                                                ? "Tell me what kind of widget you're looking for."
                                                : effectiveEditContext?.componentCode
                                                ? "Hello, let's make some edits to this widget."
                                                : "Hi, I'd like to build a new widget."
                                        }
                                    />
                                )}
                        </div>
                    </div>
                </div>
            )}
            {/* Slice 17d.2 — install-time permission gate. Renders
                via createPortal at fixed-position overlay (same
                pattern JitConsentModal uses) so it stacks above
                the widget-builder Modal without HeadlessUI Dialog
                stacking issues. Self-managing isOpen via the
                `pendingInstallContext` state so it only mounts when
                the install flow has actually paused for consent. */}
            <WidgetCredentialPermissionModal
                isOpen={!!pendingInstallContext}
                packageName={pendingInstallContext?.packageName || ""}
                calls={pendingInstallContext?.calls || []}
                onConfirm={handlePermissionConfirm}
                onCancel={handlePermissionCancel}
            />
        </Modal>
    );
};
