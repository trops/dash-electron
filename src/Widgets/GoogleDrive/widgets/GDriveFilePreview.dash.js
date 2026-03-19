import { GDriveFilePreview } from "./GDriveFilePreview";

const widgetDefinition = {
    name: "GDriveFilePreview",
    displayName: "GDriveFilePreview",
    component: GDriveFilePreview,
    canHaveChildren: false,
    workspace: "GoogleDrive-workspace",
    package: "Google Drive",
    author: "Dash Team",
    icon: "hard-drive",
    description:
        "Display file metadata for a selected Google Drive file. Listens for fileSelected events.",
    type: "widget",
    events: [],
    eventHandlers: ["fileSelected"],
    providers: [{ type: "google-drive", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-yellow-900",
        borderColor: "border-yellow-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "File Preview",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
