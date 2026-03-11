import { GoogleCalendarWidget } from "./GoogleCalendarWidget";

const widgetDefinition = {
    name: "GoogleCalendarWidget",
    displayName: "GoogleCalendarWidget",
    component: GoogleCalendarWidget,
    canHaveChildren: false,
    workspace: "GoogleCalendar-workspace",
    package: "Google Calendar",
    author: "Dash Team",
    icon: "calendar-days",
    description:
        "View today's agenda, upcoming meetings, and create events via Google Calendar MCP.",
    type: "widget",
    events: [],
    eventHandlers: [],
    providers: [
        { type: "google-calendar", providerClass: "mcp", required: true },
    ],
    styles: {
        backgroundColor: "bg-blue-900",
        borderColor: "border-blue-700",
    },
    notifications: [
        {
            key: "upcomingEvent",
            displayName: "Upcoming Event",
            description: "An event is starting soon",
            defaultEnabled: true,
        },
        {
            key: "eventChanged",
            displayName: "Event Changed",
            description: "A calendar event was modified or cancelled",
            defaultEnabled: false,
        },
    ],
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Calendar",
            displayName: "Title",
            required: false,
        },
        defaultView: {
            type: "select",
            defaultValue: "today",
            displayName: "Default View",
            options: [
                { label: "Today", value: "today" },
                { label: "Week", value: "week" },
            ],
            required: false,
        },
    },
};
export default widgetDefinition;
