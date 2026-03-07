import { GitHubWidget } from "./GitHubWidget";

const widgetDefinition = {
    name: "GitHubWidget",
    displayName: "GitHubWidget",
    component: GitHubWidget,
    canHaveChildren: false,
    workspace: "GitHub-workspace",
    package: "GitHub",
    author: "Dash Team",
    icon: "github",
    description: "Search repos and list issues via the GitHub MCP provider.",
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
            defaultValue: "GitHub",
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
