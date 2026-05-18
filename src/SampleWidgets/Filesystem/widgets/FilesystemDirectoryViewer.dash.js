import { FilesystemDirectoryViewer } from "./FilesystemDirectoryViewer";

const widgetDefinition = {
    packageName: "filesystem",
    scope: "trops",
    id: "trops.filesystem.FilesystemDirectoryViewer",
    name: "FilesystemDirectoryViewer",
    displayName: "Filesystem Directory Viewer",
    component: FilesystemDirectoryViewer,
    canHaveChildren: false,
    workspace: "Filesystem-workspace",
    package: "Filesystem",
    author: "Dash Team",
    icon: "folder-tree",
    description:
        "Tree-style directory browser for the Filesystem MCP provider. Folders lazy-expand on click; clicking a file publishes fileSelected with its absolute path so paired viewer widgets can read it.",
    type: "widget",
    events: ["fileSelected"],
    eventHandlers: [],
    providers: [{ type: "filesystem", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-emerald-900",
        borderColor: "border-emerald-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Files",
            displayName: "Title",
            instructions: "Header shown above the tree. Defaults to 'Files'.",
            required: false,
        },
        rootPath: {
            type: "text",
            defaultValue: "",
            displayName: "Root path",
            instructions:
                "Absolute path to use as the tree's root (e.g. '/Users/me/projects' on macOS, 'C:\\\\Users\\\\me\\\\projects' on Windows). Must be inside one of the Filesystem provider's allowed directories — otherwise list_directory will reject the request.",
            required: false,
        },
        maxDepth: {
            type: "number",
            defaultValue: 3,
            displayName: "Max depth",
            instructions:
                "How many nested levels the user can open without an extra hint. Folders past this depth still expand (one at a time) but show a 'depth limit' warning to discourage runaway tree fetches. 3 is a sensible default for most project trees.",
            required: false,
        },
    },
};
export default widgetDefinition;
