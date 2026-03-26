const SPEAKER_COLORS = [
    "text-blue-400",
    "text-green-400",
    "text-purple-400",
    "text-orange-400",
    "text-pink-400",
    "text-cyan-400",
];

export function CallTranscript({ transcript, loading, onLoadMore }) {
    if (loading && !transcript) {
        return (
            <div className="space-y-3 animate-pulse">
                <div className="h-3 bg-gray-700 rounded w-1/4" />
                <div className="h-3 bg-gray-700 rounded w-full" />
                <div className="h-3 bg-gray-700 rounded w-3/4" />
                <div className="h-3 bg-gray-700 rounded w-1/3" />
                <div className="h-3 bg-gray-700 rounded w-full" />
            </div>
        );
    }

    if (!transcript) return null;

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
                                <div className="text-gray-600 text-[10px]">
                                    {formatTime(time)}
                                </div>
                            )}
                        </div>
                        <div className="text-gray-300 flex-1">{text}</div>
                    </div>
                );
            })}
            {transcript.cursor && (
                <button
                    onClick={() => onLoadMore(transcript.cursor)}
                    disabled={loading}
                    className="w-full px-3 py-1.5 text-xs rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white mt-2"
                >
                    {loading ? "Loading..." : "Load More"}
                </button>
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
