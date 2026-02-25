import { SampleSlackWidget } from "./SampleSlackWidget";

const widgetDefinition = {
    name: "SampleSlackWidget",
    displayName: "SampleSlackWidget",
    component: SampleSlackWidget,
    canHaveChildren: false,
    workspace: "DashSamples-workspace",
    package: "Dash Samples",
    author: "Dash Team",
    icon: "slack",
    description:
        "Demonstrates Slack MCP provider — list channels, send messages.",
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
            defaultValue: "Sample Slack",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
