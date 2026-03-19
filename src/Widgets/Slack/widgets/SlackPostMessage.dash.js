import { SlackPostMessage } from "./SlackPostMessage";

const widgetDefinition = {
    name: "SlackPostMessage",
    displayName: "Slack Post Message",
    component: SlackPostMessage,
    canHaveChildren: false,
    workspace: "Slack-workspace",
    package: "Slack",
    author: "Dash Team",
    icon: "slack",
    description:
        "Compose and send messages to a Slack channel. Auto-fills channel from selection.",
    type: "widget",
    events: [],
    eventHandlers: ["channelSelected"],
    providers: [{ type: "slack", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-purple-900",
        borderColor: "border-purple-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Post Message",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
