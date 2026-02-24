# Widget Registry & Dynamic Loading System

This system allows you to distribute widgets externally and let end-users download and sideload them into the Dash application at runtime.

## Architecture Overview

```
┌─────────────────────────────────────┐
│    Widget Registry (Metadata)       │
│  - Stores widget configs            │
│  - Manages downloads                │
│  - Tracks installed widgets         │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│    Dynamic Widget Loader            │
│  - Loads components from disk       │
│  - Parses .dash.js configs          │
│  - Discovers available widgets      │
└─────────────────────────────────────┘
           ↓
┌─────────────────────────────────────┐
│  Electron userData Directory        │
│  macOS: ~/Library/Application       │
│         Support/[AppName]/          │
│  Windows: %APPDATA%\[AppName]\      │
│  Linux: ~/.config/[AppName]/        │
│    ├── widgets/                     │
│    │   ├── WidgetOne/               │
│    │   ├── WidgetTwo/               │
│    │   └── registry.json            │
│    └── [other app files]            │
└─────────────────────────────────────┘
```

## Storage Locations

Widgets and configurations are stored in the Electron app's userData directory:

-   **macOS**: `~/Library/Application Support/[AppName]/widgets/`
-   **Windows**: `%APPDATA%\[AppName]\widgets\`
-   **Linux**: `~/.config/[AppName]/widgets/`

You can also specify a custom storage path when initializing the registry.

## Widget Structure

Your widgets should follow this structure (the same as widgets in `src/Widgets/`):

```
MyAwesomeWidget/
├── README.md                 # Optional: Documentation
├── widgets/
│   ├── MyAwesomeWidget.js              # React component
│   └── MyAwesomeWidget.dash.js         # Configuration (includes distribution metadata)
├── contexts/
│   └── MyAwesomeWidgetContext.js       # Optional: Context provider
└── workspaces/
    └── MyAwesomeWidget.js              # Optional: Workspace component
```

## Widget Configuration with Distribution Metadata

When creating your widget, add distribution metadata to your `.dash.js` configuration file:

```javascript
// MyAwesomeWidget.dash.js
export default {
    name: "MyAwesomeWidget",
    component: MyAwesomeWidget,
    type: "widget",
    // ... other config ...

    // Distribution metadata (optional but recommended)
    version: "1.0.0",
    author: "Your Name",
    description: "A brief description of what your widget does",

    // Download URL options (pick one):
    // Option 1: Full URL - specify exact download location
    downloadUrl:
        "https://github.com/yourname/awesome-widget/releases/download/v1.0.0/awesome-widget.zip",

    // Option 2: Template URL - uses {version} and {name} placeholders
    // downloadUrl: "https://github.com/yourname/awesome-widget/releases/download/v{version}/{name}.zip",

    // Option 3: Partial URL - auto-generates v{version}/{name}.zip
    // downloadUrl: "https://github.com/yourname/awesome-widget/releases/download/",

    repository: "https://github.com/yourname/awesome-widget",
};
```

### Download URL Strategies

Choose the strategy that works best for your workflow:

| Strategy         | Example                                 | Best For                             |
| ---------------- | --------------------------------------- | ------------------------------------ |
| **Full URL**     | `https://.../v1.0.0/awesome-widget.zip` | One-off URLs, non-GitHub hosting     |
| **Template URL** | `https://.../v{version}/{name}.zip`     | GitHub releases with version control |
| **Partial URL**  | `https://.../releases/download/`        | Maximum simplicity, GitHub only      |

**How it works:**

-   Full URL: Used as-is
-   Template URL: `{version}` → `1.0.0`, `{name}` → `awesome-widget`
-   Partial URL: Auto-generates `v1.0.0/awesome-widget.zip`

The template/partial URL approach means you update only the `version` field when releasing new versions—the download URL is automatically constructed!

## Creating New Widgets

To create a new widget for distribution, use the existing `widgetize.js` script:

```bash
npm run widgetize MyAwesomeWidget
```

This uses the templates in:

