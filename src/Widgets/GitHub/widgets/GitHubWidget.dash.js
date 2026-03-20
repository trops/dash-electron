import { GitHubWidget } from "./GitHubWidget";

const widgetDefinition = {
    packageName: "git-hub",
    scope: "trops",
    id: "trops.git-hub.GitHubWidget",
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
    notifications: [
        {
            key: "prReviewRequested",
            displayName: "PR Review Requested",
            description: "A pull request review was requested from you",
            defaultEnabled: true,
        },
        {
            key: "issueAssigned",
            displayName: "Issue Assigned",
            description: "An issue was assigned to you",
            defaultEnabled: true,
        },
        {
            key: "ciStatus",
            displayName: "CI Status",
            description: "CI pipeline completed or failed",
            defaultEnabled: false,
        },
    ],
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
