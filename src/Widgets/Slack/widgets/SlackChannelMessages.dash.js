import { SlackChannelMessages } from "./SlackChannelMessages";

const widgetDefinition = {
    packageName: "slack",
    scope: "trops",
    id: "trops.slack.SlackChannelMessages",
    name: "SlackChannelMessages",
    displayName: "Slack Channel Messages",
    component: SlackChannelMessages,
    canHaveChildren: false,
    workspace: "Slack-workspace",
    package: "Slack",
    author: "Dash Team",
    icon: "slack",
    description:
        "Displays message history for a Slack channel. Auto-refreshes on channel selection.",
    type: "widget",
    events: ["messageSelected"],
    eventHandlers: ["channelSelected"],
    providers: [{ type: "slack", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-purple-900",
        borderColor: "border-purple-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Channel Messages",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