-   `scripts/template/widgets/` - Widget template files
-   `scripts/template/contexts/` - Context template files
-   `scripts/template/workspaces/` - Workspace template files

The script will:

1. Copy template files to `src/Widgets/MyAwesomeWidget/`
2. Replace all instances of "Template" with "MyAwesomeWidget"
3. Automatically register the export in `src/Widgets/index.js`

Then you can modify the generated files to add your widget's functionality.

## Publishing Your Widget

### Step 1: Prepare Your Widget

Before publishing, update your widget's `.dash.js` configuration with distribution metadata and choose a URL strategy:

**Example 1: Using Template URL (Recommended for version control)**

```javascript
// src/Widgets/Weather/widgets/Weather.dash.js
export default {
    name: "WeatherWidget",
    // ... other config ...
    version: "1.0.0",
    author: "Your Name",
    description: "Weather widget with real-time forecasts",

    // Use template URL - only update version field for new releases!
    downloadUrl:
        "https://github.com/yourname/weather-widget/releases/download/v{version}/{name}.zip",
    // This resolves to: https://.../v1.0.0/weather-widget.zip

    repository: "https://github.com/yourname/weather-widget",
};
```

**Example 2: Using Partial URL (Simplest for GitHub)**

```javascript
export default {
    name: "WeatherWidget",
    version: "1.0.0",
    // Point to releases folder, system auto-generates the rest
    downloadUrl:
        "https://github.com/yourname/weather-widget/releases/download/",
    // This resolves to: https://.../v1.0.0/weather-widget.zip
    // ...
};
```

**Example 3: Using Full URL (Most control)**

```javascript
export default {
    name: "WeatherWidget",
    version: "1.0.0",
    // Specify exact URL (no auto-resolution)
    downloadUrl:
        "https://github.com/yourname/weather-widget/releases/download/v1.0.0/weather-widget.zip",
    // ...
};
```

### Step 2: Create Repository

1. Create a GitHub repo for your widget (e.g., `weather-widget`)
2. Push your `src/Widgets/Weather/` folder contents
3. Create a GitHub release with tag matching your version (e.g., `v1.0.0`)

### Step 3: Package the Widget

Create a ZIP file with the package name matching your config (important for template/partial URLs):

```bash
# From your widget's root directory
# The ZIP should be named to match the {name} placeholder in your URL
cd src/Widgets/Weather
zip -r ~/Desktop/weather-widget.zip .

# Upload to GitHub release with the tag matching your version
# e.g., release tag: v1.0.0
# uploaded file: weather-widget.zip
```

**Important:** For template and partial URLs, the ZIP filename must match the `{name}` value in your downloadUrl. So if your URL uses `{name}`, create the ZIP as `weather-widget.zip`.

### Step 4: Versioning & Updates

When you release a new version:

1. **Update the version in `.dash.js`:**

    ```javascript
    version: "1.1.0",  // ← Just update this
    downloadUrl: "https://github.com/yourname/weather-widget/releases/download/v{version}/{name}.zip",
    // Automatically resolves to: https://.../v1.1.0/weather-widget.zip
    ```

2. **Create a new GitHub release** with tag `v1.1.0`
3. **Upload the new ZIP** as `weather-widget.zip`

That's it! No need to update URLs manually—just bump the version field.

### Step 5: Share for Installation

Once published, developers can install your widget with:

## `widget:install` API

The `widget:install` IPC call supports **remote URLs**, **local ZIP paths**, and **local widget folders**.

**Signature**

```javascript
window.electron.invoke('widget:install', widgetName, downloadUrl?, dashConfigUrl?)
```

**Parameters**

-   `widgetName` (string): Name to register the widget under.
-   `downloadUrl` (string, optional):
    -   `https://...` → download from web
    -   `/Users/.../widget.zip` → local ZIP
    -   `/Users/.../WidgetFolder` → local folder
    -   `file:///Users/.../widget.zip` → local ZIP (file URL)
-   `dashConfigUrl` (string, optional): URL or local path to a `dash.json` to merge into the widget config.

**What it does**

