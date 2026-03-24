import { GmailMessageView } from "./GmailMessageView";

const widgetDefinition = {
    packageName: "gmail",
    scope: "trops",
    id: "trops.gmail.GmailMessageView",
    name: "GmailMessageView",
    displayName: "GmailMessageView",
    component: GmailMessageView,
    canHaveChildren: false,
    workspace: "Gmail-workspace",
    package: "Gmail",
    author: "Dash Team",
    icon: "envelope",
    description:
        "Displays full email content. Listens for emailSelected events to load the selected email.",
    type: "widget",
    events: [],
    eventHandlers: ["emailSelected"],
    providers: [{ type: "gmail", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-red-900",
        borderColor: "border-red-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Email Viewer",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
