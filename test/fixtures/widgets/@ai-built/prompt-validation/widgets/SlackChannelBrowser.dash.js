import SlackChannelBrowser from "./SlackChannelBrowser";

export default {
    component: SlackChannelBrowser,
    canHaveChildren: false,
    workspace: "ai-built",
    type: "widget",
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Slack Channels",
            displayName: "Title",
            instructions: "The title shown at the top of the widget.",
            required: false,
        },
    },
    providers: [{ type: "slack", providerClass: "mcp", required: true }],
    events: ["channelSelected"],
};