-   Downloads/extracts the widget (or copies from local path)
-   Reads `dash.json` or `package.json` for metadata
-   Registers with `ComponentManager`

**Option 1: Using Your Widget's downloadUrl (Simplest)**

```javascript
// Uses the downloadUrl from your .dash.js automatically
window.electron.invoke("widget:install", "Weather");
```

**Option 2: Specify a Custom Version/URL**

```javascript
// Override with a specific version
window.electron.invoke(
    "widget:install",
    "Weather",
    "https://github.com/yourname/weather-widget/releases/download/v1.1.0/weather-widget.zip"
);
```

## Usage

### Quick Start

```javascript
import {
    initializeWidgetSystems,
    loadDownloadedWidgets,
    installWidget,
    installWidgetFromLocalPath,
    loadWidgetsFromFolder,
} from "./src/utils/WidgetSystemManager";
import { ComponentManager } from "@trops/dash-react";

// 1. Initialize when your app starts
await initializeWidgetSystems();

// 2. Load any previously downloaded widgets
await loadDownloadedWidgets();

// 3. Install new widgets (using downloadUrl from widget config)
await installWidget("Weather");

// Or override with a custom URL:
await installWidget(
    "Weather",
    "https://github.com/user/weather-widget/releases/download/v1.0.0/weather-widget.zip"
);

// Install a local ZIP or folder (no web server needed)
await installWidgetFromLocalPath(
    "Weather",
    "/Users/you/widgets/weather-widget.zip"
);

// Drop-in folder support: each subfolder is treated as a widget
await loadWidgetsFromFolder("/Users/you/widgets/drop-in");

// Widgets are now registered with ComponentManager and ready to use!
```

## Local Testing (No Git Required)

### Option 1: Local ZIP Install

```bash
# Create a ZIP from your widget folder
cd /path/to/your/widget
zip -r ~/Desktop/weather-widget.zip .
```

```javascript
// Install directly from local ZIP
await window.electron.invoke(
    "widget:install-local",
    "Weather",
    "/Users/you/Desktop/weather-widget.zip"
);
```

### Option 2: Drop-In Folder

Place widget folders into a directory (e.g., `~/DashWidgets`) like this:

```
~/DashWidgets/
├── Weather/
├── Clock/
└── Stocks/
```

Then register them in one call:

```javascript
await window.electron.invoke("widget:load-folder", "/Users/you/DashWidgets");
```

Each subfolder is treated as a widget and will be registered automatically.

### Advanced Usage

#### In Electron Main Process (main.js)

```javascript
import {
    WidgetRegistry,
    setupWidgetRegistryHandlers,
} from "./src/utils/WidgetRegistry.js";

// Optional: Initialize with custom storage path
// WidgetRegistry.initialize('/custom/path/for/widgets');
// If not called, defaults to app.getPath('userData')/widgets

// Setup IPC handlers for widget management
setupWidgetRegistryHandlers();
```

#### In React Component (Renderer)

```javascript
// List all registered widgets
const widgets = await window.electron.invoke("widget:list");

// Install a new widget from URL
await window.electron.invoke(
    "widget:install",
    "MyAwesomeWidget",
    "https://...."
);

// Get widget details
const widget = await window.electron.invoke("widget:get", "MyAwesomeWidget");

// Uninstall a widget
await window.electron.invoke("widget:uninstall", "MyAwesomeWidget");

// Get the widgets cache path
const cachePath = await window.electron.invoke("widget:cache-path");

// Get the full storage path
const storagePath = await window.electron.invoke("widget:storage-path");

// Set custom storage path (e.g., from a settings dialog)
const result = await window.electron.invoke(
    "widget:set-storage-path",
    "/custom/path"
);
```

#### Manual Widget Discovery

