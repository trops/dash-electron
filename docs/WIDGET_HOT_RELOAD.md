# Widget Hot Reload System

This document explains how widgets are automatically loaded and registered at runtime, both on app startup and when new widgets are installed while the app is running.

## Overview

The widget hot reload system allows end users to:

1. **Install widgets while the app is running** - No restart required
2. **Automatically load widgets on startup** - Previously installed widgets are restored
3. **Seamless integration** - Widgets are discovered, loaded, and registered with ComponentManager automatically

## Architecture

### Components

1. **WidgetRegistry** (`src/utils/WidgetRegistry.js`)

    - Downloads/installs widgets from URLs or local paths
    - Stores widgets in `~/Library/Application Support/Dash/widgets/`
    - Maintains registry.json with widget metadata
    - Automatically discovers and loads widget components after install

2. **DynamicWidgetLoader** (`src/utils/DynamicWidgetLoader.js`)

    - Discovers widget components in widget directories
    - Loads .dash.js config files and .js component files
    - Registers components with ComponentManager

3. **WidgetSystemManager** (`src/utils/WidgetSystemManager.js`)

    - High-level API for widget operations
    - `initializeWidgetSystems()` - Sets up ComponentManager integration
    - `loadDownloadedWidgets()` - Loads all cached widgets on startup

4. **IPC Handlers** (in `public/electron.js`)

    - `widget:install` - Install from URL
    - `widget:install-local` - Install from local ZIP or folder
    - `widget:load-folder` - Batch load from drop-in folder
    - Sends `widget:installed` and `widgets:loaded` events to renderer

5. **Dash.js** (`src/Dash.js`)
    - Initializes widget systems on mount
    - Loads previously installed widgets
    - Listens for widget:installed events for hot reload

## Flow Diagrams

### App Startup Flow

```
1. Dash.js componentDidMount()
   ↓
2. initializeWidgetSystems()
   - Sets ComponentManager on WidgetRegistry
   - Sets ComponentManager on DynamicWidgetLoader
   ↓
3. loadDownloadedWidgets()
   - Reads registry.json
   - For each widget:
     a. Discover components (*.dash.js files)
     b. Load each component
     c. Register with ComponentManager
   ↓
4. Widgets appear in UI (ready to use)
```

### Runtime Installation Flow

```
1. User calls: window.electron.invoke("widget:install", "Weather", url)
   ↓
2. Main Process (electron.js)
   - IPC handler receives request
   - Calls widgetRegistry.downloadWidget()
   ↓
3. WidgetRegistry.downloadWidget()
   a. Fetch ZIP from URL
   b. Extract to ~/Library/Application Support/Dash/widgets/Weather/
   c. Load widget config (dash.json or package.json)
   d. Register widget in registry.json
   e. Call loadWidgetComponents()
   ↓
4. WidgetRegistry.loadWidgetComponents()
   a. Discover components (e.g., "WeatherWidget")
   b. For each component:
      - Load .dash.js config
      - Call ComponentManager.registerWidget()
   ↓
5. Main process sends event
   - BrowserWindow.send('widget:installed', { widgetName, config })
   ↓
6. Renderer Process (Dash.js)
   - Event listener receives notification
   - Logs confirmation
   - Widget is already registered and ready to use
   ↓
7. User can now use the widget immediately
```

## Usage Examples

### For End Users (Runtime)

**Install from URL:**

```javascript
await window.electron.invoke(
    "widget:install",
    "Weather",
    "https://github.com/user/weather-widget/releases/download/v1.0.0/weather.zip"
);
```

**Install from local ZIP:**

```javascript
await window.electron.invoke(
    "widget:install-local",
    "Weather",
    "/Users/me/Downloads/weather.zip"
);
```

**Load from drop-in folder:**

```javascript
await window.electron.invoke("widget:load-folder", "/Users/me/CustomWidgets");
```

### For Developers

**Test widget locally before publishing:**

```bash
# Build your widget
cd src/Widgets/Weather
zip -r ~/weather-widget.zip .

# Install in running app
# (use developer console in app)
await window.electron.invoke("widget:install-local", "Weather",
  "/Users/me/weather-widget.zip"
);
```

## Key Features

### ✅ No Restart Required

-   Widgets are loaded immediately after installation
-   ComponentManager registration happens automatically
-   UI updates to show new widgets

### ✅ Persistent Storage

-   Widgets are stored in userData directory
-   Registry maintains metadata
-   Automatically restored on next app launch

### ✅ Error Handling

-   Failed downloads/installs won't crash the app
-   Individual widget load failures are logged but don't stop others
-   Missing/corrupt widgets are skipped

### ✅ Developer Friendly

-   Test widgets locally without publishing to GitHub
-   Drop entire folders of widgets at once
-   Clear console logging for debugging

## Event System

### Events Sent to Renderer

**widget:installed**

```javascript
{
  widgetName: "Weather",
  config: {
    name: "Weather",
    version: "1.0.0",
    description: "...",
    // ... other metadata
  }
}
```

**widgets:loaded**

```javascript
{
  count: 3,
  widgets: [
    { name: "Weather", path: "...", version: "1.0.0" },
    { name: "Calendar", path: "...", version: "2.0.0" },
    // ...
  ]
}
```

### Listening for Events

In React components:

```javascript
componentDidMount() {
  window.electron.on('widget:installed', this.handleWidgetInstalled);
}

componentWillUnmount() {
  window.electron.off('widget:installed', this.handleWidgetInstalled);
}

handleWidgetInstalled = ({ widgetName, config }) => {
  console.log(`New widget available: ${widgetName}`);
  // Optionally refresh UI, show notification, etc.
}
```

## Storage Locations

**macOS:**

-   Widgets: `~/Library/Application Support/Dash/widgets/`
-   Registry: `~/Library/Application Support/Dash/widgets/registry.json`

**Windows:**

-   Widgets: `%APPDATA%/Dash/widgets/`
-   Registry: `%APPDATA%/Dash/widgets/registry.json`

**Linux:**

-   Widgets: `~/.config/Dash/widgets/`
-   Registry: `~/.config/Dash/widgets/registry.json`

## Troubleshooting

### Widget not appearing after install

1. **Check console logs** - Look for error messages
2. **Verify widget structure** - Must have `widgets/` folder with `.js` and `.dash.js` files
3. **Check registry** - Inspect `registry.json` to see if widget was registered
4. **Restart app** - Should reload all widgets on startup

### Components not registering

1. **Verify ComponentManager** - Check that `initializeWidgetSystems()` was called
2. **Check file names** - Must match pattern: `WidgetName.js` and `WidgetName.dash.js`
3. **Inspect config** - `.dash.js` file must export valid config object

### IPC errors

1. **Check preload.js** - Ensure `window.electron` is exposed
2. **Verify handlers** - Confirm `setupWidgetRegistryHandlers()` is called in electron.js
3. **Test manually** - Use developer console to test IPC calls

## Next Steps

Consider adding:

-   **UI Management Panel** - Visual interface for browsing/installing/uninstalling widgets
-   **Widget Marketplace** - Central repository of available widgets
-   **Auto-updates** - Check for widget updates periodically
-   **Widget Dependencies** - Support widgets that depend on other widgets
-   **Permissions System** - Control what APIs widgets can access
