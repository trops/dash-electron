import { AlgoliaAnalyticsWidget } from "./AlgoliaAnalyticsWidget";

const widgetDefinition = {
    packageName: "algolia",
    scope: "trops",
    id: "trops.algolia.AlgoliaAnalyticsWidget",
    name: "AlgoliaAnalyticsWidget",
    displayName: "Algolia Analytics",
    component: AlgoliaAnalyticsWidget,
    canHaveChildren: false,
    workspace: "algolia",
    package: "Algolia",
    author: "Dash Team",
    icon: "chart-bar",
    description:
        "Search analytics and monitoring — top searches, no-results, click positions, geographic distribution.",
    type: "widget",
    events: ["algolia-index-selected"],
    eventHandlers: [],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
        { type: "algolia", providerClass: "api", required: true },
    ],
    styles: {
        backgroundColor: "bg-indigo-900",
        borderColor: "border-indigo-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Algolia Analytics",
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
        defaultDays: {
            type: "number",
            defaultValue: 7,
            displayName: "Default Lookback (days)",
            instructions: "Default number of days to look back for analytics",
            required: false,
        },
    },
};
export default widgetDefinition;
