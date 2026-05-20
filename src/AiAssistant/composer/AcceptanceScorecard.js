/**
 * AcceptanceScorecard — static-analysis scorecard for Build-mode
 * widget code.
 *
 * Renders the 16-item ACCEPTANCE_CHECKLIST (from widgetConventions.js)
 * with a ✓ / ✗ marker per item, derived from a regex pass over the
 * provided widget source. The user gets a live signal whether the
 * AI-generated widget conforms to the cohesion rubric — they can ask
 * the AI to fix any ✗ before installing.
 *
 * Static-only by design:
 *   - We do NOT run the widget. Many checks (provider connection,
 *     event flow) can't be evaluated without a real Electron + MCP
 *     environment; failing them silently is worse than not checking.
 *   - Checks that ARE testable from source live in `CHECKS` below
 *     with a `match` predicate. Each predicate is conservative —
 *     false positives are noisier than false negatives in this UI
 *     ("looks like you're missing X" when X is present is harder to
 *     recover from than "you might want to add X" when X is genuinely
 *     missing).
 *
 * Layout: a compact vertical list inside the Build-mode preview
 * pane, one row per checklist item, ✓/✗ at the left, the item text
 * at the right. Click-to-expand on ✗ rows shows the matched
 * offending substring(s) so the user can ask the AI to fix the
 * specific line.
 */
import React, { useMemo, useState } from "react";
import {
    ACCEPTANCE_CHECKLIST,
    COLOR_TAILWIND_REGEX,
} from "./widgetConventions";

/**
 * A widget has a "data-fetch surface" when its source talks to a
 * provider — directly via `@trops/dash-core` hooks, via the
 * `window.mainApi` IPC bridge, or via the recognizable async-fetch
 * patterns those hooks implement.
 *
 * Several scorecard items (loading state, empty state, error state,
 * provider hook used, primitive-based feedback for those states)
 * only make sense for widgets that actually move data. A pure-UI
 * widget — a clock, a calculator, the bare Submit Form template
 * before the user has wired the button to any IPC — should resolve
 * those checks to "n/a" rather than failing. The user opening a
 * Compose-mode starter and seeing 7 red ✗ marks on a widget they
 * haven't even customized is the bug this gate fixes.
 *
 * When the user wires the template into a real widget
 * (Button.onClick → window.mainApi.foo.bar), the emitted code grows
 * a data-fetch surface and the checks fire as intended — at which
 * point the rubric items become actionable instead of noisy.
 */
