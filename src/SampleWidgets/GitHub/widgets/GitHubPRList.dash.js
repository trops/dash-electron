import { GitHubPRList } from "./GitHubPRList";

const widgetDefinition = {
    packageName: "git-hub",
    scope: "trops",
    id: "trops.git-hub.GitHubPRList",
    name: "GitHubPRList",
    displayName: "GitHub PR List",
    component: GitHubPRList,
    canHaveChildren: false,
    workspace: "GitHub-workspace",
    package: "GitHub",
    author: "Dash Team",
    icon: "github",
    description:
        "List pull requests for a repository. Listens for repoSelected, publishes prSelected.",
    type: "widget",
    events: ["prSelected"],
    eventHandlers: ["repoSelected"],
    providers: [{ type: "github", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-gray-800",
        borderColor: "border-gray-600",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "GitHub PRs",
            displayName: "Title",
            instructions:
                "Header shown above the PR list. Defaults to 'GitHub PRs'.",
            required: false,
        },
        repo: {
            type: "text",
            defaultValue: "",
            displayName: "Repository",
            instructions:
                "Full repo name (owner/repo, e.g. 'trops/dash-electron') for standalone use. Leave blank to wait for a repoSelected event from a paired widget (e.g. GitHubRepoList). The runtime pick wins until the config is changed again.",
            required: false,
        },
        stateFilter: {
            type: "select",
            defaultValue: "open",
            displayName: "State filter",
            instructions:
                "Which PRs to show. 'open' is most common for a status dashboard; 'all' shows merged + closed too.",
            options: [
                { value: "open", displayName: "Open only" },
                { value: "closed", displayName: "Closed only" },
                { value: "all", displayName: "All states" },
            ],
            required: false,
        },
    },
};
export default widgetDefinition;
