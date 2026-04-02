import { IndexComparator } from "./IndexComparator";

const widgetDefinition = {
    packageName: "algolia-se-tools",
    scope: "trops",
    id: "trops.algolia-se-tools.IndexComparator",
    name: "IndexComparator",
    displayName: "Index Comparator",
    description:
        "Side-by-side comparison of two Algolia indices' settings. Highlights differences for prod vs staging, before vs after audits.",
    component: IndexComparator,
    canHaveChildren: false,
    workspace: "algolia-se-tools-workspace",
    package: "Algolia SE Tools",
    author: "Dash Team",
    icon: "code-compare",
    type: "widget",
    events: [],
    eventHandlers: ["indexSelected"],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
    ],
    styles: {
        backgroundColor: "bg-gray-900",
        borderColor: "border-indigo-600",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Index Comparator",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
