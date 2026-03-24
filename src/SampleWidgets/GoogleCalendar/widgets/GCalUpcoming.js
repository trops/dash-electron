/**
 * GCalUpcoming
 *
 * Chronological list of upcoming Google Calendar events.
 * Uses the `list-events` tool to fetch events.
 * Publishes `eventSelected` events when an event is clicked.
 *
 * @package Google Calendar
 */
import { useState, useEffect, useCallback } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { McpDebugLog } from "../components/McpDebugLog";
import { McpReauthBanner } from "../components/McpReauthBanner";
import { extractMcpText, safeParse } from "../utils/mcpUtils";

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

function formatTime(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
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

function isAllDay(event) {
    return !!(event.start?.date && !event.start?.dateTime);
}

function GCalUpcomingContent({ title }) {
    const {
        isConnected,
        isConnecting,
        error,
        tools,
        callTool,
        status,
        provider,
        connect,
        disconnect,
    } = useMcpProvider("google-calendar");

    const { publishEvent } = useWidgetEvents();

    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [debugLog, setDebugLog] = useState([]);
    const [selectedId, setSelectedId] = useState(null);

    const loadEvents = useCallback(async () => {
        setLoading(true);
        setErrorMsg(null);
        const now = new Date();
        const timeMin = toLocalISO(now);
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const timeMax = toLocalISO(weekEnd);

        const args = { calendarId: "primary", timeMin, timeMax };
        const entry = {
            id: Date.now(),
            timestamp: new Date(),
            toolName: "list-events",
            args,
            response: null,
            error: null,
            duration: 0,
        };
        const start = Date.now();
        try {
            const res = await callTool("list-events", args);
            entry.response = res;
            entry.duration = Date.now() - start;

            if (res?.isError) {
                const errText = extractMcpText(res);
                throw new Error(
                    errText || "list-events tool returned an error"
                );
            }

            const text = extractMcpText(res);
            const parsed = safeParse(text);

            if (typeof parsed === "string") {
                throw new Error(parsed || "Unexpected response format");
            }

            const list = Array.isArray(parsed)
                ? parsed
                : parsed?.events || parsed?.items || [];
            setEvents(list);
        } catch (err) {
            entry.error = err.message;
            entry.duration = Date.now() - start;
            setErrorMsg(err.message);
        } finally {
            setDebugLog((prev) => [entry, ...prev]);
            setLoading(false);
        }
    }, [callTool]);

    useEffect(() => {
        if (isConnected) {
            loadEvents();
        }
    }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleEventClick = useCallback(
        (event) => {
            const id = event.id || event.summary;
            setSelectedId(id);
            const payload = {
                id: event.id || null,
                title: event.summary || "Untitled Event",
                start: event.start?.dateTime || event.start?.date || null,
                end: event.end?.dateTime || event.end?.date || null,
                location: event.location || null,
            };
            if (publishEvent) {
                publishEvent("eventSelected", payload);
            }
        },
        [publishEvent]
    );

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

            {/* Refresh */}
            <div className="flex items-center gap-2">
                <button
                    onClick={loadEvents}
                    disabled={!isConnected || loading}
                    className="px-3 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                >
                    {loading ? "Loading..." : "Refresh"}
                </button>
                {events.length > 0 && (
                    <span className="text-xs text-gray-500">
                        {events.length} upcoming event
                        {events.length !== 1 ? "s" : ""}
                    </span>
                )}
            </div>

            {/* Loading State */}
            {loading && (
                <div className="space-y-2 animate-pulse">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-10 bg-white/5 rounded" />
                    ))}
                </div>
            )}

            {/* Event List */}
            {!loading && events.length > 0 && (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                    {events.map((event, i) => {
                        const eventId = event.id || i;
                        const isSelected = selectedId === eventId;
                        const allDay = isAllDay(event);
                        const startStr =
                            event.start?.dateTime || event.start?.date;
                        const endStr = event.end?.dateTime || event.end?.date;

                        return (
                            <button
                                key={eventId}
                                onClick={() => handleEventClick(event)}
                                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                    isSelected
                                        ? "bg-blue-800/40 border border-blue-600"
                                        : "bg-white/5 hover:bg-white/10 border border-transparent"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-gray-200 truncate">
                                            {event.summary || "Untitled Event"}
                                        </div>
                                        <div className="text-gray-500 mt-0.5">
                                            {formatDate(startStr)}{" "}
                                            {allDay
                                                ? "All day"
                                                : `${formatTime(
                                                      startStr
                                                  )} - ${formatTime(endStr)}`}
                                        </div>
                                        {event.location && (
                                            <div className="text-gray-600 truncate mt-0.5">
                                                {event.location}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Empty State */}
            {!loading && events.length === 0 && !errorMsg && (
                <div className="text-xs text-gray-600 italic">
                    No upcoming events found.
                </div>
            )}

            <McpReauthBanner
                error={errorMsg}
                provider={provider}
                catalogId="google-calendar"
                connect={connect}
                disconnect={disconnect}
                onReauthComplete={() => setErrorMsg(null)}
            />

            {errorMsg && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {errorMsg}
                </div>
            )}

            <McpDebugLog entries={debugLog} />
        </div>
    );
}

export const GCalUpcoming = ({ title = "Upcoming Events", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GCalUpcomingContent title={title} />
            </Panel>
        </Widget>
    );
};
