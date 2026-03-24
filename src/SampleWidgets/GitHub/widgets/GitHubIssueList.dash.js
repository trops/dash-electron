import { GitHubIssueList } from "./GitHubIssueList";

const widgetDefinition = {
    packageName: "git-hub",
    scope: "trops",
    id: "trops.git-hub.GitHubIssueList",
    name: "GitHubIssueList",
    displayName: "GitHub Issue List",
    component: GitHubIssueList,
    canHaveChildren: false,
    workspace: "GitHub-workspace",
    package: "GitHub",
    author: "Dash Team",
    icon: "github",
    description:
        "List GitHub issues for a repository. Listens for repoSelected, publishes issueSelected.",
    type: "widget",
    events: ["issueSelected"],
    eventHandlers: ["repoSelected"],
    providers: [{ type: "github", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-gray-800",
        borderColor: "border-gray-600",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "GitHub Issues",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
