import { IndexComparator } from "./IndexComparator";

export default {
    name: "IndexComparator",
    displayName: "Index Comparator",
    description:
        "Side-by-side comparison of two Algolia indices' settings. Highlights differences for prod vs staging, before vs after audits.",
    component: IndexComparator,
    canHaveChildren: false,
    workspace: "algolia-se-tools-workspace",
    author: "Dash Team",
    icon: "code-compare",
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
            defaultValue: "Index Comparator",
            displayName: "Title",
            required: false,
        },
    },
};
