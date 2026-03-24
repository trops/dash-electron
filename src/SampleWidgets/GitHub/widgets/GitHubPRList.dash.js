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
            required: false,
        },
    },
};
export default widgetDefinition;
