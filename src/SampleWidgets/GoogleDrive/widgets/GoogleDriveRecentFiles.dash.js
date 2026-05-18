import { GoogleDriveRecentFiles } from "./GoogleDriveRecentFiles";

const widgetDefinition = {
    packageName: "google-drive",
    scope: "trops",
    id: "trops.google-drive.GoogleDriveRecentFiles",
    name: "GoogleDriveRecentFiles",
    displayName: "Google Drive Recent Files",
    component: GoogleDriveRecentFiles,
    canHaveChildren: false,
    workspace: "GoogleDrive-workspace",
    package: "GoogleDrive",
    author: "Dash Team",
    icon: "folder-open",
    description:
        "Compact list of the most recently modified Google Drive files with file-type icons. Click opens in browser (when a webViewLink is present) and publishes fileSelected for paired widgets.",
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
            defaultValue: "Recent Drive Files",
            displayName: "Title",
            instructions:
                "Header shown above the file list. Defaults to 'Recent Drive Files'.",
            required: false,
        },
        query: {
            type: "text",
            defaultValue: "*",
            displayName: "Search query",
            instructions:
                "Drive search query (e.g. '*' for everything, 'modifiedTime > \"2024-01-01\"' for a date range, 'mimeType=\"application/pdf\"' for one type). Default '*' returns everything; the widget sorts by modifiedTime locally and shows the top N.",
            required: false,
        },
        limit: {
            type: "number",
            defaultValue: 10,
            displayName: "Number of files",
            instructions:
                "How many of the most-recent files to show. 5–20 is a good range for a tile-sized widget.",
            required: false,
        },
        autoRefreshSeconds: {
            type: "number",
            defaultValue: 300,
            displayName: "Auto-refresh (seconds)",
            instructions:
                "How often to re-fetch the list. 0 disables auto-refresh (the Refresh button still works). 300s (5 minutes) is the default — Drive isn't an inbox; refreshing more often costs API quota without much benefit.",
            required: false,
        },
        openInBrowser: {
            type: "select",
            defaultValue: "true",
            displayName: "Click opens in browser",
            instructions:
                "When set, clicking a file opens its webViewLink in the user's default browser. Set 'false' if you only want clicks to publish fileSelected for a paired preview widget.",
            options: [
                { value: "true", displayName: "Yes — open in browser" },
                {
                    value: "false",
                    displayName: "No — only publish fileSelected",
                },
            ],
            required: false,
        },
    },
};
export default widgetDefinition;
