/**
 * GCalUpcoming
 *
 * Chronological list of upcoming Google Calendar events.
 * Uses the `list-events` tool to fetch events.
 * Publishes `eventSelected` events when an event is clicked.
 *
 * @package Google Calendar
 */
import { useState, useEffect, useCallback, useContext } from "react";
import {
    Button2,
    Panel,
    SubHeading2,
    AlertBanner,
    Caption2,
    ThemeContext,
    useStatusTokens,
    Skeleton,
} from "@trops/dash-react";
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
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();
    const rowSurface = `${currentTheme?.["bg-primary-dark"] || ""} ${
        currentTheme?.["hover-bg-primary-dark"] || ""
    }`;
    const selectedSurface = `border ${
        currentTheme?.["bg-secondary-dark"] || ""
    } ${currentTheme?.["text-secondary-light"] || ""} ${
        currentTheme?.["border-secondary-medium"] || ""
    }`;
    const bodyText = currentTheme?.["text-primary-medium"] || "";

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
                            ? statusTokens.success.solidBg
                            : isConnecting
                            ? `${statusTokens.warning.solidBg} animate-pulse`
                            : error
                            ? statusTokens.error.solidBg
                            : currentTheme?.["bg-primary-medium"] || ""
                    }`}
                />
                <Caption2 className="font-mono">{status}</Caption2>
                <Caption2 className="opacity-70">
                    ({tools.length} tools)
                </Caption2>
            </div>

            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
            )}

            {/* Refresh */}
            <div className="flex items-center gap-2">
                <Button2
                    size="sm"
                    onClick={loadEvents}
                    disabled={!isConnected || loading}
                >
                    {loading ? "Loading..." : "Refresh"}
                </Button2>
                {events.length > 0 && (
                    <Caption2>
                        {events.length} upcoming event
                        {events.length !== 1 ? "s" : ""}
                    </Caption2>
                )}
            </div>

            {/* Loading State */}
            {loading && (
                <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} height="h-10" rounded="rounded" />
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
                                        ? selectedSurface
                                        : `${rowSurface} ${bodyText} border border-transparent`
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate">
                                            {event.summary || "Untitled Event"}
                                        </div>
                                        <Caption2 block className="mt-0.5">
                                            {formatDate(startStr)}{" "}
                                            {allDay
                                                ? "All day"
                                                : `${formatTime(
                                                      startStr
                                                  )} - ${formatTime(endStr)}`}
                                        </Caption2>
                                        {event.location && (
                                            <Caption2
                                                block
                                                className="truncate mt-0.5 opacity-70"
                                            >
                                                {event.location}
                                            </Caption2>
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
                <Caption2 block className="italic">
                    No upcoming events found.
                </Caption2>
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
                <AlertBanner
                    variant="error"
                    size="compact"
                    message={errorMsg}
                />
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
