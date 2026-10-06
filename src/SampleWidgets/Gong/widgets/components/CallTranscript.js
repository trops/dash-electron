import { useContext } from "react";
import {
    Button2,
    Caption2,
    Skeleton,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";

export function CallTranscript({ transcript, loading, onLoadMore }) {
    const { currentTheme } = useContext(ThemeContext);
    const status = useStatusTokens();
    const bodyText = currentTheme?.["text-primary-medium"] || "";

    // One color per participant, rotated through theme-aware tokens so
    // speaker names follow light/dark theme switches.
    const SPEAKER_COLORS = [
        currentTheme?.["text-secondary-medium"] || "",
        currentTheme?.["text-tertiary-medium"] || "",
        status.info.icon,
        status.success.icon,
        status.warning.icon,
    ];

    if (loading && !transcript) {
        return (
            <div className="space-y-3">
                <Skeleton height="h-3" width="w-1/4" rounded="rounded" />
                <Skeleton height="h-3" width="w-full" rounded="rounded" />
                <Skeleton height="h-3" width="w-3/4" rounded="rounded" />
                <Skeleton height="h-3" width="w-1/3" rounded="rounded" />
                <Skeleton height="h-3" width="w-full" rounded="rounded" />
            </div>
        );
    }

    if (!transcript) return null;

    // gongio-mcp returns markdown text, not structured segments
    if (typeof transcript === "string") {
        return (
            <pre
                className={`whitespace-pre-wrap overflow-auto max-h-96 text-xs leading-relaxed ${bodyText}`}
            >
                {transcript}
            </pre>
        );
    }

    const segments = Array.isArray(transcript)
        ? transcript
        : transcript.segments || transcript.transcript || [];
    const speakerMap = {};
    let speakerIndex = 0;

    function getSpeakerColor(name) {
        if (!speakerMap[name]) {
            speakerMap[name] =
                SPEAKER_COLORS[speakerIndex % SPEAKER_COLORS.length];
            speakerIndex++;
        }
        return speakerMap[name];
    }

    return (
        <div className="space-y-2 text-xs">
            {segments.map((seg, i) => {
                const speaker =
                    seg.speakerName || seg.speaker || seg.name || "Unknown";
                const text = seg.text || seg.sentence || seg.content || "";
                const time = seg.start || seg.startTime;
                return (
                    <div key={i} className="flex gap-2">
                        <div className="flex-shrink-0 w-24">
                            <div
                                className={`font-bold truncate ${getSpeakerColor(
                                    speaker
                                )}`}
                            >
                                {speaker}
                            </div>
                            {time != null && (
                                <Caption2 block>{formatTime(time)}</Caption2>
                            )}
                        </div>
                        <div className={`flex-1 ${bodyText}`}>{text}</div>
                    </div>
                );
            })}
            {transcript.cursor && (
                <Button2
                    size="sm"
                    block
                    onClick={() => onLoadMore(transcript.cursor)}
                    disabled={loading}
                    className="mt-2"
                >
                    {loading ? "Loading..." : "Load More"}
                </Button2>
            )}
        </div>
    );
}

function formatTime(seconds) {
    if (typeof seconds !== "number") return String(seconds);
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}
