import { AlgoliaCustomRankingWidget } from "./AlgoliaCustomRankingWidget";

const widgetDefinition = {
    packageName: "algolia",
    scope: "trops",
    id: "trops.algolia.AlgoliaCustomRankingWidget",
    name: "AlgoliaCustomRankingWidget",
    displayName: "Algolia Custom Ranking",
    component: AlgoliaCustomRankingWidget,
    canHaveChildren: false,
    workspace: "algolia",
    package: "Algolia",
    author: "Dash Team",
    icon: "sort",
    description:
        "Configure custom ranking — drag-to-reorder business metrics with asc/desc modifiers.",
    type: "widget",
    events: [],
    eventHandlers: [],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
        { type: "algolia", providerClass: "api", required: true },
    ],
    styles: {
        backgroundColor: "bg-violet-900",
        borderColor: "border-violet-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Custom Ranking",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
