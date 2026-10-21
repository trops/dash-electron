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
 *   - Checks that ARE testable from source live in scorecardChecks.js
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
import { useBuilderTheme } from "../useBuilderTheme";
import { evaluateScorecard } from "./scorecardChecks";

// The checks themselves (no React) — shared with the main process.
export { evaluateScorecard };

// Group rows by status for the rendered scorecard. Failed rules show
// first (most actionable — these are the things the user wants to fix),
// then passed (confirmation), then n/a
// (informational, can't be statically verified).
function groupRowsByStatus(rows) {
    const failed = rows.filter((r) => r.pass === false);
    const passed = rows.filter((r) => r.pass === true);
    const na = rows.filter((r) => r.pass === null);
    return { failed, passed, na };
}

function ScorecardRow({ row, expanded, onToggle }) {
    const bt = useBuilderTheme();
    const expandable = row.pass === false && row.matches.length > 0;
    const isOpen = expanded === row.index;
    const marker = row.pass === true ? "✓" : row.pass === false ? "✗" : "·";
    const markerTone =
        row.pass === true
            ? `${bt.status.success.icon}`
            : row.pass === false
            ? `${bt.status.error.icon}`
            : `${bt.muted}`;
    // Failing rows get a status tint (no border — the rows sit inside
    // the preview pane, which is already a bordered surface).
    const rowBg = row.pass === false ? `${bt.status.error.bg}` : "";
    const textTone = row.pass === null ? `${bt.muted}` : `${bt.text}`;

    return (
        <li
            data-testid={`acceptance-scorecard-row-${row.index}`}
            data-pass={row.pass === null ? "na" : String(row.pass)}
            className={`flex flex-col rounded-lg ${rowBg}`}
        >
            <div className="flex items-center gap-2">
                {/* The row itself is the disclosure for its matches. */}
                <button
                    type="button"
                    onClick={() =>
                        expandable
                            ? onToggle(isOpen ? null : row.index)
                            : undefined
                    }
                    disabled={!expandable}
                    aria-expanded={expandable ? isOpen : undefined}
                    className="flex items-start gap-3 px-2 py-2 text-left text-sm disabled:cursor-default flex-1 min-w-0"
                >
                    <span
                        className={`font-mono w-4 shrink-0 text-sm leading-snug ${markerTone}`}
                        aria-hidden="true"
                    >
                        {marker}
                    </span>
                    <span className={`flex-1 leading-snug ${textTone}`}>
                        {row.item}
                    </span>
                    {expandable && (
                        <span
                            className={`text-xs ${bt.status.error.icon} shrink-0`}
                        >
                            {isOpen ? "Hide" : "Details"}
                        </span>
                    )}
                </button>
            </div>
            {expandable && isOpen && (
                <ul
                    className={`ml-9 mb-2 mr-2 flex flex-col gap-1 font-mono text-xs ${bt.text}`}
                    data-testid={`acceptance-scorecard-matches-${row.index}`}
                >
                    {row.matches.map((m, i) => (
                        <li
                            key={i}
                            className={`${bt.surface} px-2 py-1 rounded`}
                        >
                            {m}
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
}

export function AcceptanceScorecard({ code }) {
    const bt = useBuilderTheme();
    const rows = useMemo(() => evaluateScorecard(code || ""), [code]);
    const [expanded, setExpanded] = useState(null);

    const { failed, passed, na } = groupRowsByStatus(rows);
    const passCount = passed.length;
    const failCount = failed.length;
    const naCount = na.length;
    const totalChecked = passCount + failCount;
    const headlineTone =
        failCount === 0
            ? `${bt.status.success.icon}`
            : `${bt.status.error.icon}`;
    const headline =
        failCount === 0
            ? totalChecked === 0
                ? "Awaiting widget code"
                : `All ${totalChecked} statically-checkable rules pass`
            : `${failCount} of ${totalChecked} rules failing — fix these in the Code tab`;

    return (
        <div data-testid="acceptance-scorecard" className="flex flex-col gap-3">
            <div
                className="flex items-center justify-between flex-wrap gap-2"
                data-testid="acceptance-scorecard-summary"
            >
                <span className={`text-sm font-semibold ${headlineTone}`}>
                    {headline}
                </span>
                <span className={`text-xs ${bt.muted}`}>
                    {passCount} pass · {failCount} fail · {naCount} n/a
                </span>
            </div>
            {failed.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h3 className={`text-sm font-semibold ${bt.text}`}>
                        Failing
                    </h3>
                    <ul className="flex flex-col gap-1">
                        {failed.map((row) => (
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
            {passed.length > 0 && (
                <section className="flex flex-col gap-2">
                    <h3 className={`text-sm font-semibold ${bt.text}`}>
                        Passing
                    </h3>
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
                <section className="flex flex-col gap-2">
                    <h3 className={`text-sm font-semibold ${bt.text}`}>
                        Not statically checkable
                    </h3>
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
