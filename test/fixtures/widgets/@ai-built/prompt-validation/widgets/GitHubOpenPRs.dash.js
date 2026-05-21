import GitHubOpenPRs from "./GitHubOpenPRs";

export default {
    component: GitHubOpenPRs,
    canHaveChildren: false,
    workspace: "ai-built",
    type: "widget",
    userConfig: {
        owner: {
            type: "text",
            defaultValue: "trops",
            displayName: "Owner",
            instructions:
                "GitHub organization or user that owns the repository.",
            required: true,
        },
        repo: {
            type: "text",
            defaultValue: "dash-electron",
            displayName: "Repository",
            instructions: "Repository name (without the owner prefix).",
            required: true,
        },
        maxResults: {
            type: "number",
            defaultValue: 25,
            displayName: "Max results",
            instructions:
                "Maximum number of pull requests to fetch (1-100). GitHub's API caps this at 100 per page.",
            required: false,
        },
    },
    providers: [{ type: "github", providerClass: "mcp", required: true }],
    events: ["pullRequestSelected"],
    scheduledTasks: [
        {
            key: "refreshPullRequests",
            handler: "refreshPullRequests",
            displayName: "Refresh pull requests",
            description: "Re-fetch the open pull request list from GitHub.",
        },
    ],
};
