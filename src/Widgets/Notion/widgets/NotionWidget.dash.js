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
    notifications: [
        {
            key: "pageUpdated",
            displayName: "Page Updated",
            description: "A Notion page you follow was updated",
            defaultEnabled: false,
        },
        {
            key: "mentioned",
            displayName: "Mentioned",
            description: "You were mentioned in a Notion page",
            defaultEnabled: true,
        },
    ],
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
