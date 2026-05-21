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
