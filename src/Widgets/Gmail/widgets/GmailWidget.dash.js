import { GmailWidget } from "./GmailWidget";

const widgetDefinition = {
    name: "GmailWidget",
    displayName: "GmailWidget",
    component: GmailWidget,
    canHaveChildren: false,
    workspace: "Gmail-workspace",
    package: "Gmail",
    author: "Dash Team",
    icon: "envelope",
    description: "Search and read emails via the Gmail MCP provider.",
    type: "widget",
    events: [],
    eventHandlers: [],
    providers: [{ type: "gmail", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-red-900",
        borderColor: "border-red-700",
    },
    notifications: [
        {
            key: "newEmail",
            displayName: "New Email",
            description: "New email received",
            defaultEnabled: true,
        },
        {
            key: "importantEmail",
            displayName: "Important Email",
            description: "Email marked as important",
            defaultEnabled: true,
        },
    ],
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Gmail",
            displayName: "Title",
            required: false,
        },
        defaultQuery: {
            type: "text",
            defaultValue: "is:unread",
            displayName: "Default Search Query",
            required: false,
        },
    },
};
export default widgetDefinition;
