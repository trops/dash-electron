/**
 * GCalEventDetail
 *
 * Display full details for a selected Google Calendar event.
 * Listens for `eventSelected` events and uses the `list-events` tool
 * to fetch details for the selected event.
 *
 * @package Google Calendar
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
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

function formatDateTime(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function MetadataRow({ label, value, multiline }) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-2 py-1.5 border-b border-gray-800 last:border-b-0">
            <span className="text-gray-500 text-[10px] uppercase tracking-wide w-20 shrink-0 pt-0.5">
                {label}
            </span>
            <span
                className={`text-gray-300 text-xs ${
                    multiline ? "whitespace-pre-wrap" : ""
                } break-words`}
            >
                {value}
            </span>
        </div>
    );
}

function GCalEventDetailContent({ title }) {
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

    const { listen, listeners } = useWidgetEvents();

    const [selectedEvent, setSelectedEvent] = useState(null);
    const [eventDetail, setEventDetail] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [debugLog, setDebugLog] = useState([]);

    const handlerRef = useRef(null);

    const loadEventDetail = useCallback(
        async (eventInfo) => {
            if (!eventInfo?.start) {
                // If we only have basic info (from pub/sub), show what we have
                setEventDetail(eventInfo);
                return;
            }
            setLoading(true);
            setErrorMsg(null);
            setEventDetail(null);

            // Query around the event's time window to find it
            const startDate = new Date(eventInfo.start);
            const endDate = new Date(eventInfo.end || eventInfo.start);
            // Expand window slightly to ensure we capture it
            startDate.setHours(startDate.getHours() - 1);
            endDate.setHours(endDate.getHours() + 1);

            const args = {
                calendarId: "primary",
                timeMin: toLocalISO(startDate),
                timeMax: toLocalISO(endDate),
            };
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

                // Find the matching event by id or title
                const match = list.find(
                    (e) =>
                        (eventInfo.id && e.id === eventInfo.id) ||
                        e.summary === eventInfo.title
                );
                setEventDetail(
                    match || {
                        summary: eventInfo.title,
                        start: { dateTime: eventInfo.start },
                        end: { dateTime: eventInfo.end },
                        location: eventInfo.location,
                    }
                );
            } catch (err) {
                entry.error = err.message;
                entry.duration = Date.now() - start;
                setErrorMsg(err.message);
            } finally {
                setDebugLog((prev) => [entry, ...prev]);
                setLoading(false);
            }
        },
        [callTool]
    );

    handlerRef.current = useCallback(
        (data) => {
            const eventInfo = data.message || data;
            setSelectedEvent(eventInfo);
            if (isConnected) {
                loadEventDetail(eventInfo);
            } else {
                setEventDetail(eventInfo);
            }
        },
        [isConnected, loadEventDetail]
    );

    useEffect(() => {
        if (listeners && listen) {
            const hasListeners =
                typeof listeners === "object" &&
                Object.keys(listeners).length > 0;
            if (hasListeners) {
                const handlers = {
                    eventSelected: (data) => handlerRef.current(data),
                };
                listen(listeners, handlers);
            }
        }
    }, [listeners, listen]);

    // Format attendees list
    const attendeesList =
        eventDetail?.attendees
            ?.map(
                (a) =>
                    `${a.displayName || a.email}${
                        a.responseStatus ? ` (${a.responseStatus})` : ""
                    }`
            )
            .join("\n") || null;

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

            {/* Loading State */}
            {loading && (
                <div className="space-y-2 animate-pulse">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-6 bg-white/5 rounded" />
                    ))}
                </div>
            )}

            {/* Event Detail */}
            {!loading && eventDetail && (
                <div className="space-y-2">
                    <SubHeading3
                        title={
                            eventDetail.summary ||
                            eventDetail.title ||
                            "Untitled Event"
                        }
                    />
                    <div className="bg-white/5 rounded p-2">
                        <MetadataRow
                            label="Title"
                            value={eventDetail.summary || eventDetail.title}
                        />
                        <MetadataRow
                            label="Start"
                            value={formatDateTime(
                                eventDetail.start?.dateTime ||
                                    eventDetail.start?.date ||
                                    eventDetail.start
                            )}
                        />
                        <MetadataRow
                            label="End"
                            value={formatDateTime(
                                eventDetail.end?.dateTime ||
                                    eventDetail.end?.date ||
                                    eventDetail.end
                            )}
                        />
                        <MetadataRow
                            label="Location"
                            value={eventDetail.location}
                        />
                        <MetadataRow
                            label="Description"
                            value={eventDetail.description}
                            multiline
                        />
                        <MetadataRow
                            label="Organizer"
                            value={
                                eventDetail.organizer?.displayName ||
                                eventDetail.organizer?.email
                            }
                        />
                        <MetadataRow
                            label="Attendees"
                            value={attendeesList}
                            multiline
                        />
                        <MetadataRow
                            label="Status"
                            value={eventDetail.status}
                        />
                        <MetadataRow
                            label="Link"
                            value={
                                eventDetail.htmlLink || eventDetail.hangoutLink
                            }
                        />
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!loading && !eventDetail && !selectedEvent && (
                <div className="text-xs text-gray-600 italic">
                    Select an event from GCalUpcoming to view its details.
                </div>
            )}

            {!loading && !eventDetail && selectedEvent && !errorMsg && (
                <div className="text-xs text-gray-600 italic">
                    No details available for "{selectedEvent.title}".
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

export const GCalEventDetail = ({ title = "Event Details", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GCalEventDetailContent title={title} />
            </Panel>
        </Widget>
    );
};
