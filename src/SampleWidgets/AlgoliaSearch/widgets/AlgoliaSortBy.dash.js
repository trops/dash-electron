import { AlgoliaSortBy } from "./AlgoliaSortBy";
import { algoliaProvider } from "./algoliaProviderConfig";

const widgetDefinition = {
    packageName: "algolia-search",
    scope: "trops",
    id: "trops.algolia-search.AlgoliaSortBy",
    name: "AlgoliaSortBy",
    displayName: "Algolia Sort By",
    component: AlgoliaSortBy,
    canHaveChildren: false,
    workspace: "algolia-search-workspace",
    package: "Algolia Search",
    author: "Dash Team",
    icon: "arrow-down-wide-short",
    description:
        "Dropdown for selecting sort order via Algolia replica indices. Configure sort items as a JSON array.",
    type: "widget",
    events: [],
    eventHandlers: ["onQueryChanged"],
    providers: [algoliaProvider],
    styles: {
        backgroundColor: "bg-blue-800",
        borderColor: "border-blue-600",
    },
    userConfig: {
        items: {
            type: "text",
            defaultValue: "",
            displayName: "Sort Items (JSON)",
            instructions:
                'JSON array of sort options. Example: [{"value":"products","label":"Relevance"},{"value":"products_price_asc","label":"Price (Low to High)"}]',
            required: true,
        },
    },
};
export default widgetDefinition;
