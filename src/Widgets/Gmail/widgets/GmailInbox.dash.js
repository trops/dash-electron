import { GmailInbox } from "./GmailInbox";

const widgetDefinition = {
    name: "GmailInbox",
    displayName: "GmailInbox",
    component: GmailInbox,
    canHaveChildren: false,
    workspace: "Gmail-workspace",
    package: "Gmail",
    author: "Dash Team",
    icon: "envelope",
    description:
        "Displays inbox emails with unread indicators. Click to select and publish emailSelected events.",
    type: "widget",
    events: ["emailSelected"],
    eventHandlers: [],
    providers: [{ type: "gmail", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-red-900",
        borderColor: "border-red-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Gmail Inbox",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
