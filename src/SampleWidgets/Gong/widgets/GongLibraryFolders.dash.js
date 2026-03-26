import { GongLibraryFolders } from "./GongLibraryFolders";

const widgetDefinition = {
    packageName: "gong",
    scope: "trops",
    id: "trops.gong.GongLibraryFolders",
    name: "GongLibraryFolders",
    displayName: "Gong Library",
    component: GongLibraryFolders,
    canHaveChildren: false,
    workspace: "Gong-workspace",
    package: "Gong",
    author: "Dash Team",
    icon: "folder-open",
    description:
        "Browse Gong call library folders. Click a call to publish callSelected.",
    type: "widget",
    events: ["callSelected"],
    eventHandlers: [],
    providers: [{ type: "gong", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-emerald-900",
        borderColor: "border-emerald-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Call Library",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
