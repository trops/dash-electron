import { IndexHealthReport } from "./IndexHealthReport";

const widgetDefinition = {
    packageName: "algolia-se-tools",
    scope: "trops",
    id: "trops.algolia-se-tools.IndexHealthReport",
    name: "IndexHealthReport",
    displayName: "Index Health Report",
    description:
        "Analyze an Algolia index's settings against best practices. Generates a scored health report with pass/warn/fail checks for relevance, filtering, UX, performance, and security.",
    component: IndexHealthReport,
    canHaveChildren: false,
    workspace: "algolia-se-tools-workspace",
    package: "Algolia SE Tools",
    author: "Dash Team",
    icon: "clipboard-check",
    type: "widget",
    events: [],
    eventHandlers: [],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
        { type: "algolia", providerClass: "api", required: true },
    ],
    styles: {
        backgroundColor: "bg-gray-900",
        borderColor: "border-indigo-600",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Index Health Report",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
