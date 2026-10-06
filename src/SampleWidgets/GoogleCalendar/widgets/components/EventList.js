import { Caption2, Skeleton } from "@trops/dash-react";
import { EventItem } from "./EventItem";

export function EventList({ events, loading }) {
    if (loading) {
        return (
            <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} height="h-10" rounded="rounded" />
                ))}
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <Caption2 block className="italic">
                No events found
            </Caption2>
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
