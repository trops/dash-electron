import { AlgoliaDisplayAttributesWidget } from "./AlgoliaDisplayAttributesWidget";

const widgetDefinition = {
    packageName: "algolia",
    scope: "trops",
    id: "trops.algolia.AlgoliaDisplayAttributesWidget",
    name: "AlgoliaDisplayAttributesWidget",
    displayName: "Algolia Display Attributes",
    component: AlgoliaDisplayAttributesWidget,
    canHaveChildren: false,
    workspace: "algolia",
    package: "Algolia",
    author: "Dash Team",
    icon: "eye",
    description:
        "Configure which attributes are returned in results and which are hidden from the API.",
    type: "widget",
    events: [],
    eventHandlers: ["indexSelected"],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
    ],
    styles: {
        backgroundColor: "bg-orange-900",
        borderColor: "border-orange-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Display Attributes",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
