/**
 * ChecksStatus — where the Widget Builder's checks stand, beside Install
 * (Widget Builder edit fixes; draftCheck.js): checking the code, the
 * Checker reviewing it, fixing what they found, checked — or problems left,
 * which nothing can be installed with (ask for changes, or save a draft).
 *
 * @param {object|null} check  { phase: "checking" | "reviewing" | "fixing"
 *   | "passed" | "failed", lines?: string[], review?: string,
 *   fixes?: number, reviewSkipped?: string, canRetry?: boolean }
 *   canRetry: the check couldn't run (not a problem in the code) — offer
 *   Check again (onRetry).
 * @param {object} bt  the builder theme (useBuilderTheme)
 * @param {boolean} waiting  the AI is still replying — nothing counts yet
 */
import React, { useState } from "react";
import { Button3 } from "@trops/dash-react";
import { MAX_CHECK_FIXES } from "./draftCheck";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function ChecksStatus({ check, bt, waiting = false, onRetry = null }) {
    const [showReview, setShowReview] = useState(false);
    if (waiting) {
        return (
            <div
                className="flex flex-col gap-1 text-xs min-w-0"
                data-testid="draft-check-status"
                role="status"
            >
                <span className={bt.muted}>Waiting for the AI to finish…</span>
            </div>
        );
    }
    if (!check || !check.phase) return null;
    const lines = Array.isArray(check.lines) ? check.lines : [];
    const status = bt.status || {};
    const headline =
        check.phase === "checking"
            ? "Checking the code…"
            : check.phase === "reviewing"
            ? "The Checker is reviewing it…"
            : check.phase === "fixing"
            ? `Fixing ${plural(lines.length || 1, "problem")} · try ${
                  check.fixes || 1
              } of ${MAX_CHECK_FIXES}`
            : check.phase === "passed"
            ? check.reviewSkipped
                ? `Checked — the Checker's review was skipped: ${check.reviewSkipped}`
                : "Checked ✓"
            : `Not ready to install — ${plural(
                  lines.length || 1,
                  "problem"
              )} left`;
    const tone =
        check.phase === "passed"
            ? (status.success && status.success.icon) || bt.text
            : check.phase === "failed"
            ? (status.error && status.error.icon) || bt.text
            : bt.muted;
    return (
        <div
            className="flex flex-col gap-1 text-xs min-w-0"
            data-testid="draft-check-status"
            role="status"
        >
            <span className={tone}>{headline}</span>
            {check.phase === "failed" ? (
                <div className="flex flex-col gap-1">
                    {lines.map((l, i) => (
                        <span
                            key={i}
                            className={`whitespace-pre-wrap ${bt.text}`}
                        >
                            · {l}
                        </span>
                    ))}
                    {check.canRetry && onRetry ? (
                        <div className="flex items-center gap-2">
                            <Button3
                                size="sm"
                                title="Check again"
                                onClick={onRetry}
                            />
                            <span className={bt.muted}>
                                or save it as a draft.
                            </span>
                        </div>
                    ) : (
                        <span className={bt.muted}>
                            Ask for changes in the chat, or save it as a draft.
                        </span>
                    )}
                    {check.review ? (
                        <div className="flex flex-col gap-1">
                            <div>
                                <Button3
                                    size="sm"
                                    title={
                                        showReview
                                            ? "Hide the Checker's answer"
                                            : "Show the Checker's answer"
                                    }
                                    onClick={() => setShowReview((v) => !v)}
                                />
                            </div>
                            {showReview ? (
                                <span
                                    className={`whitespace-pre-wrap font-mono ${bt.muted}`}
                                >
                                    {check.review}
                                </span>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
