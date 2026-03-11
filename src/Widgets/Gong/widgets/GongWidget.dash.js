import { GongWidget } from "./GongWidget";

const widgetDefinition = {
    name: "GongWidget",
    displayName: "GongWidget",
    component: GongWidget,
    canHaveChildren: false,
    workspace: "Gong-workspace",
    package: "Gong",
    author: "Dash Team",
    icon: "phone",
    description: "Browse Gong call transcripts and AI-generated summaries.",
    type: "widget",
    events: [],
    eventHandlers: [],
    providers: [{ type: "gong", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-emerald-900",
        borderColor: "border-emerald-700",
    },
    notifications: [
        {
            key: "callCompleted",
            displayName: "Call Completed",
            description: "A Gong call recording is ready",
            defaultEnabled: true,
        },
        {
            key: "actionItemAssigned",
            displayName: "Action Item Assigned",
            description: "An action item was assigned to you",
            defaultEnabled: true,
        },
    ],
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Gong Calls",
            displayName: "Title",
            required: false,
        },
        defaultDaysBack: {
            type: "text",
            defaultValue: "30",
            displayName: "Days Back",
            instructions: "Number of days back to show calls",
            required: false,
        },
    },
};
export default widgetDefinition;
