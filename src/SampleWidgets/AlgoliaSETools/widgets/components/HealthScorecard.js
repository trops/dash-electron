/**
 * HealthScorecard
 *
 * Renders the index health report as a scorecard with colored status indicators.
 * Status colors come from useStatusTokens() so they follow light/dark themes.
 */

import { useContext } from "react";
import {
    SectionLabel,
    Caption2,
    ProgressBar2,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";

const STATUS_META = {
    pass: { tone: "success", label: "Pass" },
    warn: { tone: "warning", label: "Warning" },
    fail: { tone: "error", label: "Fail" },
};

export function HealthScorecard({ score, maxScore, checks }) {
    const { currentTheme } = useContext(ThemeContext);
    const status = useStatusTokens();

    const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    const passCount = checks.filter((c) => c.status === "pass").length;
    const warnCount = checks.filter((c) => c.status === "warn").length;
    const failCount = checks.filter((c) => c.status === "fail").length;

    // Group by category
    const categories = {};
    for (const check of checks) {
        const cat = check.category || "General";
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(check);
    }

    // Theme tokens: score tile and check rows sit one step above the Panel.
    const surface = currentTheme?.["bg-primary-dark"] || "";
    const bodyText = currentTheme?.["text-primary-medium"] || "";
    const accentText = currentTheme?.["text-secondary-medium"] || "";

    const overall =
        pct >= 80 ? status.success : pct >= 50 ? status.warning : status.error;

    return (
        <div className="space-y-3">
            {/* Overall Score */}
            <div className={`flex items-center gap-3 p-3 rounded ${surface}`}>
                <div className="flex flex-col items-center">
                    <span className={`text-2xl font-bold ${overall.icon}`}>
                        {pct}%
                    </span>
                    <Caption2 className="uppercase">Health</Caption2>
                </div>
                <div className="flex-1">
                    <ProgressBar2
                        value={pct}
                        size="sm"
                        fillColor={overall.solidBg}
                    />
                    <div className="flex flex-wrap gap-3 mt-1 text-xs">
                        <span className={status.success.icon}>
                            {passCount} passed
                        </span>
                        {warnCount > 0 && (
                            <span className={status.warning.icon}>
                                {warnCount} warning{warnCount !== 1 ? "s" : ""}
                            </span>
                        )}
                        {failCount > 0 && (
                            <span className={status.error.icon}>
                                {failCount} failed
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Checks by Category */}
            {Object.entries(categories).map(([category, catChecks]) => (
                <div key={category} className="space-y-1">
                    <SectionLabel className="px-1">{category}</SectionLabel>
                    {catChecks.map((check, i) => {
                        const meta = STATUS_META[check.status];
                        const tone = status[meta.tone];
                        return (
                            <div
                                key={i}
                                className={`px-2 py-1.5 rounded ${surface}`}
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`inline-block w-2 h-2 rounded-full ${tone.solidBg}`}
                                    />
                                    <span
                                        className={`text-xs font-medium flex-1 ${bodyText}`}
                                    >
                                        {check.name}
                                    </span>
                                    <span className={`text-xs ${tone.icon}`}>
                                        {meta.label}
                                    </span>
                                </div>
                                <Caption2 block className="pl-4 mt-0.5">
                                    {check.detail}
                                </Caption2>
                                {check.recommendation && (
                                    <div
                                        className={`text-xs pl-4 mt-0.5 ${accentText}`}
                                    >
                                        Rec: {check.recommendation}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
