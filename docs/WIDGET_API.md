# Widget Management API

The Widget Management API provides a clean interface for the frontend (@trops/dash-react) to list, install, uninstall, and manage widgets at runtime.

## Overview

All widget operations are accessed through `mainApi.widgets` and communicate with the Electron main process via IPC.

## Methods

### `list()`

Get all installed widgets.

```javascript
const widgets = await mainApi.widgets.list();
// Returns: Array<WidgetConfig>
// [
//   {
//     name: "WeatherWidget",
//     version: "1.0.0",
//     description: "A weather widget",
//     path: "/Users/me/Library/Application Support/Dash/widgets/Weather",
//     ...
//   },
//   ...
// ]
```

### `get(widgetName)`

Get a specific widget by name.

```javascript
const widget = await mainApi.widgets.get("Weather");
// Returns: WidgetConfig | null
```

**Parameters:**

-   `widgetName` (string) - Name of the widget

### `install(widgetName, downloadUrl, dashConfigUrl?)`

Install a widget from a remote URL. Supports multiple URL formats:

```javascript
// Full URL
await mainApi.widgets.install(
    "Weather",
    "https://github.com/user/weather-widget/releases/download/v1.0.0/weather.zip"
);

// Template URL (will replace {version} and {name})
await mainApi.widgets.install(
    "Weather",
    "https://github.com/user/weather-widget/releases/download/v{version}/{name}.zip"
);

// Partial URL (auto-appends v{version}/{name}.zip)
await mainApi.widgets.install(
    "Weather",
    "https://github.com/user/weather-widget/releases/download/"
);

// With custom dash.json metadata
await mainApi.widgets.install(
    "Weather",
    "https://example.com/weather.zip",
    "https://example.com/dash.json"
);
```

**Parameters:**

-   `widgetName` (string) - Name for the widget
-   `downloadUrl` (string) - Download URL (full, template, or partial)
-   `dashConfigUrl` (string, optional) - URL to dash.json metadata file

**Returns:** Promise<WidgetConfig>

**Events:** Emits `widget:installed` event when complete

### `installLocal(widgetName, localPath, dashConfigPath?)`

Install a widget from a local ZIP file or folder.

```javascript
// From ZIP file
await mainApi.widgets.installLocal(
    "Weather",
    "/Users/me/Downloads/weather-widget.zip"
);

// From folder
await mainApi.widgets.installLocal(
    "Weather",
    "/Users/me/CustomWidgets/weather"
);

// From file:// URL
await mainApi.widgets.installLocal(
    "Weather",
    "file:///Users/me/weather-widget.zip"
);

// From home directory
await mainApi.widgets.installLocal("Weather", "~/Downloads/weather-widget.zip");
```

**Parameters:**

-   `widgetName` (string) - Name for the widget
-   `localPath` (string) - Path to ZIP file or folder (supports `~`, `file://`, absolute paths)
-   `dashConfigPath` (string, optional) - Path to dash.json metadata

**Returns:** Promise<WidgetConfig>

**Events:** Emits `widget:installed` event when complete

### `loadFolder(folderPath)`

Load multiple widgets from a folder. Each subfolder is treated as a separate widget.

```javascript
const widgets = await mainApi.widgets.loadFolder("/Users/me/CustomWidgets");
// Loads all subdirectories as widgets
```

**Parameters:**

-   `folderPath` (string) - Path to folder containing widget subdirectories

**Returns:** Promise<Array<WidgetConfig>>

**Events:** Emits `widgets:loaded` event when complete

### `uninstall(widgetName)`

Uninstall a widget and remove its files.

```javascript
const success = await mainApi.widgets.uninstall("Weather");
// Returns: boolean - true if successful, false if not found
```

**Parameters:**

-   `widgetName` (string) - Name of the widget to uninstall

**Returns:** Promise<boolean>

### `getCachePath()`

Get the path where widgets are stored.

```javascript
const path = await mainApi.widgets.getCachePath();
// Returns: string
// macOS: "/Users/me/Library/Application Support/Dash/widgets"
// Windows: "C:\\Users\\me\\AppData\\Roaming\\Dash\\widgets"
// Linux: "/home/me/.config/Dash/widgets"
```

