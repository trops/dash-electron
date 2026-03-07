import { FilesystemWidget } from "./FilesystemWidget";

const widgetDefinition = {
    name: "FilesystemWidget",
    displayName: "FilesystemWidget",
    component: FilesystemWidget,
    canHaveChildren: false,
    workspace: "Filesystem-workspace",
    package: "Filesystem",
    author: "Dash Team",
    icon: "folder",
    description:
        "Browse and search files on the local filesystem via the Filesystem MCP provider.",
    type: "widget",
    events: [],
    eventHandlers: [],
    providers: [{ type: "filesystem", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-emerald-900",
        borderColor: "border-emerald-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Filesystem",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
