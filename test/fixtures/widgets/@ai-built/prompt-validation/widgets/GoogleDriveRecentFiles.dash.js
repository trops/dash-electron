// File: GoogleDriveRecentFiles.dash.js
import GoogleDriveRecentFiles from "./GoogleDriveRecentFiles";

export default {
    component: GoogleDriveRecentFiles,
    canHaveChildren: false,
    workspace: "ai-built",
    type: "widget",
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Recent Google Drive files",
            displayName: "Title",
            instructions: "Heading shown at the top of the widget.",
            required: false,
        },
        limit: {
            type: "number",
            defaultValue: 10,
            displayName: "Max files",
            instructions: "How many recently modified files to show (1–50).",
            required: false,
        },
    },
    providers: [{ type: "google-drive", providerClass: "mcp", required: true }],
    events: ["fileSelected"],
    scheduledTasks: [
        {
            key: "refreshFiles",
            handler: "refreshFiles",
            displayName: "Refresh files",
            description:
                "Re-fetch the list of recently modified Google Drive files.",
        },
    ],
};
