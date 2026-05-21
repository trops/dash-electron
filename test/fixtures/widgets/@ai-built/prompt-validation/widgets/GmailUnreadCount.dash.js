import GmailUnreadCount from "./GmailUnreadCount";

export default {
    component: GmailUnreadCount,
    canHaveChildren: false,
    workspace: "ai-built",
    type: "widget",
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Unread Emails",
            displayName: "Title",
            instructions: "The label shown above the count.",
            required: true,
        },
        query: {
            type: "text",
            defaultValue: "is:unread",
            displayName: "Gmail search query",
            instructions:
                'Gmail search syntax. Default "is:unread" counts unread mail across all folders. Examples: "is:unread label:INBOX", "is:unread from:boss@example.com".',
            required: true,
        },
    },
    providers: [{ type: "gmail", providerClass: "mcp", required: true }],
};
