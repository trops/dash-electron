import { AlgoliaStats } from "./AlgoliaStats";
import { algoliaProvider } from "./algoliaProviderConfig";

const widgetDefinition = {
    packageName: "algolia-search",
    scope: "trops",
    id: "trops.algolia-search.AlgoliaStats",
    name: "AlgoliaStats",
    displayName: "Algolia Stats",
    component: AlgoliaStats,
    canHaveChildren: false,
    workspace: "algolia-search-workspace",
    package: "Algolia Search",
    author: "Dash Team",
    icon: "chart-bar",
    description:
        "Displays search result count and query time. Minimal inline widget.",
    type: "widget",
    events: [],
    eventHandlers: ["onQueryChanged"],
    providers: [algoliaProvider],
    styles: {
        backgroundColor: "bg-blue-800",
        borderColor: "border-blue-600",
    },
    userConfig: {},
};
export default widgetDefinition;
