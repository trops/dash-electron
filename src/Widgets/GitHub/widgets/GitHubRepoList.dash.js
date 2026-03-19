import { GitHubRepoList } from "./GitHubRepoList";

const widgetDefinition = {
    name: "GitHubRepoList",
    displayName: "GitHub Repo List",
    component: GitHubRepoList,
    canHaveChildren: false,
    workspace: "GitHub-workspace",
    package: "GitHub",
    author: "Dash Team",
    icon: "github",
    description:
        "Search and browse GitHub repositories. Publishes repoSelected events.",
    type: "widget",
    events: ["repoSelected"],
    eventHandlers: [],
    providers: [{ type: "github", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-gray-800",
        borderColor: "border-gray-600",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "GitHub Repos",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
