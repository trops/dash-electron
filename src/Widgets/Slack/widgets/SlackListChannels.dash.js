import { SlackListChannels } from "./SlackListChannels";

const widgetDefinition = {
    name: "SlackListChannels",
    displayName: "Slack List Channels",
    component: SlackListChannels,
    canHaveChildren: false,
    workspace: "Slack-workspace",
    package: "Slack",
    author: "Dash Team",
    icon: "slack",
    description:
        "Scrollable list of Slack channels with search filter. Click to select a channel.",
    type: "widget",
    events: ["channelSelected"],
    eventHandlers: [],
    providers: [{ type: "slack", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-purple-900",
        borderColor: "border-purple-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Slack Channels",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
