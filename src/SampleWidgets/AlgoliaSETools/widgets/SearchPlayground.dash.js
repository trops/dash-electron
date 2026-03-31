import { SearchPlayground } from "./SearchPlayground";

const widgetDefinition = {
    packageName: "algolia-se-tools",
    scope: "trops",
    id: "trops.algolia-se-tools.SearchPlayground",
    name: "SearchPlayground",
    displayName: "Search Playground",
    description:
        "Minimal search UI with toggles for typo tolerance, distinct, filters, and highlighting. Demo the impact of each relevance lever in real-time.",
    component: SearchPlayground,
    canHaveChildren: false,
    workspace: "algolia-se-tools-workspace",
    package: "Algolia SE Tools",
    author: "Dash Team",
    icon: "flask-vial",
    type: "widget",
    events: [],
    eventHandlers: ["indexSelected"],
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
            defaultValue: "Search Playground",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
