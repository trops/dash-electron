import { EventItem } from "./EventItem";

export function EventList({ events, loading }) {
    if (loading) {
        return (
            <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-white/5 rounded" />
                ))}
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="text-xs text-gray-600 italic">No events found</div>
        );
    }

    return (
        <div className="space-y-1">
            {events.map((event, i) => (
                <EventItem key={event.id || i} event={event} />
            ))}
        </div>
    );
}
