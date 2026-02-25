import { SampleGitHubWidget } from "./SampleGitHubWidget";

const widgetDefinition = {
    name: "SampleGitHubWidget",
    displayName: "SampleGitHubWidget",
    component: SampleGitHubWidget,
    canHaveChildren: false,
    workspace: "DashSamples-workspace",
    package: "Dash Samples",
    author: "Dash Team",
    icon: "github",
    description:
        "Demonstrates GitHub MCP provider — search repos, list issues.",
    type: "widget",
    events: [],
    eventHandlers: [],
    providers: [{ type: "github", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-gray-800",
        borderColor: "border-gray-600",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Sample GitHub",
            displayName: "Title",
            required: false,
        },
        defaultRepo: {
            type: "text",
            defaultValue: "",
            displayName: "Default Repository",
            instructions: "owner/repo format (e.g., facebook/react)",
            required: false,
        },
    },
};
export default widgetDefinition;
