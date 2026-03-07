import { AlgoliaSearchTemplateEditor } from "./AlgoliaSearchTemplateEditor";

const widgetDefinition = {
    name: "AlgoliaSearchTemplateEditor",
    displayName: "Algolia Template Editor",
    component: AlgoliaSearchTemplateEditor,
    canHaveChildren: false,
    workspace: "algolia-search-workspace",
    package: "Algolia Search",
    author: "Dash Team",
    icon: "code",
    description:
        "Monaco-powered Mustache template editor with live attribute sidebar. Wire to AlgoliaSearchPage for real-time template preview.",
    type: "widget",
    events: ["templateChanged"],
    eventHandlers: ["onAttributesAvailable"],
    styles: {
        backgroundColor: "bg-violet-800",
        borderColor: "border-violet-600",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Template Editor",
            displayName: "Title",
            instructions: "Widget panel title",
            required: false,
        },
        defaultTemplate: {
            type: "text",
            defaultValue: "",
            displayName: "Default Template",
            instructions:
                "Initial Mustache template loaded when the widget mounts",
            required: false,
        },
    },
};
export default widgetDefinition;
