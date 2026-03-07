import { AlgoliaRefinementList } from "./AlgoliaRefinementList";
import { algoliaProvider } from "./algoliaProviderConfig";

const widgetDefinition = {
    name: "AlgoliaRefinementList",
    displayName: "Algolia Refinement List",
    component: AlgoliaRefinementList,
    canHaveChildren: false,
    workspace: "algolia-search-workspace",
    package: "Algolia Search",
    author: "Dash Team",
    icon: "filter",
    description:
        "Facet filter widget that displays refinement options with checkbox selection and hit counts.",
    type: "widget",
    events: [],
    eventHandlers: ["onQueryChanged"],
    providers: [algoliaProvider],
    styles: {
        backgroundColor: "bg-blue-800",
        borderColor: "border-blue-600",
    },
    userConfig: {
        attribute: {
            type: "text",
            defaultValue: "",
            displayName: "Attribute",
            instructions:
                'The facet attribute to refine on (e.g. "brand", "category"). Must be configured as a facet in your Algolia index.',
            required: true,
        },
        limit: {
            type: "number",
            defaultValue: 10,
            displayName: "Limit",
            instructions: "Maximum number of facet values to display",
            required: false,
        },
        title: {
            type: "text",
            defaultValue: "",
            displayName: "Title",
            instructions:
                "Optional heading displayed above the refinement list",
            required: false,
        },
    },
};
export default widgetDefinition;
