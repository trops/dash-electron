<!-- scenario: 06-gcal-today -->
<!-- userPrompt: Show my next 5 calendar events for today. -->
<!-- exitCode: 0 -->
<!-- durationMs: 134595 -->

Here's a single-purpose widget that lists the next 5 calendar events for today from your Google Calendar MCP provider. It's defensive against the various response shapes Google Calendar MCP servers return, emits `eventSelected` when you click a row (so you can wire it to other widgets later), and exposes a `refreshEvents` scheduled task plus a manual Refresh button.

**File: `GoogleCalendarTodayEvents.js`**

```jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Panel,
    SubHeading2,
    Menu,
    MenuItem,
    Alert2,
    EmptyState,
    Skeleton,
    Caption,
    Paragraph,
    Button2,
} from "@trops/dash-react";
import {
    useMcpProvider,
    useWidgetEvents,
    useScheduler,
} from "@trops/dash-core";

export default function GoogleCalendarTodayEvents({
    title = "Today's events",
    maxEvents = 5,
    calendarId = "primary",
}) {
    const {
        callTool,
        tools,
        isConnected,
        error: mcpError,
    } = useMcpProvider("google-calendar");
    const { publishEvent } = useWidgetEvents();

    const [events, setEvents] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

    useScheduler({
        refreshEvents: refresh,
    });

    // The Google Calendar MCP ecosystem ships several servers with slightly
    // different tool names. Pick the best match from the advertised tools.
    const listEventsToolName = useMemo(() => {
        if (!Array.isArray(tools) || tools.length === 0) return null;
        const names = tools
            .map((t) => (typeof t === "string" ? t : t && t.name))
            .filter((n) => typeof n === "string");
        const exact = names.find((n) =>
            [
                "list-events",
                "list_events",
                "listEvents",
                "calendar_list_events",
            ].includes(n)
        );
        if (exact) return exact;
        const fuzzy = names.find((n) => /list.*event/i.test(n));
        if (fuzzy) return fuzzy;
        return names.find((n) => /event/i.test(n)) || null;
    }, [tools]);

    useEffect(() => {
        if (!isConnected || !listEventsToolName) return;
        const safeMax = Math.max(1, Math.min(50, Number(maxEvents) || 5));
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        let cancelled = false;
        setEvents(null);
        setLoadError(null);

        callTool(listEventsToolName, {
            calendarId,
            timeMin: startOfDay.toISOString(),
            timeMax: endOfDay.toISOString(),
            singleEvents: true,
            orderBy: "startTime",
            maxResults: 25,
        })
            .then((resp) => {
                if (cancelled) return;
                const raw = extractEventArray(resp);
                const upcoming = filterUpcomingToday(raw, new Date());
                setEvents(upcoming.slice(0, safeMax));
            })
            .catch((err) => {
                if (cancelled) return;
                setLoadError(err);
            });

        return () => {
            cancelled = true;
        };
    }, [
        isConnected,
        listEventsToolName,
        calendarId,
        maxEvents,
        refreshKey,
        callTool,
    ]);

    const onRowClick = (evt) => {
        publishEvent("eventSelected", {
            id: evt.id,
            summary: evt.summary,
            start: evt.startISO,
            end: evt.endISO,
            htmlLink: evt.htmlLink,
        });
    };

    if (mcpError) {
        return (
            <Panel>
                <SubHeading2 title={title} />
                <Alert2
                    title="Calendar connection failed"
                    message={(mcpError && mcpError.message) || String(mcpError)}
                />
            </Panel>
        );
    }

    if (
        isConnected &&
        Array.isArray(tools) &&
        tools.length > 0 &&
        !listEventsToolName
    ) {
        return (
            <Panel>
                <SubHeading2 title={title} />
                <Alert2
                    title="Unsupported MCP server"
                    message="The configured Google Calendar MCP server does not expose a list-events tool."
                />
            </Panel>
        );
    }

    if (!isConnected || !listEventsToolName) {
        return (
            <Panel>
                <SubHeading2 title={title} />
                <Skeleton.Text
                    lines={Math.max(1, Math.min(5, Number(maxEvents) || 5))}
                />
            </Panel>
        );
    }

    if (loadError) {
        return (
            <Panel>
                <SubHeading2 title={title} />
                <Alert2
                    title="Failed to load events"
                    message={
                        (loadError && loadError.message) || String(loadError)
                    }
                />
                <div className="mt-2">
                    <Button2 title="Retry" size="sm" onClick={refresh} />
                </div>
            </Panel>
        );
    }

    if (events === null) {
        return (
            <Panel>
                <SubHeading2 title={title} />
                <Skeleton.Text
                    lines={Math.max(1, Math.min(5, Number(maxEvents) || 5))}
                />
            </Panel>
        );
    }

    if (events.length === 0) {
        return (
            <Panel>
                <SubHeading2 title={title} />
                <EmptyState
                    title="Nothing left today"
                    description="No upcoming events on your calendar for the rest of today."
                >
                    <Button2 title="Refresh" size="sm" onClick={refresh} />
                </EmptyState>
            </Panel>
        );
    }

    return (
        <Panel>
            <SubHeading2 title={title} />
            <Menu>
                {events.map((evt) => (
                    <MenuItem key={evt.id} onClick={() => onRowClick(evt)}>
                        <div className="flex flex-col gap-0.5 py-1">
                            <Paragraph text={evt.summary || "(no title)"} />
                            <Caption text={formatTimeRange(evt)} />
                        </div>
                    </MenuItem>
                ))}
            </Menu>
            <div className="mt-2">
                <Button2 title="Refresh" size="sm" onClick={refresh} />
            </div>
        </Panel>
    );
}

// ---- helpers (pure, defensive) ---------------------------------------------

function extractEventArray(resp) {
    if (!resp) return [];
    if (Array.isArray(resp)) return resp;
    if (Array.isArray(resp.items)) return resp.items;
    if (Array.isArray(resp.events)) return resp.events;
    if (resp.result && Array.isArray(resp.result.items))
        return resp.result.items;
    if (resp.result && Array.isArray(resp.result.events))
        return resp.result.events;
    // MCP responses are often { content: [{ type: "text", text: "..." }] }
    if (Array.isArray(resp.content)) {
        for (const piece of resp.content) {
            if (
                piece &&
                piece.type === "text" &&
                typeof piece.text === "string"
            ) {
                try {
                    const parsed = JSON.parse(piece.text);
                    if (Array.isArray(parsed)) return parsed;
                    if (parsed && Array.isArray(parsed.items))
                        return parsed.items;
                    if (parsed && Array.isArray(parsed.events))
                        return parsed.events;
                } catch (_e) {
                    // text wasn't JSON; ignore and keep scanning
                }
            }
        }
    }
    return [];
}

function getStartISO(evt) {
    if (!evt || typeof evt !== "object") return null;
    const s = evt.start;
    if (!s) return evt.startTime || evt.startISO || null;
    if (typeof s === "string") return s;
    return s.dateTime || s.date || null;
}

function getEndISO(evt) {
    if (!evt || typeof evt !== "object") return null;
    const e = evt.end;
    if (!e) return evt.endTime || evt.endISO || null;
    if (typeof e === "string") return e;
    return e.dateTime || e.date || null;
}

function normalize(evt) {
    const startISO = getStartISO(evt);
    return {
        id:
            evt.id ||
            evt.eventId ||
            `${evt.summary || "event"}-${
                startISO || Math.random().toString(36).slice(2)
            }`,
        summary: evt.summary || evt.title || "(no title)",
        startISO,
        endISO: getEndISO(evt),
        htmlLink: evt.htmlLink || evt.url || null,
        allDay: Boolean(evt.start && evt.start.date && !evt.start.dateTime),
    };
}

function filterUpcomingToday(rawList, now) {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    return rawList
        .filter((e) => e && typeof e === "object")
        .map(normalize)
        .filter((e) => {
            if (!e.startISO) return false;
            const start = new Date(e.startISO);
            if (Number.isNaN(start.getTime())) return false;
            if (start > endOfDay) return false;
            if (e.allDay) {
                return start >= startOfDay && start <= endOfDay;
            }
            const endRef = e.endISO ? new Date(e.endISO) : start;
            return endRef >= now && start <= endOfDay;
        })
        .sort((a, b) => new Date(a.startISO) - new Date(b.startISO));
}

function formatTimeRange(evt) {
    if (!evt || !evt.startISO) return "";
    if (evt.allDay) return "All day";
    const start = new Date(evt.startISO);
    if (Number.isNaN(start.getTime())) return "";
    const opts = { hour: "numeric", minute: "2-digit" };
    const startStr = start.toLocaleTimeString([], opts);
    if (!evt.endISO) return startStr;
    const end = new Date(evt.endISO);
    if (Number.isNaN(end.getTime())) return startStr;
    return `${startStr} – ${end.toLocaleTimeString([], opts)}`;
}
```

