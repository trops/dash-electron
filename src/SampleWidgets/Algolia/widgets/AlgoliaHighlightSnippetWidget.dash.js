import { AlgoliaHighlightSnippetWidget } from "./AlgoliaHighlightSnippetWidget";

const widgetDefinition = {
    packageName: "algolia",
    scope: "trops",
    id: "trops.algolia.AlgoliaHighlightSnippetWidget",
    name: "AlgoliaHighlightSnippetWidget",
    displayName: "Algolia Highlight & Snippet",
    component: AlgoliaHighlightSnippetWidget,
    canHaveChildren: false,
    workspace: "algolia",
    package: "Algolia",
    author: "Dash Team",
    icon: "highlighter",
    description:
        "Configure search highlighting and snippeting — highlight tags, snippet attributes, ellipsis text, and live preview.",
    type: "widget",
    events: [],
    eventHandlers: ["indexSelected"],
    providers: [
        { type: "algolia", providerClass: "credential", required: true },
        { type: "algolia", providerClass: "api", required: true },
    ],
    styles: {
        backgroundColor: "bg-pink-900",
        borderColor: "border-pink-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Highlight & Snippet",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
