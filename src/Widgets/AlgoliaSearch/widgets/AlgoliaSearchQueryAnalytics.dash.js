import { AlgoliaSearchQueryAnalytics } from "./AlgoliaSearchQueryAnalytics";
import { algoliaProvider } from "./algoliaProviderConfig";

const widgetDefinition = {
    name: "AlgoliaSearchQueryAnalytics",
    displayName: "Algolia Query Analytics",
    component: AlgoliaSearchQueryAnalytics,
    canHaveChildren: false,
    workspace: "algolia-search-workspace",
    package: "Algolia Search",
    author: "Dash Team",
    icon: "chart-line",
    description:
        "Displays historical analytics for the active search query. Wire to AlgoliaSearchPage's queryChanged event.",
    type: "widget",
    events: ["searchQuerySelected"],
    eventHandlers: ["onQueryChanged"],
    providers: [algoliaProvider],
    styles: {
        backgroundColor: "bg-indigo-800",
        borderColor: "border-indigo-600",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Query Analytics",
            displayName: "Widget Title",
            instructions: "Title displayed at the top of the widget",
            required: false,
        },
        days: {
            type: "number",
            defaultValue: 7,
            displayName: "Days",
            instructions: "Number of days of analytics history to fetch",
            required: false,
        },
    },
};
export default widgetDefinition;
