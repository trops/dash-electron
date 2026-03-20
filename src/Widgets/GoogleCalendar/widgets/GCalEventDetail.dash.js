import { GCalEventDetail } from "./GCalEventDetail";

const widgetDefinition = {
    packageName: "google-calendar",
    scope: "trops",
    id: "trops.google-calendar.GCalEventDetail",
    name: "GCalEventDetail",
    displayName: "GCalEventDetail",
    component: GCalEventDetail,
    canHaveChildren: false,
    workspace: "GoogleCalendar-workspace",
    package: "Google Calendar",
    author: "Dash Team",
    icon: "calendar-days",
    description:
        "Display full details for a selected Google Calendar event. Listens for eventSelected events.",
    type: "widget",
    events: [],
    eventHandlers: ["eventSelected"],
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
            defaultValue: "Event Details",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
