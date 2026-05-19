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

// Each entry maps an item index (0-based in ACCEPTANCE_CHECKLIST) to
// a predicate that returns `{ pass: boolean, matches: string[] }`.
// Items without a predicate render with a "not statically checkable"
// indicator — they're still on the rubric, the scorecard just can't
// verify them mechanically.
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
    // 2 — Loading state.
    2: (code) => {
        const usesSkeleton = /\bSkeleton(\.Text|\.Card)?\b/.test(code);
        const usesIsLoadingBranch = /\bloading\s*\?|\bisLoading\b/.test(code);
        return {
            pass: usesSkeleton || usesIsLoadingBranch,
            matches: [],
        };
    },
    // 3 — Empty state.
    3: (code) => ({
        pass: /<EmptyState\b/.test(code),
        matches: [],
    }),
    // 4 — Error state (visible, not just console).
    4: (code) => ({
        pass: /<Alert\b|<Alert2\b|<Alert3\b|<ErrorMessage\b/.test(code),
        matches: [],
    }),
    // 5 — Provider hook (useMcpProvider OR useWidgetProviders).
    5: (code) => {
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
    //      flag.
    15: (code) => {
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

export function AcceptanceScorecard({ code }) {
    const rows = useMemo(() => evaluateScorecard(code || ""), [code]);
    const [expanded, setExpanded] = useState(null);

    const passCount = rows.filter((r) => r.pass === true).length;
    const failCount = rows.filter((r) => r.pass === false).length;
    const naCount = rows.filter((r) => r.pass === null).length;

    return (
        <div
            data-testid="acceptance-scorecard"
            className="flex flex-col gap-1 text-xs"
        >
            <div
                className="flex items-center justify-between"
                data-testid="acceptance-scorecard-summary"
            >
                <span className="font-medium">Acceptance scorecard</span>
                <span className="text-gray-500">
                    {passCount} pass · {failCount} fail · {naCount} n/a
                </span>
            </div>
            <ul className="flex flex-col gap-0.5">
                {rows.map((row) => {
                    const marker =
                        row.pass === true
                            ? "✓"
                            : row.pass === false
                            ? "✗"
                            : "·";
                    const tone =
                        row.pass === true
                            ? "text-emerald-400"
                            : row.pass === false
                            ? "text-rose-400"
                            : "text-gray-500";
                    const expandable =
                        row.pass === false && row.matches.length > 0;
                    const isOpen = expanded === row.index;
                    return (
                        <li
                            key={row.index}
                            data-testid={`acceptance-scorecard-row-${row.index}`}
                            data-pass={
                                row.pass === null ? "na" : String(row.pass)
                            }
                            className="flex flex-col"
                        >
                            <button
                                type="button"
                                onClick={() =>
                                    expandable
                                        ? setExpanded(isOpen ? null : row.index)
                                        : undefined
                                }
                                disabled={!expandable}
                                className="flex items-start gap-2 text-left disabled:cursor-default"
                            >
                                <span className={`font-mono w-3 ${tone}`}>
                                    {marker}
                                </span>
                                <span>{row.item}</span>
                            </button>
                            {expandable && isOpen && (
                                <ul
                                    className="ml-5 mt-0.5 flex flex-col gap-0.5 font-mono"
                                    data-testid={`acceptance-scorecard-matches-${row.index}`}
                                >
                                    {row.matches.map((m, i) => (
                                        <li key={i}>{m}</li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
