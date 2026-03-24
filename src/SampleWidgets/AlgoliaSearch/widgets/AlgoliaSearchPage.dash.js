import { AlgoliaSearchPage } from "./AlgoliaSearchPage";
import { algoliaProvider } from "./algoliaProviderConfig";

const widgetDefinition = {
    packageName: "algolia-search",
    scope: "trops",
    id: "trops.algolia-search.AlgoliaSearchPage",
    name: "AlgoliaSearchPage",
    displayName: "Algolia Search Page",
    component: AlgoliaSearchPage,
    canHaveChildren: false,
    workspace: "algolia-search-workspace",
    package: "Algolia Search",
    author: "Dash Team",
    icon: "magnifying-glass",
    description:
        "Full search experience — search box, filters, results, and pagination in a single widget.",
    type: "widget",
    events: ["queryChanged", "attributesAvailable"],
    eventHandlers: ["onSearchQuerySelected", "onTemplateChanged"],
    providers: [algoliaProvider],
    styles: {
        backgroundColor: "bg-blue-800",
        borderColor: "border-blue-600",
    },
    userConfig: {
        placeholder: {
            type: "text",
            defaultValue: "Search...",
            displayName: "Search Placeholder",
            instructions: "Placeholder text shown in the search input",
            required: false,
        },
        hitsPerPage: {
            type: "number",
            defaultValue: 20,
            displayName: "Hits Per Page",
            instructions: "Number of results to show per page",
            required: false,
        },
        hitTemplate: {
            type: "text",
            defaultValue: "",
            displayName: "Hit Template (Mustache)",
            instructions:
                'Mustache template for rendering each hit. Use {{attributeName}} for hit fields. Example: <div class="font-bold">{{name}}</div><div class="text-sm text-gray-400">{{description}}</div>',
            required: false,
        },
        facetAttributes: {
            type: "text",
            defaultValue: "",
            displayName: "Facet Attributes (JSON)",
            instructions:
                'JSON array of facet configs. Example: [{"attribute":"brand","title":"Brand"},{"attribute":"category","title":"Category"}]',
            required: false,
        },
        sortItems: {
            type: "text",
            defaultValue: "",
            displayName: "Sort Items (JSON)",
            instructions:
                'JSON array of sort options. Example: [{"value":"products","label":"Relevance"},{"value":"products_price_asc","label":"Price ↑"}]',
            required: false,
        },
        paginationPadding: {
            type: "number",
            defaultValue: 3,
            displayName: "Pagination Padding",
            instructions:
                "Number of page buttons to show on each side of the current page",
            required: false,
        },
    },
};
export default widgetDefinition;
