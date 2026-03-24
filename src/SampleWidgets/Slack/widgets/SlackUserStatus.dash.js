import { SlackUserStatus } from "./SlackUserStatus";

const widgetDefinition = {
    packageName: "slack",
    scope: "trops",
    id: "trops.slack.SlackUserStatus",
    name: "SlackUserStatus",
    displayName: "Slack User Status",
    component: SlackUserStatus,
    canHaveChildren: false,
    workspace: "Slack-workspace",
    package: "Slack",
    author: "Dash Team",
    icon: "slack",
    description: "View and update your Slack user status with emoji and text.",
    type: "widget",
    events: [],
    eventHandlers: [],
    providers: [{ type: "slack", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-purple-900",
        borderColor: "border-purple-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "User Status",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