**File: `GoogleCalendarTodayEvents.dash.js`**

```javascript
import GoogleCalendarTodayEvents from "./GoogleCalendarTodayEvents";

export default {
    component: GoogleCalendarTodayEvents,
    canHaveChildren: false,
    workspace: "ai-built",
    type: "widget",
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Today's events",
            displayName: "Title",
            instructions: "Heading shown at the top of the widget.",
            required: false,
        },
        maxEvents: {
            type: "number",
            defaultValue: 5,
            displayName: "Max events",
            instructions:
                "Maximum number of upcoming events to show for today (1-50).",
            required: false,
        },
        calendarId: {
            type: "text",
            defaultValue: "primary",
            displayName: "Calendar ID",
            instructions:
                "Google Calendar ID to read from. Use 'primary' for your main calendar.",
            required: false,
        },
    },
    providers: [
        { type: "google-calendar", providerClass: "mcp", required: true },
    ],
    events: ["eventSelected"],
    scheduledTasks: [
        {
            key: "refreshEvents",
            handler: "refreshEvents",
            displayName: "Refresh events",
            description: "Reload today's calendar events from Google Calendar.",
        },
    ],
};
```

**File: `dash.json`**

```json
{
    "name": "@ai-built/googlecalendartodayevents",
    "displayName": "Google Calendar — Today",
    "version": "1.0.0",
    "description": "Shows the next few upcoming events on your Google Calendar for today.",
    "author": "AI Assistant",
    "widgets": [
        {
            "name": "GoogleCalendarTodayEvents",
            "displayName": "Google Calendar — Today",
            "description": "Lists the next 5 upcoming events for today from Google Calendar."
        }
    ],
    "createdAt": "2026-05-20T00:00:00.000Z"
}
```

### What it does

-   Calls the Google Calendar MCP `list-events` tool (auto-detects the exact name advertised by your server — handles `list-events`, `list_events`, `listEvents`, or any fuzzy match) with `timeMin`/`timeMax` set to today's 00:00 → 23:59 in your local timezone.
-   Filters out events that have already ended, sorts by start time, and shows the next 5 (configurable via `Max events`).
-   Defensive parsing handles the raw `{ items: [...] }` shape, the `{ content: [{ type: "text", text: "<json>" }] }` shape, and several other variants — so it should work regardless of which Google Calendar MCP server you've connected.

### Events emitted

-   `eventSelected` — fires when a row is clicked, with `{ id, summary, start, end, htmlLink }`. Wire it from Settings → Configure → Event Handlers to another widget (e.g., a detail viewer or an attendee list) when you build one.

### Scheduled task

-   `refreshEvents` — open Settings → Schedule on the installed widget to set a cadence (e.g., every 5 minutes) so it auto-refreshes without you clicking Refresh.

### Permissions

-   This widget only reads events. No destructive MCP tool calls (no create / update / delete).

Click **Install** below to drop it onto a dashboard.