**Returns:** Promise<string>

### `getStoragePath()`

Get the main storage directory (parent of widgets directory).

```javascript
const path = await mainApi.widgets.getStoragePath();
// Returns: string
// macOS: "/Users/me/Library/Application Support/Dash"
```

**Returns:** Promise<string>

### `setStoragePath(customPath)`

Change where widgets are stored. Useful for custom installations or network storage.

```javascript
const result = await mainApi.widgets.setStoragePath(
    "/mnt/external/dash-widgets"
);
// Returns: { success: boolean, path: string, error?: string }
```

**Parameters:**

-   `customPath` (string) - New storage path

**Returns:** Promise<{success: boolean, path: string, error?: string}>

## Events

### `onInstalled(callback)`

Listen for widget installation events. Called when a widget is successfully installed.

```javascript
mainApi.widgets.onInstalled(({ widgetName, config }) => {
    console.log(`Widget installed: ${widgetName}`);
    console.log("Config:", config);

    // Update UI, refresh widget list, show notification, etc.
});
```

**Callback data:**

```javascript
{
  widgetName: string,      // e.g., "Weather"
  config: WidgetConfig     // Full widget configuration
}
```

### `onLoaded(callback)`

Listen for batch widget loading events. Called when multiple widgets are loaded from a folder.

```javascript
mainApi.widgets.onLoaded(({ count, widgets }) => {
    console.log(`Loaded ${count} widgets`);
    console.log("Widgets:", widgets);

    // Update UI to show all new widgets
});
```

**Callback data:**

```javascript
{
  count: number,                    // Number of widgets loaded
  widgets: Array<WidgetConfig>      // Array of loaded widgets
}
```

### `removeInstalledListener(callback)`

Stop listening to installation events.

```javascript
const handler = ({ widgetName, config }) => {
    /* ... */
};
mainApi.widgets.onInstalled(handler);

// Later...
mainApi.widgets.removeInstalledListener(handler);
```

### `removeLoadedListener(callback)`

Stop listening to batch load events.

```javascript
const handler = ({ count, widgets }) => {
    /* ... */
};
mainApi.widgets.onLoaded(handler);

// Later...
mainApi.widgets.removeLoadedListener(handler);
```

## Widget Configuration Object

```typescript
interface WidgetConfig {
    name: string; // Component name (e.g., "WeatherWidget")
    displayName: string; // Display name (e.g., "Weather")
    description: string; // Widget description
    version: string; // Semantic version (e.g., "1.0.0")
    author?: string; // Author name
    icon?: string; // Icon emoji or URL
    category?: string; // Category (e.g., "utilities")

    // Widget dimensions and resizing
    defaultWidth?: number; // Default grid width
    defaultHeight?: number; // Default grid height
    minWidth?: number; // Minimum grid width
    minHeight?: number; // Minimum grid height
    maxWidth?: number; // Maximum grid width
    maxHeight?: number; // Maximum grid height
    resizable?: boolean; // Whether widget is resizable

    // Installation metadata
    path?: string; // Path to installed widget files
    registeredAt?: string; // ISO timestamp of registration
    downloadUrl?: string; // URL for updates (template or full)

    // Configuration
    settings?: Array; // Widget settings/configuration options
    canHaveChildren?: boolean; // Whether widget can contain other components

    [key: string]: any; // Additional custom properties
}
```

## Usage Examples

### Installing from GitHub Release

```javascript
// In a React component
import React from "react";

function InstallWidgetForm() {
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(null);

    const handleInstall = async () => {
        try {
            setLoading(true);
            setError(null);

            const config = await mainApi.widgets.install(
                "Weather",
                "https://github.com/trops/weather-widget/releases/download/v1.0.0/weather.zip"
            );

            console.log("Installed:", config);
            // UI will auto-update via onInstalled event
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button onClick={handleInstall} disabled={loading}>
            {loading ? "Installing..." : "Install Weather Widget"}
        </button>
    );
}
```

### Widget Management Panel

