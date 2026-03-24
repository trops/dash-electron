import { GDriveFileList } from "./GDriveFileList";

const widgetDefinition = {
    packageName: "google-drive",
    scope: "trops",
    id: "trops.google-drive.GDriveFileList",
    name: "GDriveFileList",
    displayName: "GDriveFileList",
    component: GDriveFileList,
    canHaveChildren: false,
    workspace: "GoogleDrive-workspace",
    package: "Google Drive",
    author: "Dash Team",
    icon: "hard-drive",
    description:
        "Sortable file and folder list from Google Drive. Click a file to publish a fileSelected event.",
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
            defaultValue: "Drive Files",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
