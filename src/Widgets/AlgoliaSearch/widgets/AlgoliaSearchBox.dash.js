import { AlgoliaSearchBox } from "./AlgoliaSearchBox";

const widgetDefinition = {
    packageName: "algolia-search",
    scope: "trops",
    id: "trops.algolia-search.AlgoliaSearchBox",
    name: "AlgoliaSearchBox",
    displayName: "Algolia SearchBox",
    component: AlgoliaSearchBox,
    canHaveChildren: false,
    workspace: "algolia-search-workspace",
    package: "Algolia Search",
    author: "Dash Team",
    icon: "keyboard",
    description:
        "Search input connected to Algolia. Type to search your index.",
    type: "widget",
    events: ["queryChanged"],
    eventHandlers: [],
    providers: [],
    styles: {
        backgroundColor: "bg-blue-800",
        borderColor: "border-blue-600",
    },
    userConfig: {
        placeholder: {
            type: "text",
            defaultValue: "Search...",
            displayName: "Placeholder",
            instructions: "Placeholder text shown in the search input",
            required: false,
        },
    },
};
export default widgetDefinition;
