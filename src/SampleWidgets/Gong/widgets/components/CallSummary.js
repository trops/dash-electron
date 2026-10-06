import { useContext } from "react";
import {
    AlertBanner,
    Caption2,
    Skeleton,
    Tag2,
    ThemeContext,
} from "@trops/dash-react";

export function CallSummary({ summary, loading }) {
    const { currentTheme } = useContext(ThemeContext);
    const bodyText = currentTheme?.["text-primary-medium"] || "";
    const accentText = currentTheme?.["text-secondary-medium"] || "";

    if (loading) {
        return (
            <div className="space-y-2">
                <Skeleton height="h-3" width="w-3/4" rounded="rounded" />
                <Skeleton height="h-3" width="w-1/2" rounded="rounded" />
                <Skeleton height="h-3" width="w-2/3" rounded="rounded" />
            </div>
        );
    }

    if (!summary) return null;

    // gongio-mcp returns markdown text, not structured JSON
    if (typeof summary === "string") {
        return (
            <pre
                className={`whitespace-pre-wrap overflow-auto max-h-96 text-xs leading-relaxed ${bodyText}`}
            >
                {summary}
            </pre>
        );
    }

    if (summary.error) {
        return (
            <AlertBanner
                variant="error"
                size="compact"
                message={summary.error}
            />
        );
    }

    return (
        <div className="space-y-3 text-xs">
            {summary.keyPoints?.length > 0 && (
                <div>
                    <Caption2 block className="font-medium mb-1">
                        Key Points
                    </Caption2>
                    <ul
                        className={`list-disc list-inside space-y-0.5 ${bodyText}`}
                    >
                        {summary.keyPoints.map((point, i) => (
                            <li key={i}>{point}</li>
                        ))}
                    </ul>
                </div>
            )}

            {summary.topics?.length > 0 && (
                <div>
                    <Caption2 block className="font-medium mb-1">
                        Topics
                    </Caption2>
                    <div className="flex flex-wrap gap-1">
                        {summary.topics.map((topic, i) => (
                            <Tag2
                                key={i}
                                text={topic}
                                padding="px-1.5 py-0.5"
                                border={false}
                            />
                        ))}
                    </div>
                </div>
            )}

            {summary.actionItems?.length > 0 && (
                <div>
                    <Caption2 block className="font-medium mb-1">
                        Action Items
                    </Caption2>
                    <ul className={`space-y-0.5 ${bodyText}`}>
                        {summary.actionItems.map((item, i) => (
                            <li key={i}>
                                {item.owner && (
                                    <span
                                        className={`font-medium ${accentText}`}
                                    >
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
                    <pre
                        className={`whitespace-pre-wrap overflow-auto max-h-48 ${bodyText}`}
                    >
                        {typeof summary === "string"
                            ? summary
                            : JSON.stringify(summary, null, 2)}
                    </pre>
                )}
        </div>
    );
}
