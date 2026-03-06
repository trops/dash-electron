function formatTime(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getJoinLink(event) {
    if (event.hangoutLink) return event.hangoutLink;
    if (event.conferenceData?.entryPoints) {
        const video = event.conferenceData.entryPoints.find(
            (ep) => ep.entryPointType === "video"
        );
        if (video?.uri) return video.uri;
    }
    const desc = event.description || "";
    const loc = event.location || "";
    const combined = desc + " " + loc;
    const zoomMatch = combined.match(
        /https:\/\/[a-z0-9.-]*zoom\.us\/j\/[^\s<)"]+/i
    );
    if (zoomMatch) return zoomMatch[0];
    const meetMatch = combined.match(/https:\/\/meet\.google\.com\/[^\s<)"]+/i);
    if (meetMatch) return meetMatch[0];
    return null;
}

function isAllDay(event) {
    return !!(event.start?.date && !event.start?.dateTime);
}

export function EventItem({ event }) {
    const joinLink = getJoinLink(event);
    const allDay = isAllDay(event);
    const startTime = allDay
        ? "All day"
        : formatTime(event.start?.dateTime || event.start?.date);
    const endTime = allDay
        ? null
        : formatTime(event.end?.dateTime || event.end?.date);

    return (
        <div className="px-2 py-1.5 bg-white/5 rounded text-xs">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="text-gray-200 truncate">
                        {event.summary || "Untitled Event"}
                    </div>
                    <div className="text-gray-500 mt-0.5">
                        {startTime}
                        {endTime && ` - ${endTime}`}
                    </div>
                    {event.location && (
                        <div className="text-gray-600 truncate mt-0.5">
                            {event.location}
                        </div>
                    )}
                </div>
                {joinLink && (
                    <a
                        href={joinLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 px-2 py-0.5 bg-blue-600 hover:bg-blue-500 rounded text-white text-xs"
                    >
                        Join
                    </a>
                )}
            </div>
        </div>
    );
}
