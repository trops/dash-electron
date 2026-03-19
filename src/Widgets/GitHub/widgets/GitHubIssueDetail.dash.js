import { GitHubIssueDetail } from "./GitHubIssueDetail";

const widgetDefinition = {
    name: "GitHubIssueDetail",
    displayName: "GitHub Issue Detail",
    component: GitHubIssueDetail,
    canHaveChildren: false,
    workspace: "GitHub-workspace",
    package: "GitHub",
    author: "Dash Team",
    icon: "github",
    description:
        "Display full details of a GitHub issue. Listens for issueSelected events.",
    type: "widget",
    events: [],
    eventHandlers: ["issueSelected"],
    providers: [{ type: "github", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-gray-800",
        borderColor: "border-gray-600",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Issue Detail",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
