import { SlackWidget } from "./SlackWidget";

const widgetDefinition = {
    name: "SlackWidget",
    displayName: "SlackWidget",
    component: SlackWidget,
    canHaveChildren: false,
    workspace: "Slack-workspace",
    package: "Slack",
    author: "Dash Team",
    icon: "slack",
    description: "List channels and send messages via the Slack MCP provider.",
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
            defaultValue: "Slack",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
