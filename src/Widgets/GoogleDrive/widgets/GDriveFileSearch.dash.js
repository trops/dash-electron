import { GDriveFileSearch } from "./GDriveFileSearch";

const widgetDefinition = {
    name: "GDriveFileSearch",
    displayName: "GDriveFileSearch",
    component: GDriveFileSearch,
    canHaveChildren: false,
    workspace: "GoogleDrive-workspace",
    package: "Google Drive",
    author: "Dash Team",
    icon: "hard-drive",
    description:
        "Search Google Drive files by query. Shows file name, type, and modified date. Click a result to publish a fileSelected event.",
    type: "widget",
    events: ["fileSelected"],
    eventHandlers: [],
    providers: [{ type: "google-drive", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-yellow-900",
        borderColor: "border-yellow-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Drive Search",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
