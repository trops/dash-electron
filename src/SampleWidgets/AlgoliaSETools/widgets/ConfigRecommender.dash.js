import { ConfigRecommender } from "./ConfigRecommender";

const widgetDefinition = {
    packageName: "algolia-se-tools",
    scope: "trops",
    id: "trops.algolia-se-tools.ConfigRecommender",
    name: "ConfigRecommender",
    displayName: "Config Recommender",
    description:
        "Analyzes index settings and record structure to generate specific, actionable configuration recommendations with exact values to set.",
    component: ConfigRecommender,
    canHaveChildren: false,
    workspace: "algolia-se-tools-workspace",
    package: "Algolia SE Tools",
    author: "Dash Team",
    icon: "lightbulb",
    type: "widget",
    events: [],
    eventHandlers: ["indexSelected"],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
    ],
    styles: {
        backgroundColor: "bg-gray-900",
        borderColor: "border-indigo-600",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Config Recommender",
            displayName: "Title",
            required: false,
        },
        sampleSize: {
            type: "select",
            defaultValue: "100",
            displayName: "Sample Size",
            instructions:
                "Number of records to sample for attribute-aware recommendations",
            options: [
                { label: "50 records", value: "50" },
                { label: "100 records", value: "100" },
                { label: "250 records", value: "250" },
                { label: "500 records", value: "500" },
            ],
        },
    },
};
export default widgetDefinition;
