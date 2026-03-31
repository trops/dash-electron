/**
 * HealthScorecard
 *
 * Renders the index health report as a scorecard with colored status indicators.
 */

const STATUS_STYLES = {
    pass: {
        dot: "bg-green-500",
        text: "text-green-400",
        label: "Pass",
    },
    warn: {
        dot: "bg-yellow-500",
        text: "text-yellow-400",
        label: "Warning",
    },
    fail: {
        dot: "bg-red-500",
        text: "text-red-400",
        label: "Fail",
    },
};

export function HealthScorecard({ score, maxScore, checks }) {
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

    return (
        <div className="space-y-3">
            {/* Overall Score */}
            <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded">
                <div className="flex flex-col items-center">
                    <span
                        className={`text-2xl font-bold ${
                            pct >= 80
                                ? "text-green-400"
                                : pct >= 50
                                ? "text-yellow-400"
                                : "text-red-400"
                        }`}
                    >
                        {pct}%
                    </span>
                    <span className="text-[10px] text-gray-500 uppercase">
                        Health
                    </span>
                </div>
                <div className="flex-1">
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${
                                pct >= 80
                                    ? "bg-green-500"
                                    : pct >= 50
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                            }`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    <div className="flex gap-3 mt-1 text-[10px]">
                        <span className="text-green-400">
                            {passCount} passed
                        </span>
                        {warnCount > 0 && (
                            <span className="text-yellow-400">
                                {warnCount} warning{warnCount !== 1 ? "s" : ""}
                            </span>
                        )}
                        {failCount > 0 && (
                            <span className="text-red-400">
                                {failCount} failed
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Checks by Category */}
            {Object.entries(categories).map(([category, catChecks]) => (
                <div key={category} className="space-y-1">
                    <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wide px-1">
                        {category}
                    </div>
                    {catChecks.map((check, i) => {
                        const style = STATUS_STYLES[check.status];
                        return (
                            <div
                                key={i}
                                className="px-2 py-1.5 bg-gray-800/30 rounded"
                            >
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`inline-block w-2 h-2 rounded-full ${style.dot}`}
                                    />
                                    <span className="text-xs text-gray-300 font-medium flex-1">
                                        {check.name}
                                    </span>
                                    <span
                                        className={`text-[10px] ${style.text}`}
                                    >
                                        {style.label}
                                    </span>
                                </div>
                                <div className="text-[11px] text-gray-400 pl-4 mt-0.5">
                                    {check.detail}
                                </div>
                                {check.recommendation && (
                                    <div className="text-[11px] text-blue-400 pl-4 mt-0.5">
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
