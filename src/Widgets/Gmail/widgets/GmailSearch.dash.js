import { GmailSearch } from "./GmailSearch";

const widgetDefinition = {
    packageName: "gmail",
    scope: "trops",
    id: "trops.gmail.GmailSearch",
    name: "GmailSearch",
    displayName: "GmailSearch",
    component: GmailSearch,
    canHaveChildren: false,
    workspace: "Gmail-workspace",
    package: "Gmail",
    author: "Dash Team",
    icon: "envelope",
    description:
        "Search emails with custom queries. Click results to publish emailSelected events.",
    type: "widget",
    events: ["emailSelected"],
    eventHandlers: [],
    providers: [{ type: "gmail", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-red-900",
        borderColor: "border-red-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Gmail Search",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
