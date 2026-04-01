import { AlgoliaRankingFormulaWidget } from "./AlgoliaRankingFormulaWidget";

const widgetDefinition = {
    packageName: "algolia",
    scope: "trops",
    id: "trops.algolia.AlgoliaRankingFormulaWidget",
    name: "AlgoliaRankingFormulaWidget",
    displayName: "Algolia Ranking Formula",
    component: AlgoliaRankingFormulaWidget,
    canHaveChildren: false,
    workspace: "algolia",
    package: "Algolia",
    author: "Dash Team",
    icon: "ranking-star",
    description:
        "Configure the ranking formula — drag-to-reorder the 8 ranking criteria that determine result order.",
    type: "widget",
    events: [],
    eventHandlers: ["indexSelected"],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
        { type: "algolia", providerClass: "api", required: true },
    ],
    styles: {
        backgroundColor: "bg-emerald-900",
        borderColor: "border-emerald-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Ranking Formula",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
