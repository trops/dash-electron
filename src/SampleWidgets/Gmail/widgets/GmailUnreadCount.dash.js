import { GmailUnreadCount } from "./GmailUnreadCount";

const widgetDefinition = {
    packageName: "gmail",
    scope: "trops",
    id: "trops.gmail.GmailUnreadCount",
    name: "GmailUnreadCount",
    displayName: "Gmail Unread Count",
    component: GmailUnreadCount,
    canHaveChildren: false,
    workspace: "Gmail-workspace",
    package: "Gmail",
    author: "Dash Team",
    icon: "envelope",
    description:
        "Stat widget — count of unread email matching a Gmail search query, with refresh + optional auto-refresh. Publishes unreadCountUpdated on every successful fetch.",
    type: "widget",
    events: ["unreadCountUpdated"],
    eventHandlers: [],
    providers: [{ type: "gmail", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-red-900",
        borderColor: "border-red-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Unread Email",
            displayName: "Title",
            instructions:
                "Header shown above the count. Defaults to 'Unread Email'.",
            required: false,
        },
        query: {
            type: "text",
            defaultValue: "is:unread in:inbox",
            displayName: "Search query",
            instructions:
                "Gmail search query whose result count is shown (e.g. 'is:unread in:inbox', 'is:starred is:unread', 'label:work is:unread'). Same syntax as the Gmail search box.",
            required: false,
        },
        autoRefreshSeconds: {
            type: "number",
            defaultValue: 60,
            displayName: "Auto-refresh (seconds)",
            instructions:
                "How often to re-fetch the count. 0 disables auto-refresh (the Refresh button still works). 60s is a sensible default for an unread-email stat — Gmail rate limits are generous but not unlimited.",
            required: false,
        },
        label: {
            type: "text",
            defaultValue: "unread email",
            displayName: "Label",
            instructions:
                "Short label rendered under the number. Defaults to 'unread email'. Customize for non-default queries (e.g. 'starred unread', 'work unread').",
            required: false,
        },
    },
};
export default widgetDefinition;
