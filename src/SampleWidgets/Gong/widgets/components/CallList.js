export function CallList({ calls, onSelectCall }) {
    if (calls.length === 0) {
        return (
            <div className="text-xs text-gray-600 italic">No calls found</div>
        );
    }

    return (
        <div className="max-h-96 overflow-y-auto space-y-1">
            {calls.map((call, i) => (
                <button
                    key={call.id || call.metaData?.id || call.callId || i}
                    onClick={() => onSelectCall(call)}
                    className="w-full text-left px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded text-xs transition-colors"
                >
                    <div className="text-gray-300 truncate">
                        {call.title ||
                            call.metaData?.title ||
                            call.subject ||
                            call.name ||
                            "Untitled"}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-gray-500">
                        {(call.started ||
                            call.date ||
                            call.metaData?.started) && (
                            <span>
                                {formatDate(
                                    call.started ||
                                        call.date ||
                                        call.metaData?.started
                                )}
                            </span>
                        )}
                        {(call.duration ?? call.metaData?.duration) != null && (
                            <span>
                                {Math.round(
                                    (call.duration ?? call.metaData?.duration) /
                                        60
                                )}
                                m
                            </span>
                        )}
                        {call.scope && (
                            <span className="text-gray-600">{call.scope}</span>
                        )}
                        {call.parties?.length > 0 && (
                            <span>
                                {call.parties.length} participant
                                {call.parties.length !== 1 ? "s" : ""}
                            </span>
                        )}
                    </div>
                </button>
            ))}
        </div>
    );
}

/** Display a date string — handles ISO dates and short formats like "3/24/2026". */
function formatDate(value) {
    if (!value) return "";
    // If it's already a short human-readable string, use as-is
    if (typeof value === "string" && !value.includes("T")) return value;
    try {
        return new Date(value).toLocaleDateString();
    } catch {
        return String(value);
    }
}
