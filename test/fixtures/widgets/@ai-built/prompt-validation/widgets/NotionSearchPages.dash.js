// File: widgets/NotionSearchPages.dash.js
import NotionSearchPages from "./NotionSearchPages";

export default {
    component: NotionSearchPages,
    canHaveChildren: false,
    workspace: "ai-built",
    type: "widget",
    displayName: "Notion: Search Pages",
    description:
        "Search your Notion workspace by page title and pick a result to broadcast.",
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Search Notion Pages",
            displayName: "Title",
            instructions: "Heading shown at the top of the widget.",
            required: false,
        },
        initialQuery: {
            type: "text",
            defaultValue: "",
            displayName: "Initial query",
            instructions:
                "Optional starting search query (e.g. a project name). Leave blank to start empty.",
            required: false,
        },
        pageSize: {
            type: "number",
            defaultValue: 20,
            displayName: "Max results",
            instructions:
                "How many pages to fetch per search (1–100). Notion caps the page_size at 100.",
            required: false,
        },
    },
    providers: [{ type: "notion", providerClass: "mcp", required: true }],
    events: ["pageSelected"],
};