```javascript
function WidgetManager() {
    const [widgets, setWidgets] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        // Load initial list
        loadWidgets();

        // Listen for new installations
        const handleInstalled = ({ widgetName }) => {
            console.log(`${widgetName} installed, refreshing list`);
            loadWidgets();
        };

        mainApi.widgets.onInstalled(handleInstalled);

        return () => {
            mainApi.widgets.removeInstalledListener(handleInstalled);
        };
    }, []);

    const loadWidgets = async () => {
        try {
            setLoading(true);
            const list = await mainApi.widgets.list();
            setWidgets(list);
        } catch (err) {
            console.error("Failed to load widgets:", err);
        } finally {
            setLoading(false);
        }
    };

    const uninstallWidget = async (widgetName) => {
        if (window.confirm(`Uninstall ${widgetName}?`)) {
            try {
                await mainApi.widgets.uninstall(widgetName);
                await loadWidgets();
            } catch (err) {
                console.error("Failed to uninstall:", err);
            }
        }
    };

    if (loading) return <div>Loading widgets...</div>;

    return (
        <div>
            <h2>Installed Widgets ({widgets.length})</h2>
            <ul>
                {widgets.map((w) => (
                    <li key={w.name}>
                        {w.displayName} v{w.version}
                        <button onClick={() => uninstallWidget(w.name)}>
                            Uninstall
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
```

### Drag and Drop Installation

```javascript
function DragDropInstall() {
    const handleDrop = async (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;

        if (files[0]?.name.endsWith(".zip")) {
            try {
                const config = await mainApi.widgets.installLocal(
                    "CustomWidget",
                    files[0].path
                );
                console.log("Installed from drag/drop:", config);
            } catch (err) {
                console.error("Installation failed:", err);
            }
        }
    };

    return (
        <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            style={{ border: "2px dashed #ccc", padding: "20px" }}
        >
            Drop widget ZIP files here
        </div>
    );
}
```

### Batch Loading from Folder

```javascript
async function loadCustomWidgets() {
    try {
        const results = await mainApi.widgets.loadFolder(
            "/Users/me/CustomWidgets"
        );
        console.log(`Loaded ${results.length} widgets from folder`);
        results.forEach((w) => {
            console.log(`- ${w.displayName} v${w.version}`);
        });
    } catch (err) {
        console.error("Failed to load widgets:", err);
    }
}
```

## Error Handling

All methods throw errors if something goes wrong:

```javascript
try {
    await mainApi.widgets.install(
        "Weather",
        "https://invalid-url.com/widget.zip"
    );
} catch (error) {
    // error.message contains details about what failed
    // e.g., "Failed to fetch: 404 Not Found"
    // e.g., "Local path not found: /invalid/path"
    // e.g., "Widget not found: UnknownWidget"

    console.error("Widget operation failed:", error.message);
}
```

## Storage Paths

Widgets are stored in the Electron app's userData directory:

**macOS:**

-   `~/Library/Application Support/Dash/widgets/`
-   Registry: `~/Library/Application Support/Dash/widgets/registry.json`

**Windows:**

-   `%APPDATA%/Dash/widgets/`
-   Registry: `%APPDATA%/Dash/widgets/registry.json`

**Linux:**

-   `~/.config/Dash/widgets/`
-   Registry: `~/.config/Dash/widgets/registry.json`

## Troubleshooting

**Widgets not appearing after install?**

-   Check that `onInstalled` event was triggered
-   Verify widget files were extracted properly
-   Check that widget has correct `widgets/` folder structure

**Install fails with "Cannot find module"?**

-   Verify ipcMain handlers are set up in electron.js
-   Check that `setupWidgetRegistryHandlers()` was called
-   Look at console logs for detailed error messages

**Uninstall succeeds but widget still visible?**

-   UI might need to refresh - call `list()` again
-   Listen to uninstall events to auto-update UI
-   Check ComponentManager hasn't cached the widget

## Related Documentation

-   [WIDGET_DEVELOPMENT.md](./WIDGET_DEVELOPMENT.md) - Creating new widgets
-   [WIDGET_REGISTRY.md](./WIDGET_REGISTRY.md) - How widgets are stored/discovered
-   [WIDGET_HOT_RELOAD.md](./WIDGET_HOT_RELOAD.md) - How hot reload works