function hasDataFetchSurface(code) {
    if (typeof code !== "string") return false;
    return (
        /@trops\/dash-core/.test(code) ||
        /window\.mainApi\./.test(code) ||
        /\buseMcpProvider\s*\(/.test(code) ||
        /\buseWidgetProviders\s*\(/.test(code)
    );
}

// Each entry maps an item index (0-based in ACCEPTANCE_CHECKLIST) to
// a predicate that returns `{ pass: boolean | null, matches: string[] }`.
// `pass === null` renders as a "not statically checkable" indicator —
// either the rubric item isn't expressible as a regex pass, or the
// check is conditionally skipped (e.g. data-fetch items on a pure-UI
// widget).
const CHECKS = {
    // 0 — Title uses SubHeading2.
    0: (code) => {
        const usesSubHeading2 = /<SubHeading2\b/.test(code);
        const usesRawHeading = /<Heading\b/.test(code);
        const usesNumericHeading = /<Heading[23]\b/.test(code);
        // Pass when SubHeading2 OR a numeric Heading is present AND
        // no raw <Heading is used (raw H1 is the actual violation).
        const hasTitle = usesSubHeading2 || usesNumericHeading;
        return {
            pass: hasTitle && !usesRawHeading,
            matches: usesRawHeading
                ? [(code.match(/<Heading[^2-9]/) || [""])[0]]
                : [],
        };
    },
    // 1 — Root container uses the canonical flex-col layout.
    1: (code) => {
        const hasRootLayout = /flex flex-col[^"']*gap-\d/.test(code);
        return { pass: hasRootLayout, matches: [] };
    },
    // 2 — Loading state. Only required when the widget actually has
    //     a data-fetch surface — otherwise n/a. See
    //     hasDataFetchSurface() for the rationale.
    2: (code) => {
        if (!hasDataFetchSurface(code)) return { pass: null, matches: [] };
        const usesSkeleton = /\bSkeleton(\.Text|\.Card)?\b/.test(code);
        const usesIsLoadingBranch = /\bloading\s*\?|\bisLoading\b/.test(code);
        return {
            pass: usesSkeleton || usesIsLoadingBranch,
            matches: [],
        };
    },
    // 3 — Empty state. Only required when the widget has data — a
    //     widget that doesn't fetch a list can't have an empty list.
    3: (code) => {
        if (!hasDataFetchSurface(code)) return { pass: null, matches: [] };
        return {
            pass: /<EmptyState\b/.test(code),
            matches: [],
        };
    },
    // 4 — Error state (visible, not just console). Only required when
    //     there's a provider call that could fail.
    4: (code) => {
        if (!hasDataFetchSurface(code)) return { pass: null, matches: [] };
        return {
            pass: /<Alert\b|<Alert2\b|<Alert3\b|<ErrorMessage\b/.test(code),
            matches: [],
        };
    },
    // 5 — Provider hook (useMcpProvider OR useWidgetProviders). Only
    //     required for widgets that move data — a pure-UI clock or
    //     a freshly-emitted starter template that hasn't been wired
    //     to anything yet legitimately has no provider hook.
    5: (code) => {
        if (!hasDataFetchSurface(code)) return { pass: null, matches: [] };
        const usesMcp = /\buseMcpProvider\s*\(/.test(code);
        const usesCredential = /\buseWidgetProviders\s*\(/.test(code);
        return {
            pass: usesMcp || usesCredential,
            matches: [],
        };
    },
    // 6 — parseMcpResponse for MCP, n/a for credential. We pass when
    //     EITHER the call exists OR the widget is credential-only.
    6: (code) => {
        const usesMcp = /\buseMcpProvider\s*\(/.test(code);
        if (!usesMcp) return { pass: true, matches: [] };
        return {
            pass: /\bparseMcpResponse\s*\(/.test(code),
            matches: [],
        };
    },
    // 7 — userConfig fields. Static check is limited — the userConfig
    //     lives in the .dash.js sibling, not the widget source. We
    //     mark this "not statically checkable" via a null pass.
    7: () => ({ pass: null, matches: [] }),
    // 8 — No hardcoded userConfigable values. Same caveat as above.
    8: () => ({ pass: null, matches: [] }),
    // 9 — Compiles clean. Not checkable from source-text alone.
    9: () => ({ pass: null, matches: [] }),
    // 10 — Visible padding + gap. Best-effort: at least one gap-* or
    //      space-y-* utility appears.
    10: (code) => {
        return {
            pass: /\bgap-\d+\b|\bspace-y-\d+\b/.test(code),
            matches: [],
        };
    },
    // 11 — useWidgetEvents (when widget participates). Best-effort:
    //      pass when the hook is imported / used, but the rubric also
    //      accepts "doesn't participate", so a widget without it
    //      isn't necessarily broken. Mark null-checkable.
    11: () => ({ pass: null, matches: [] }),
    // 12 — No hardcoded Tailwind color classes. THE big rule.
    12: (code) => {
        const matches = code.match(new RegExp(COLOR_TAILWIND_REGEX, "g"));
        return {
            pass: !matches || matches.length === 0,
            matches: matches ? matches.slice(0, 5) : [],
        };
    },
    // 13 — Every button is a dash-react Button variant.
    13: (code) => {
        // A raw <button …> tag with className is the violation. Be
        // tolerant of `<button type="submit">` without color classes
        // — that's a layout-only escape hatch (form submit) and not
        // what the rule targets.
        const rawButtonRe = /<button[^>]*className\s*=/g;
        const matches = code.match(rawButtonRe);
        return {
            pass: !matches || matches.length === 0,
            matches: matches ? matches.slice(0, 5) : [],
        };
    },
    // 14 — Status indicators use StatusBadge or Tag. Best-effort: if
    //      the widget has connection state language ("isConnected",
    //      "status") AND no StatusBadge/Tag, flag it. Otherwise pass.
    14: (code) => {
        const hasConnectionLang =
            /\bisConnected\b|\bisConnecting\b|\bconnectionState\b/.test(code);
        if (!hasConnectionLang) return { pass: true, matches: [] };
        const usesBadgeOrTag = /<StatusBadge\b|<Tag\d?\b/.test(code);
        return { pass: usesBadgeOrTag, matches: [] };
    },
    // 15 — Empty/loading/error use primitives, not plaintext.
    //      Combine the EmptyState/Skeleton/Alert presence into one
    //      flag. Only required when the widget has a data-fetch
    //      surface — otherwise there are no empty/loading/error
    //      states to render. Pairs with items 2/3/4.
    15: (code) => {
        if (!hasDataFetchSurface(code)) return { pass: null, matches: [] };
        const hasEmptyPrim = /<EmptyState\b/.test(code);
        const hasLoadingPrim = /\bSkeleton(\.Text|\.Card)?\b/.test(code);
        const hasErrorPrim = /<Alert\d?\b/.test(code);
        return {
            pass: hasEmptyPrim && hasLoadingPrim && hasErrorPrim,
            matches: [],
        };
    },
};

/**
 * Pure function — run all checks against the given widget source.
 * Exposed for unit testing; the React component is a thin shell
 * around it.
 *
 * Returns: array<{ index, item, pass, matches }>. `pass === null`
 * means "rubric item not statically checkable".
 */
export function evaluateScorecard(code) {
    const safe = typeof code === "string" ? code : "";
    return ACCEPTANCE_CHECKLIST.map((item, index) => {
        const check = CHECKS[index];
        const result = check ? check(safe) : { pass: null, matches: [] };
        return {
            index,
            item,
            pass: result.pass,
            matches: result.matches,
        };
    });
}

/**
 * Build the chat message that gets dispatched into ChatCore when the
 * user clicks "Send to AI" on the scorecard. Exposed for tests so we
 * can pin the exact wording without rendering the React tree.
 *
 * Single-rule and multi-rule cases produce different shapes — the
 * single-rule message is conversational ("flags this rule"), the
 * multi-rule message is a numbered list. Both end with an explicit
 * "output BOTH code blocks" instruction so the modal's code parser
 * has something to pick up.
 */
export function buildScorecardChatMessage(rules) {
    if (!Array.isArray(rules) || rules.length === 0) return "";
    const formatOffending = (matches, max) => {
        if (!matches || matches.length === 0) return "";
        const head = matches.slice(0, max).join(", ");
        const more =
            matches.length > max ? ` (+${matches.length - max} more)` : "";
        return `${head}${more}`;
    };
    if (rules.length === 1) {
        const r = rules[0];
        const off = formatOffending(r.matches, 5);
        const offendingLine = off ? `\n\nOffending substring(s): ${off}.` : "";
        return `The acceptance scorecard flags this rule on the current widget code:\n\n"${r.item}"${offendingLine}\n\nPlease update the widget to fix this. Output BOTH the component (jsx) and config (.dash.js) code blocks with the fix.`;
    }
    const list = rules
        .map((r, i) => {
            const off = formatOffending(r.matches, 3);
            const offendingSuffix = off ? ` (offending: ${off})` : "";
            return `${i + 1}. ${r.item}${offendingSuffix}`;
        })
        .join("\n");
    return `The acceptance scorecard flags ${rules.length} rules on the current widget code:\n\n${list}\n\nPlease update the widget to address all of them. Output BOTH the component (jsx) and config (.dash.js) code blocks with the fixes.`;
}

// Group rows by status for the rendered scorecard. Failed rules show
// first (most actionable — these are the things the user wants to fix
// or ask the AI to fix), then passed (confirmation), then n/a
// (informational, can't be statically verified).
function groupRowsByStatus(rows) {
    const failed = rows.filter((r) => r.pass === false);
    const passed = rows.filter((r) => r.pass === true);
    const na = rows.filter((r) => r.pass === null);
    return { failed, passed, na };
}

function ScorecardRow({ row, expanded, onToggle, onSendToAi }) {
    const expandable = row.pass === false && row.matches.length > 0;
    const isOpen = expanded === row.index;
    const marker = row.pass === true ? "✓" : row.pass === false ? "✗" : "·";
    const markerTone =
        row.pass === true
            ? "text-emerald-400"
            : row.pass === false
            ? "text-rose-400"
            : "text-gray-500";
    const rowBg =
        row.pass === false
            ? "bg-rose-950/30 border border-rose-900/40"
            : row.pass === true
            ? ""
            : "";
    const textTone =
        row.pass === false
            ? "text-gray-100"
            : row.pass === true
            ? "text-gray-300"
            : "text-gray-400";
    // Only failing rows get a "Send to AI" affordance — there's
    // nothing to fix on a passing or n/a row. The button is rendered
    // when the host wires an onSendToAi handler; without one, the
    // scorecard stays read-only (e.g. when embedded somewhere that
    // doesn't have a chat panel to push to).
    const canSendToAi = row.pass === false && typeof onSendToAi === "function";

    return (
        <li
            data-testid={`acceptance-scorecard-row-${row.index}`}
            data-pass={row.pass === null ? "na" : String(row.pass)}
            className={`flex flex-col rounded ${rowBg}`}
        >
            <div className="flex items-start gap-1">
                <button
                    type="button"
                    onClick={() =>
                        expandable
                            ? onToggle(isOpen ? null : row.index)
                            : undefined
                    }
                    disabled={!expandable}
                    className="flex items-start gap-3 px-2 py-1.5 text-left text-sm disabled:cursor-default flex-1 min-w-0"
                >
                    <span
                        className={`font-mono w-4 shrink-0 text-base leading-tight ${markerTone}`}
                        aria-hidden="true"
                    >
                        {marker}
                    </span>
                    <span className={`flex-1 leading-snug ${textTone}`}>
                        {row.item}
                    </span>
                    {expandable && (
                        <span className="text-xs text-rose-300 shrink-0">
                            {isOpen ? "Hide" : "Details"}
                        </span>
                    )}
                </button>
                {canSendToAi && (
                    <button
                        type="button"
                        data-testid={`acceptance-scorecard-row-${row.index}-send-to-ai`}
                        onClick={() => onSendToAi([row])}
                        className="shrink-0 my-1 mr-1.5 px-2 py-1 rounded text-xs font-medium bg-indigo-700 hover:bg-indigo-600 text-indigo-50 transition-colors"
                        title="Ask the AI to fix this rule"
                    >
                        Ask AI
                    </button>
                )}
            </div>
            {expandable && isOpen && (
                <ul
                    className="ml-9 mb-1.5 mr-2 flex flex-col gap-0.5 font-mono text-xs text-rose-200"
                    data-testid={`acceptance-scorecard-matches-${row.index}`}
                >
                    {row.matches.map((m, i) => (
                        <li
                            key={i}
                            className="bg-rose-900/30 px-2 py-0.5 rounded"
                        >
                            {m}
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
}

export function AcceptanceScorecard({ code, onSendToAi = null }) {
    const rows = useMemo(() => evaluateScorecard(code || ""), [code]);
    const [expanded, setExpanded] = useState(null);

    const { failed, passed, na } = groupRowsByStatus(rows);
    const passCount = passed.length;
    const failCount = failed.length;
    const naCount = na.length;
    const totalChecked = passCount + failCount;
    const headlineTone = failCount === 0 ? "text-emerald-300" : "text-rose-300";
    const headline =
        failCount === 0
            ? totalChecked === 0
                ? "Awaiting widget code"
                : `All ${totalChecked} statically-checkable rules pass`
            : `${failCount} of ${totalChecked} rules failing — fix these or ask the AI to`;
    // "Send all failing to AI" only makes sense when there's >1
    // failure AND the host wired an onSendToAi handler. With a
    // single failure the per-row button covers it without a
    // confusing duplicate.
    const canSendAll = failCount > 1 && typeof onSendToAi === "function";

    return (
        <div data-testid="acceptance-scorecard" className="flex flex-col gap-3">
            <div
                className="flex items-center justify-between flex-wrap gap-2"
                data-testid="acceptance-scorecard-summary"
            >
                <span className={`text-base font-semibold ${headlineTone}`}>
                    {headline}
                </span>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400">
                        {passCount} pass · {failCount} fail · {naCount} n/a
                    </span>
                    {canSendAll && (
                        <button
                            type="button"
                            data-testid="acceptance-scorecard-send-all-to-ai"
                            onClick={() => onSendToAi(failed)}
                            className="px-3 py-1 rounded text-xs font-medium bg-indigo-700 hover:bg-indigo-600 text-indigo-50 transition-colors"
                            title="Ask the AI to fix every failing rule in one chat message"
                        >
                            Ask AI to fix all {failCount}
                        </button>
                    )}
                </div>
            </div>
            {failed.length > 0 && (
                <section className="flex flex-col gap-1.5">
                    <h4 className="text-xs uppercase tracking-wide text-rose-400/80 font-semibold">
                        Failing
                    </h4>
                    <ul className="flex flex-col gap-1.5">
                        {failed.map((row) => (
                            <ScorecardRow
                                key={row.index}
                                row={row}
                                expanded={expanded}
                                onToggle={setExpanded}
                                onSendToAi={onSendToAi}
                            />
                        ))}
                    </ul>
                </section>
            )}
            {passed.length > 0 && (
                <section className="flex flex-col gap-1">
                    <h4 className="text-xs uppercase tracking-wide text-emerald-400/70 font-semibold">
                        Passing
                    </h4>
                    <ul className="flex flex-col">
                        {passed.map((row) => (
                            <ScorecardRow
                                key={row.index}
                                row={row}
                                expanded={expanded}
                                onToggle={setExpanded}
                            />
                        ))}
                    </ul>
                </section>
            )}
            {na.length > 0 && (
                <section className="flex flex-col gap-1">
                    <h4 className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                        Not statically checkable
                    </h4>
                    <ul className="flex flex-col">
                        {na.map((row) => (
                            <ScorecardRow
                                key={row.index}
                                row={row}
                                expanded={expanded}
                                onToggle={setExpanded}
                            />
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}
