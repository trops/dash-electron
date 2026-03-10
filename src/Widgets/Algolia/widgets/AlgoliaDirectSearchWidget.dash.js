import { AlgoliaDirectSearchWidget } from "./AlgoliaDirectSearchWidget";

const widgetDefinition = {
    name: "AlgoliaDirectSearchWidget",
    displayName: "Algolia Direct Search",
    component: AlgoliaDirectSearchWidget,
    canHaveChildren: false,
    workspace: "algolia",
    package: "Algolia",
    author: "Dash Team",
    icon: "magnifying-glass",
    description:
        "Search Algolia indices directly via IPC with paginated results and expandable records.",
    type: "widget",
    events: [],
    eventHandlers: [],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
        { type: "algolia", providerClass: "api", required: true },
    ],
    styles: {
        backgroundColor: "bg-teal-900",
        borderColor: "border-teal-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Algolia Direct Search",
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
