import { SearchPlayground } from "./SearchPlayground";

export default {
    name: "SearchPlayground",
    displayName: "Search Playground",
    description:
        "Minimal search UI with toggles for typo tolerance, distinct, filters, and highlighting. Demo the impact of each relevance lever in real-time.",
    component: SearchPlayground,
    canHaveChildren: false,
    workspace: "algolia-se-tools-workspace",
    author: "Dash Team",
    icon: "flask-vial",
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
            defaultValue: "Search Playground",
            displayName: "Title",
            required: false,
        },
    },
};
