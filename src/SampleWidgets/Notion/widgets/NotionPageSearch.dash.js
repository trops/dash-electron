import { NotionPageSearch } from "./NotionPageSearch";

const widgetDefinition = {
    packageName: "notion",
    scope: "trops",
    id: "trops.notion.NotionPageSearch",
    name: "NotionPageSearch",
    displayName: "Notion Page Search",
    component: NotionPageSearch,
    canHaveChildren: false,
    workspace: "Notion-workspace",
    package: "Notion",
    author: "Dash Team",
    icon: "magnifying-glass",
    description:
        "Debounced search across Notion pages and databases. Publishes pageSelected on row click so paired widgets (page viewer, content renderer) can react.",
    type: "widget",
    events: ["pageSelected"],
    eventHandlers: [],
    providers: [{ type: "notion", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-purple-900",
        borderColor: "border-purple-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Notion Search",
            displayName: "Title",
            instructions:
                "Header shown above the search input. Defaults to 'Notion Search'.",
            required: false,
        },
        initialQuery: {
            type: "text",
            defaultValue: "",
            displayName: "Initial query",
            instructions:
                "Optional starting query — handy when the widget is meant to surface a specific corpus (e.g. 'meeting notes'). Leave blank for an empty input on mount.",
            required: false,
        },
        debounceMs: {
            type: "number",
            defaultValue: 400,
            displayName: "Debounce (ms)",
            instructions:
                "How long to wait after the last keystroke before firing a search. 400ms is responsive without spamming the Notion API. Set 0 to search on every keystroke (not recommended). Pressing Enter always bypasses the debounce.",
            required: false,
        },
    },
};
export default widgetDefinition;
