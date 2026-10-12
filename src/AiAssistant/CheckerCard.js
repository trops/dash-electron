import React, { useState } from "react";
import { runCostLabel } from "@trops/dash-core";
import { MAX_TEAM_FIXES, verdictOf } from "./teamCheck";

/**
 * CheckerCard — the Dash team's Checker on a just-installed widget, shown on
 * the Widget Builder's success screen (create-entry CRE-011 AC5). PASSED or
 * FAILED with what it saw; on FAILED, "Let Builder fix it" (at most twice)
 * or "Keep it anyway". A paused Checker says so and blocks nothing.
 *
 * @param {object} check  { phase: "checking"|"done"|"skipped"|"failed",
 *                          run?, reason?, soFar? }
 * @param {number} fixes  fixes already asked for
 * @param {object} bt     the builder theme (useBuilderTheme)
 */
export function CheckerCard({ check, fixes = 0, bt, onFix, onKeep, kept }) {
    const [showDetails, setShowDetails] = useState(false);
    if (!check) return null;
    const label = (
        <span
            className={`text-xs font-semibold uppercase tracking-wider ${bt.muted}`}
        >
            Checker
        </span>
    );
    if (check.phase === "skipped") {
        return (
            <div
                data-testid="checker-card"
                className={`w-full max-w-xl rounded-lg border ${bt.border} px-4 py-3 text-sm flex flex-row gap-3 items-center`}
            >
                {label}
                <span className={bt.muted}>
                    Not checked —{" "}
                    {check.reason || "the Checker isn't available"}.
                </span>
            </div>
        );
    }
    if (check.phase === "checking") {
        return (
            <div
                data-testid="checker-card"
                className={`w-full max-w-xl rounded-lg border ${bt.border} px-4 py-3 text-sm flex flex-col gap-2`}
            >
                <div className="flex flex-row gap-3 items-center">
                    {label}
                    <span className={bt.muted}>Checking the widget…</span>
                </div>
                {check.soFar ? (
                    <pre
                        className={`whitespace-pre-wrap font-mono text-xs ${bt.muted}`}
                    >
                        {check.soFar}
                    </pre>
                ) : null}
            </div>
        );
    }
    const run = check.run || {};
    const answer = run.output || run.error || "";
    const verdict =
        check.phase === "failed" ? null : verdictOf(answer) || "UNCLEAR";
    const meta = runCostLabel(run);
    const canFix = verdict === "FAILED" && fixes < MAX_TEAM_FIXES && !kept;
    return (
        <div
            data-testid="checker-card"
            className={`w-full max-w-xl rounded-lg border ${bt.border} px-4 py-3 text-sm flex flex-col gap-3`}
        >
            <div className="flex flex-row gap-3 items-center flex-wrap">
                {label}
                <span
                    data-testid="checker-verdict"
                    className={`font-semibold ${
                        verdict === "PASSED"
                            ? bt.status.success.icon
                            : verdict === "FAILED"
                            ? bt.status.error.icon
                            : bt.text
                    }`}
                >
                    {check.phase === "failed"
                        ? "Couldn't check it"
                        : verdict === "PASSED"
                        ? "Passed"
                        : verdict === "FAILED"
                        ? "Failed"
                        : "No verdict"}
                </span>
                {meta ? (
                    <span className={`text-xs ${bt.muted}`}>{meta}</span>
                ) : null}
            </div>
            {/* Passed: the report on request; otherwise shown — it's what the
                user decides on. A fixed height either way (inline: the
                prebuilt CSS has no max-height utilities). */}
            {answer && verdict === "PASSED" ? (
                <button
                    type="button"
                    onClick={() => setShowDetails((v) => !v)}
                    className={`self-start text-xs underline ${bt.muted}`}
                >
                    {showDetails
                        ? "Hide what it checked"
                        : "Show what it checked"}
                </button>
            ) : null}
            {answer && (verdict !== "PASSED" || showDetails) ? (
                <pre
                    data-testid="checker-answer"
                    style={{ maxHeight: "14rem", overflowY: "auto" }}
                    className={`whitespace-pre-wrap font-mono text-xs ${bt.text}`}
                >
                    {answer}
                </pre>
            ) : null}
            {verdict === "FAILED" && !kept ? (
                <div className="flex flex-row gap-3 items-center flex-wrap">
                    {canFix ? (
                        <button
                            type="button"
                            onClick={onFix}
                            className={`px-4 py-2 rounded-lg ${bt.primaryFill} text-sm font-medium transition-colors`}
                        >
                            Let Builder fix it
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={onKeep}
                        className={`px-4 py-2 rounded-lg ${bt.raised} ${bt.hoverSurface} ${bt.text} text-sm font-medium transition-colors`}
                    >
                        Keep it anyway
                    </button>
                    <span className={`text-xs ${bt.muted}`}>
                        {canFix
                            ? `fix ${fixes + 1} of ${MAX_TEAM_FIXES}`
                            : `Still failing after ${MAX_TEAM_FIXES} fixes — over to you.`}
                    </span>
                </div>
            ) : null}
        </div>
    );
}

export default CheckerCard;
