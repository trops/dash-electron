import { GCalQuickCreate } from "./GCalQuickCreate";

const widgetDefinition = {
    name: "GCalQuickCreate",
    displayName: "GCalQuickCreate",
    component: GCalQuickCreate,
    canHaveChildren: false,
    workspace: "GoogleCalendar-workspace",
    package: "Google Calendar",
    author: "Dash Team",
    icon: "calendar-days",
    description:
        "Quick-create form for Google Calendar events with title, date, time, and optional location.",
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
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Quick Create",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
