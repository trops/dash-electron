import { AlgoliaSearchWidget } from "./AlgoliaSearchWidget";

const widgetDefinition = {
    name: "AlgoliaSearchWidget",
    displayName: "Algolia Search",
    component: AlgoliaSearchWidget,
    canHaveChildren: false,
    workspace: "algolia",
    package: "Algolia",
    author: "Dash Team",
    icon: "magnifying-glass",
    description:
        "Browse Algolia indices, search records, and view record details.",
    type: "widget",
    events: ["algolia-record-selected", "algolia-index-selected"],
    eventHandlers: [],
    providers: [{ type: "algolia", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-indigo-900",
        borderColor: "border-indigo-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Algolia Search",
            displayName: "Title",
            required: false,
        },
        defaultIndex: {
            type: "text",
            defaultValue: "",
            displayName: "Default Index",
            instructions: "Pre-selected Algolia index name",
            required: false,
        },
        hitsPerPage: {
            type: "number",
            defaultValue: 10,
            displayName: "Hits Per Page",
            instructions: "Number of results per page (1-100)",
            required: false,
        },
    },
};
export default widgetDefinition;
