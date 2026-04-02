import { AlgoliaDistinctWidget } from "./AlgoliaDistinctWidget";

const widgetDefinition = {
    packageName: "algolia",
    scope: "trops",
    id: "trops.algolia.AlgoliaDistinctWidget",
    name: "AlgoliaDistinctWidget",
    displayName: "Algolia Distinct Settings",
    component: AlgoliaDistinctWidget,
    canHaveChildren: false,
    workspace: "algolia",
    package: "Algolia",
    author: "Dash Team",
    icon: "layer-group",
    description:
        "Configure de-duplication — group results by attribute to avoid showing duplicates.",
    type: "widget",
    events: [],
    eventHandlers: ["indexSelected"],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
    ],
    styles: {
        backgroundColor: "bg-zinc-800",
        borderColor: "border-zinc-600",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Distinct Settings",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
