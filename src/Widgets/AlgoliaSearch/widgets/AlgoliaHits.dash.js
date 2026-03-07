import { AlgoliaHits } from "./AlgoliaHits";
import { algoliaProvider } from "./algoliaProviderConfig";

const widgetDefinition = {
    name: "AlgoliaHits",
    displayName: "Algolia Hits",
    component: AlgoliaHits,
    canHaveChildren: false,
    workspace: "algolia-search-workspace",
    package: "Algolia Search",
    author: "Dash Team",
    icon: "list",
    description:
        "Displays search results from your Algolia index. Supports Mustache templates for custom hit rendering.",
    type: "widget",
    events: [],
    eventHandlers: ["onQueryChanged"],
    providers: [algoliaProvider],
    styles: {
        backgroundColor: "bg-blue-800",
        borderColor: "border-blue-600",
    },
    userConfig: {
        hitTemplate: {
            type: "text",
            defaultValue: "",
            displayName: "Hit Template (Mustache)",
            instructions:
                'Mustache template for rendering each hit. Use {{attributeName}} for hit fields. Example: <div class="font-bold">{{name}}</div><div class="text-sm text-gray-400">{{description}}</div>',
            required: false,
        },
    },
};
export default widgetDefinition;
