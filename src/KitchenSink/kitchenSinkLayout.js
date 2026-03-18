/**
 * Kitchen Sink sample workspace layout.
 *
 * Returns a workspace object compatible with workspaces.json format,
 * featuring a 4x3 grid with 12 widgets showcasing different capabilities.
 */

const WIDGET_NAMES = [
    "ChatClaudeCodeWidget",
    "NotepadWidget",
    "ThemeViewerWidget",
    "GitHubWidget",
    "SlackWidget",
    "GmailWidget",
    "GoogleCalendarWidget",
    "NotionWidget",
    "FilesystemWidget",
    "EventSenderWidget",
    "EventReceiverWidget",
    "NotificationWidget",
];

function createKitchenSinkWorkspace() {
    const grid = {
        rows: 4,
        cols: 3,
        gap: "gap-2",
    };

    // Map grid cells to widget item IDs (2–13)
    let widgetId = 2;
    for (let row = 1; row <= 4; row++) {
        for (let col = 1; col <= 3; col++) {
            grid[`${row}.${col}`] = { component: widgetId, hide: false };
            widgetId++;
        }
    }

    // Root grid container
    const layoutItems = [
        {
            id: 1,
            order: 1,
            parent: 0,
            component: "LayoutGridContainer",
            type: "grid",
            workspace: "layout",
            width: "w-full",
            height: "h-full",
            hasChildren: 1,
            scrollable: true,
            grid,
        },
    ];

    // Widget items (id 2–13)
    WIDGET_NAMES.forEach((name, index) => {
        layoutItems.push({
            id: index + 2,
            order: index + 1,
            parent: 1,
            component: name,
            type: "widget",
            workspace: "layout",
            hasChildren: 0,
            canHaveChildren: false,
            scrollable: true,
        });
    });

    return {
        id: Date.now(),
        name: "Kitchen Sink",
        type: "workspace",
        label: "Kitchen Sink",
        version: 1,
        menuId: 1,
        selectedProviders: {},
        themeKey: null,
        layout: layoutItems,
    };
}

export { createKitchenSinkWorkspace };
