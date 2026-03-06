/**
 * GoogleCalendarWidget
 *
 * View today's agenda, upcoming meetings with join links, and create events
 * via a Google Calendar MCP provider (@cocal/google-calendar-mcp).
 *
 * @package Google Calendar
 */
import { useState, useCallback, useEffect } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider } from "@trops/dash-core";
import { EventList } from "./components/EventList";
import { CreateEventForm } from "./components/CreateEventForm";

function extractMcpText(res) {
    if (typeof res === "string") return res;
    if (res?.content && Array.isArray(res.content)) {
        return res.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n");
    }
    return JSON.stringify(res, null, 2);
}

function safeParse(text) {
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function toLocalISO(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return (
        date.getFullYear() +
        "-" +
        pad(date.getMonth() + 1) +
        "-" +
        pad(date.getDate()) +
        "T" +
        pad(date.getHours()) +
        ":" +
        pad(date.getMinutes()) +
        ":" +
        pad(date.getSeconds())
    );
}

function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return toLocalISO(d);
}

function endOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 0);
    return toLocalISO(d);
}

function groupEventsByDay(events) {
    const groups = {};
    for (const event of events) {
        const dateStr =
            event.start?.dateTime?.slice(0, 10) ||
            event.start?.date ||
            "Unknown";
        if (!groups[dateStr]) groups[dateStr] = [];
        groups[dateStr].push(event);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

function formatDayHeader(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
    return d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
    });
}

function GoogleCalendarContent({ title, defaultView }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("google-calendar");

    const [view, setView] = useState(defaultView || "today");
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [createLoading, setCreateLoading] = useState(false);

    const loadEvents = useCallback(
        async (viewType) => {
            setLoading(true);
            setErrorMsg(null);
            try {
                const now = new Date();
                let timeMin, timeMax;

                if (viewType === "today") {
                    timeMin = startOfDay(now);
                    timeMax = endOfDay(now);
                } else {
                    timeMin = startOfDay(now);
                    const weekEnd = new Date(now);
                    weekEnd.setDate(weekEnd.getDate() + 7);
                    timeMax = endOfDay(weekEnd);
                }

                const res = await callTool("list-events", {
                    calendarId: "primary",
                    timeMin,
                    timeMax,
                });
                console.log(
                    "[GoogleCalendar] Raw response:",
                    JSON.stringify(res, null, 2)
                );

                // Check for MCP-level errors
                if (res?.isError) {
                    const errText = extractMcpText(res);
                    throw new Error(
                        errText || "list-events tool returned an error"
                    );
                }

                const text = extractMcpText(res);
                const parsed = safeParse(text);

                // If safeParse returned a string, JSON parsing failed — treat as error
                if (typeof parsed === "string") {
                    throw new Error(parsed || "Unexpected response format");
                }

                const list = Array.isArray(parsed)
                    ? parsed
                    : parsed?.events || parsed?.items || [];
                setEvents(list);
            } catch (err) {
                setErrorMsg(err.message);
            } finally {
                setLoading(false);
            }
        },
        [callTool]
    );

    useEffect(() => {
        if (isConnected) {
            loadEvents(view);
        }
    }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleViewChange = (newView) => {
        setView(newView);
        if (newView !== "create" && isConnected) {
            loadEvents(newView);
        }
    };

    const handleCreateEvent = async (args) => {
        setCreateLoading(true);
        try {
            await callTool("create-event", args);
            setCreateLoading(false);
            return true;
        } catch (err) {
            setErrorMsg(err.message);
            setCreateLoading(false);
            return false;
        }
    };

    const viewButtons = [
        { key: "today", label: "Today" },
        { key: "week", label: "Week" },
        { key: "create", label: "Create" },
    ];

    const dayGroups = view === "week" ? groupEventsByDay(events) : null;

    return (
        <div className="flex flex-col gap-4 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

            {/* Connection Status */}
            <div className="flex items-center gap-2 text-xs">
                <span
                    className={`inline-block w-2 h-2 rounded-full ${
                        isConnected
                            ? "bg-green-500"
                            : isConnecting
                            ? "bg-yellow-500 animate-pulse"
                            : error
                            ? "bg-red-500"
                            : "bg-gray-500"
                    }`}
                />
                <span className="text-gray-400 font-mono">{status}</span>
                <span className="text-gray-600">({tools.length} tools)</span>
            </div>

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {/* View Toggle */}
            <div className="flex gap-1">
                {viewButtons.map((btn) => (
                    <button
                        key={btn.key}
                        onClick={() => handleViewChange(btn.key)}
                        className={`px-3 py-1 text-xs rounded transition-colors ${
                            view === btn.key
                                ? "bg-blue-600 text-white"
                                : "bg-white/5 text-gray-400 hover:bg-white/10"
                        }`}
                    >
                        {btn.label}
                    </button>
                ))}
                {view !== "create" && (
                    <button
                        onClick={() => loadEvents(view)}
                        disabled={!isConnected || loading}
                        className="ml-auto px-2 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        {loading ? "Loading..." : "Refresh"}
                    </button>
                )}
            </div>

            {/* Today View */}
            {view === "today" && (
                <EventList events={events} loading={loading} />
            )}

            {/* Week View */}
            {view === "week" && (
                <>
                    {loading ? (
                        <EventList events={[]} loading={true} />
                    ) : dayGroups && dayGroups.length > 0 ? (
                        <div className="space-y-3">
                            {dayGroups.map(([dateStr, dayEvents]) => (
                                <div key={dateStr}>
                                    <SubHeading3
                                        title={formatDayHeader(dateStr)}
                                    />
                                    <div className="mt-1">
                                        <EventList
                                            events={dayEvents}
                                            loading={false}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-xs text-gray-600 italic">
                            No events found
                        </div>
                    )}
                </>
            )}

            {/* Create View */}
            {view === "create" && (
                <CreateEventForm
                    onSubmit={handleCreateEvent}
                    loading={createLoading}
                />
            )}

            {errorMsg && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {errorMsg}
                </div>
            )}
        </div>
    );
}

export const GoogleCalendarWidget = ({
    title = "Calendar",
    defaultView = "today",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GoogleCalendarContent
                    title={title}
                    defaultView={defaultView}
                />
            </Panel>
        </Widget>
    );
};
