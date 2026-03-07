import { GoogleDriveWidget } from "./GoogleDriveWidget";

const widgetDefinition = {
    name: "GoogleDriveWidget",
    displayName: "GoogleDriveWidget",
    component: GoogleDriveWidget,
    canHaveChildren: false,
    workspace: "GoogleDrive-workspace",
    package: "Google Drive",
    author: "Dash Team",
    icon: "hard-drive",
    description:
        "Browse and search files in Google Drive via the Google Drive MCP provider.",
    type: "widget",
    events: [],
    eventHandlers: [],
    providers: [{ type: "google-drive", providerClass: "mcp", required: true }],
    styles: {
        backgroundColor: "bg-yellow-900",
        borderColor: "border-yellow-700",
    },
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Google Drive",
            displayName: "Title",
            required: false,
        },
    },
};
export default widgetDefinition;
