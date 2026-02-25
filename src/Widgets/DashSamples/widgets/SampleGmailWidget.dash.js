import { SampleGmailWidget } from "./SampleGmailWidget";

const widgetDefinition = {
    name: "SampleGmailWidget",
    displayName: "SampleGmailWidget",
    component: SampleGmailWidget,
    canHaveChildren: false,
    workspace: "DashSamples-workspace",
    package: "Dash Samples",
    author: "Dash Team",
    icon: "envelope",
    description: "Demonstrates Gmail MCP provider — search and read emails.",
    type: "widget",
    events: [],
    eventHandlers: [],
    providers: [{ type: "gmail", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-red-900",
        borderColor: "border-red-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Sample Gmail",
            displayName: "Title",
            required: false,
        },
        defaultQuery: {
            type: "text",
            defaultValue: "is:unread",
            displayName: "Default Search Query",
            required: false,
        },
    },
};
export default widgetDefinition;