```javascript
import { dynamicWidgetLoader } from "./src/utils/DynamicWidgetLoader.js";
import { ComponentManager } from "@trops/dash-react";

// Set ComponentManager for automatic registration
dynamicWidgetLoader.setComponentManager(ComponentManager);

// Discover available widgets in a directory
const widgets = dynamicWidgetLoader.discoverWidgets("/path/to/widget");

// Load a specific widget (will auto-register with ComponentManager)
const { component, config, registered } = await dynamicWidgetLoader.loadWidget(
    "MyAwesomeWidget",
    "/path/to/widget/folder",
    "MyAwesomeWidgetWidget",
    true // autoRegister = true
);

console.log(`Registered: ${registered}`); // true
```

## Distribution Methods

### Option 1: GitHub Repository

-   Store widget in a GitHub repo
-   Create releases with ZIP archives
-   Use release download URL as `downloadUrl`

### Option 2: Custom Server

-   Host ZIP files on your server
-   Provide download URL in dash.json or registry API

### Option 3: NPM Registry

-   Package widget as npm package
-   Use npm registry for hosting

## Example: Package a Widget for Distribution

```bash
# 1. Create your widget using widgetize.js
npm run widgetize MyAwesomeWidget

# 2. Modify the generated files in src/Widgets/MyAwesomeWidget/
# Update widgets/MyAwesomeWidget.dash.js with your configuration
# Update widgets/MyAwesomeWidget.js with your component logic
# Update contexts/MyAwesomeWidgetContext.js with your context
# Update workspaces/MyAwesomeWidget.js with your workspace

# 3. Create a repository for your widget
mkdir my-awesome-widget-repo
cd my-awesome-widget-repo
git init

# 4. Copy your widget files
cp -r src/Widgets/MyAwesomeWidget/* .

# 5. Commit and push to GitHub

# 6. Create a release with a ZIP archive
# https://github.com/yourname/my-awesome-widget/archive/refs/heads/main.zip

# Users can now install with:
# await window.electron.invoke('widget:install', 'MyAwesomeWidget', 'https://github.com/yourname/my-awesome-widget/archive/refs/heads/main.zip')
```

## Testing Locally

To test the widget system with your existing MyFirstWidget:

```bash
node scripts/testWidgetRegistry.js
```

This will:

1. Discover widgets in src/Widgets/MyFirstWidget
2. Load the widget configuration
3. Register it in the widget registry
4. Display all registered widgets

## Testing

### Run Widget Integration Tests

```bash
npm run test:widgets
```

This runs a comprehensive test suite that verifies:

-   Widget discovery in directories
-   Configuration file loading
-   Caching behavior
-   File system operations
-   Path validation

### Manual Testing

#### Test in Node.js (Config Discovery Only)

```javascript
import { dynamicWidgetLoader } from "./src/utils/DynamicWidgetLoader.js";

// Discover widgets
const widgets = dynamicWidgetLoader.discoverWidgets(
    "./src/Widgets/MyFirstWidget"
);
console.log("Found widgets:", widgets);
```

#### Test in Electron Renderer (Full Widget Loading)

Since widget configs reference React components imported at the top of `.dash.js` files, full widget loading must happen in the renderer process where these dependencies are available:

```javascript
import {
    initializeWidgetSystems,
    loadDownloadedWidgets,
} from "./src/utils/WidgetSystemManager";
import { ComponentManager } from "@trops/dash-react";

// In your App.js or main component
useEffect(() => {
    async function setupWidgets() {
        await initializeWidgetSystems();
        await loadDownloadedWidgets();
        console.log("✓ Widgets loaded and registered");
    }
    setupWidgets();
}, []);
```

## Troubleshooting

**Q: Tests pass but say "loaded config: ReferenceError"**

-   This is expected in Node.js tests. The config files reference React components that don't exist in a Node.js VM context.
-   Full loading happens in the Electron renderer process where all dependencies are available.

**Q: Widgets not appearing in app after download**

-   Check the widget storage path: `await window.electron.invoke('widget:storage-path')`
-   Verify the widget structure matches the expected format
-   Check console for registration errors

**Q: "Cannot find module" errors**

-   Ensure you're using the utilities in the correct context (Electron main vs renderer)
-   WidgetRegistry IPC handlers must be initialized in the main process
-   Widget loading should happen in the renderer process
