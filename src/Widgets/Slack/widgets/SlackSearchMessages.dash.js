import { SlackSearchMessages } from "./SlackSearchMessages";

const widgetDefinition = {
    name: "SlackSearchMessages",
    displayName: "Slack Search Messages",
    component: SlackSearchMessages,
    canHaveChildren: false,
    workspace: "Slack-workspace",
    package: "Slack",
    author: "Dash Team",
    icon: "slack",
    description: "Search Slack messages across channels with context snippets.",
    type: "widget",
    events: ["messageSelected"],
    eventHandlers: [],
    providers: [{ type: "slack", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-purple-900",
        borderColor: "border-purple-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Search Messages",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
