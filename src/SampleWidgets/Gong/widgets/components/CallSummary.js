export function CallSummary({ summary, loading }) {
    if (loading) {
        return (
            <div className="space-y-2 animate-pulse">
                <div className="h-3 bg-gray-700 rounded w-3/4" />
                <div className="h-3 bg-gray-700 rounded w-1/2" />
                <div className="h-3 bg-gray-700 rounded w-2/3" />
            </div>
        );
    }

    if (!summary) return null;

    // gongio-mcp returns markdown text, not structured JSON
    if (typeof summary === "string") {
        return (
            <pre className="whitespace-pre-wrap text-gray-300 overflow-auto max-h-[60vh] text-xs leading-relaxed">
                {summary}
            </pre>
        );
    }

    if (summary.error) {
        return (
            <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                {summary.error}
            </div>
        );
    }

    return (
        <div className="space-y-3 text-xs">
            {summary.keyPoints?.length > 0 && (
                <div>
                    <div className="text-gray-400 font-medium mb-1">
                        Key Points
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-gray-300">
                        {summary.keyPoints.map((point, i) => (
                            <li key={i}>{point}</li>
                        ))}
                    </ul>
                </div>
            )}

            {summary.topics?.length > 0 && (
                <div>
                    <div className="text-gray-400 font-medium mb-1">Topics</div>
                    <div className="flex flex-wrap gap-1">
                        {summary.topics.map((topic, i) => (
                            <span
                                key={i}
                                className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] text-gray-300"
                            >
                                {topic}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {summary.actionItems?.length > 0 && (
                <div>
                    <div className="text-gray-400 font-medium mb-1">
                        Action Items
                    </div>
                    <ul className="space-y-0.5 text-gray-300">
                        {summary.actionItems.map((item, i) => (
                            <li key={i}>
                                {item.owner && (
                                    <span className="text-emerald-400 font-medium">
                                        {item.owner}:{" "}
                                    </span>
                                )}
                                {item.text || item.snippet || item}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {!summary.keyPoints?.length &&
                !summary.topics?.length &&
                !summary.actionItems?.length && (
                    <pre className="whitespace-pre-wrap text-gray-300 overflow-auto max-h-48">
                        {typeof summary === "string"
                            ? summary
                            : JSON.stringify(summary, null, 2)}
                    </pre>
                )}
        </div>
    );
}
