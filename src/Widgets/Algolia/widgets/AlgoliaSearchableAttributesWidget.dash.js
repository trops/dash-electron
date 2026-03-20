import { AlgoliaSearchableAttributesWidget } from "./AlgoliaSearchableAttributesWidget";

const widgetDefinition = {
    packageName: "algolia",
    scope: "trops",
    id: "trops.algolia.AlgoliaSearchableAttributesWidget",
    name: "AlgoliaSearchableAttributesWidget",
    displayName: "Algolia Searchable Attributes",
    component: AlgoliaSearchableAttributesWidget,
    canHaveChildren: false,
    workspace: "algolia",
    package: "Algolia",
    author: "Dash Team",
    icon: "magnifying-glass-plus",
    description:
        "Configure searchable attributes — drag-to-reorder priority and toggle unordered() modifier.",
    type: "widget",
    events: [],
    eventHandlers: [],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
        { type: "algolia", providerClass: "api", required: true },
    ],
    styles: {
        backgroundColor: "bg-purple-900",
        borderColor: "border-purple-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Searchable Attributes",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
