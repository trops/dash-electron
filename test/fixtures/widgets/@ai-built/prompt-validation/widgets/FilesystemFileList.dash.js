import FilesystemFileList from "./FilesystemFileList";

export default {
    component: FilesystemFileList,
    canHaveChildren: false,
    workspace: "ai-built",
    type: "widget",
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Files",
            displayName: "Title",
            instructions: "Title shown at the top of the widget.",
            required: false,
        },
        directoryPath: {
            type: "text",
            defaultValue: "",
            displayName: "Directory path",
            instructions:
                "Absolute path to the directory whose files you want to list. Must be inside one of the filesystem provider's allowed roots.",
            required: true,
        },
    },
    providers: [{ type: "filesystem", providerClass: "mcp", required: true }],
    events: ["fileSelected"],
};
