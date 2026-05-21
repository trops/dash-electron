// File: widgets/AlgoliaRulesList.dash.js
import AlgoliaRulesList from "./AlgoliaRulesList";

export default {
    component: AlgoliaRulesList,
    canHaveChildren: false,
    workspace: "ai-built",
    type: "widget",
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Algolia Rules",
            displayName: "Title",
            instructions: "Header shown at the top of the widget.",
            required: false,
        },
        indexName: {
            type: "text",
            defaultValue: "",
            displayName: "Algolia Index Name",
            instructions:
                "The Algolia index whose query rules will be listed (e.g., 'products').",
            required: true,
        },
    },
    providers: [
        {
            type: "algolia",
            providerClass: "credential",
            required: true,
        },
    ],
    events: ["ruleSelected"],
};
