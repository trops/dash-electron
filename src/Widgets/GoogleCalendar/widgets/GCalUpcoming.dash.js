import { GCalUpcoming } from "./GCalUpcoming";

const widgetDefinition = {
    name: "GCalUpcoming",
    displayName: "GCalUpcoming",
    component: GCalUpcoming,
    canHaveChildren: false,
    workspace: "GoogleCalendar-workspace",
    package: "Google Calendar",
    author: "Dash Team",
    icon: "calendar-days",
    description:
        "Chronological list of upcoming Google Calendar events. Click an event to publish an eventSelected event.",
    type: "widget",
    events: ["eventSelected"],
    eventHandlers: [],
    providers: [
        { type: "google-calendar", providerClass: "mcp", required: true },
    ],
    styles: {
        backgroundColor: "bg-blue-900",
        borderColor: "border-blue-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Upcoming Events",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
