import { AlgoliaFacetingWidget } from "./AlgoliaFacetingWidget";

const widgetDefinition = {
    name: "AlgoliaFacetingWidget",
    displayName: "Algolia Faceting",
    component: AlgoliaFacetingWidget,
    canHaveChildren: false,
    workspace: "algolia",
    package: "Algolia",
    author: "Dash Team",
    icon: "filter",
    description:
        "Configure faceting attributes — plain, filterOnly(), or searchable() modifiers for each attribute.",
    type: "widget",
    events: [],
    eventHandlers: [],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
        { type: "algolia", providerClass: "api", required: true },
    ],
    styles: {
        backgroundColor: "bg-cyan-900",
        borderColor: "border-cyan-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Faceting Attributes",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
