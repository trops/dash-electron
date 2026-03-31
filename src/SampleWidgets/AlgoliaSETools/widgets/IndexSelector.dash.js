import { IndexSelector } from "./IndexSelector";

const widgetDefinition = {
    packageName: "algolia-se-tools",
    scope: "trops",
    id: "trops.algolia-se-tools.IndexSelector",
    name: "IndexSelector",
    displayName: "Index Selector",
    description:
        "Compact index picker that broadcasts an indexSelected event. Other widgets can listen for this event to sync their active index without loading indices independently.",
    component: IndexSelector,
    canHaveChildren: false,
    workspace: "algolia-se-tools-workspace",
    package: "Algolia SE Tools",
    author: "Dash Team",
    icon: "database",
    type: "widget",
    events: ["indexSelected"],
    eventHandlers: [],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
        { type: "algolia", providerClass: "api", required: true },
    ],
    styles: {
        backgroundColor: "bg-gray-900",
        borderColor: "border-indigo-600",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Index Selector",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
