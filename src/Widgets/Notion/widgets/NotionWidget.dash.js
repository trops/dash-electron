import { NotionWidget } from "./NotionWidget";

const widgetDefinition = {
    name: "NotionWidget",
    displayName: "NotionWidget",
    component: NotionWidget,
    canHaveChildren: false,
    workspace: "Notion-workspace",
    package: "Notion",
    author: "Dash Team",
    icon: "book",
    description:
        "Search and read Notion pages and databases via the Notion MCP provider.",
    type: "widget",
    events: [],
    eventHandlers: [],
    providers: [{ type: "notion", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-orange-900",
        borderColor: "border-orange-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Notion",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
