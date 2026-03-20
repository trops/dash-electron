import { AlgoliaPagination } from "./AlgoliaPagination";
import { algoliaProvider } from "./algoliaProviderConfig";

const widgetDefinition = {
    packageName: "algolia-search",
    scope: "trops",
    id: "trops.algolia-search.AlgoliaPagination",
    name: "AlgoliaPagination",
    displayName: "Algolia Pagination",
    component: AlgoliaPagination,
    canHaveChildren: false,
    workspace: "algolia-search-workspace",
    package: "Algolia Search",
    author: "Dash Team",
    icon: "arrow-right-arrow-left",
    description:
        "Page navigation for search results. Displays previous/next buttons and page numbers.",
    type: "widget",
    events: [],
    eventHandlers: ["onQueryChanged"],
    providers: [algoliaProvider],
    styles: {
        backgroundColor: "bg-blue-800",
        borderColor: "border-blue-600",
    },
    userConfig: {
        padding: {
            type: "number",
            defaultValue: 3,
            displayName: "Padding",
            instructions:
                "Number of page buttons shown on each side of the current page",
            required: false,
        },
    },
};
export default widgetDefinition;
