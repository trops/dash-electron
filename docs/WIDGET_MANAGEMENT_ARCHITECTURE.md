# Widget Management System Architecture

Complete overview of how widget management works across the Dash application.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     @trops/dash-react UI                     │
│                  (Widget Management Components)              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ mainApi.widgets.*()
                         │
                    [IPC Channel]
                         │
┌────────────────────────┼────────────────────────────────────┐
│     public/lib/api/widgetApi.js                              │
│    (Renderer Process - IPC Handler Wrapper)                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ ipcRenderer.invoke()
                         │
                    [IPC Channel]
                         │
┌────────────────────────┼────────────────────────────────────┐
│              Electron Main Process                           │
│                                                              │
│  public/electron.js                                          │
│    ├─ setupWidgetRegistryHandlers()                          │
│    └─ Creates IPC handlers:                                  │
│       ├─ widget:list                                         │
│       ├─ widget:install                                      │
│       ├─ widget:install-local                                │
│       ├─ widget:load-folder                                  │
│       ├─ widget:uninstall                                    │
│       └─ ... (storage path methods)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐   ┌──────▼──────┐   ┌───▼──────┐
    │Registry │   │   Loader    │   │Component │
    │         │   │             │   │ Manager  │
    │ Download│   │  Discover   │   │          │
    │ Install │   │   Load      │   │Register  │
    │ Uninstall   │ Components  │   │          │
    └────┬────┘   └──────┬──────┘   └───┬──────┘
         │               │               │
    ┌────▼──────────────────────────────▼────┐
    │   Node.js Filesystem (fs, path, etc)    │
    │                                         │
    │   ~/Library/Application Support/Dash/   │
    │   └─ widgets/                           │
    │      ├─ Weather/                        │
    │      │  ├─ package.json                 │
    │      │  └─ widgets/                     │
    │      │     ├─ WeatherWidget.js          │
    │      │     └─ WeatherWidget.dash.js     │
    │      ├─ Calendar/                       │
    │      └─ registry.json                   │
    │                                         │
    │   URLs & ZIP Downloads                  │
    └─────────────────────────────────────────┘
```

## Data Flow: Installing a Widget

```
1. User clicks "Install Widget" in UI
   ↓
2. @trops/dash-react component calls:
   mainApi.widgets.install('Weather', 'https://github.com/.../weather.zip')
   ↓
3. widgetApi.js (renderer) calls:
   ipcRenderer.invoke('widget:install', widgetName, downloadUrl, ...)
   ↓
4. electron.js receives IPC call, calls:
   widgetRegistry.downloadWidget(widgetName, downloadUrl)
   ↓
5. WidgetRegistry:
   a) Fetch ZIP from URL
   b) Extract to ~/Library/.../Dash/widgets/Weather/
   c) Load widget config (dash.json or package.json)
   d) Call loadWidgetComponents()
   ↓
6. loadWidgetComponents():
   a) Discover components (*.dash.js files)
   b) Load each component with DynamicWidgetLoader
   c) Register with ComponentManager
   ↓
7. Main process sends event:
   BrowserWindow.send('widget:installed', { widgetName, config })
   ↓
8. Renderer receives event:
   mainApi.widgets.onInstalled(({ widgetName, config }) => {...})
   ↓
9. UI updates to show new widget
```

## File Organization

### Frontend Code

```
public/lib/api/
├── mainApi.js              ← Exposes mainApi.widgets
├── widgetApi.js            ← All widget management methods
└── ... (other APIs)
```

### Main Process Code

```
src/utils/
├── WidgetRegistry.js       ← Download, install, manage widgets
├── DynamicWidgetLoader.js  ← Discover and load components
└── WidgetSystemManager.js  ← High-level API

public/electron.js          ← IPC handlers setup
```

### React App Code

```
src/
├── Dash.js                 ← Calls initializeWidgetSystems()
└── Widgets/                ← Built-in local widgets
```

### Documentation

```
docs/
├── WIDGET_API.md          ← Full API reference (frontend)
├── WIDGET_API_QUICK_REF.md ← Quick reference guide
├── WIDGET_DEVELOPMENT.md  ← Creating new widgets
├── WIDGET_REGISTRY.md     ← Internal registry details
└── WIDGET_HOT_RELOAD.md   ← How hot reload works
```

### Test Files

```
test/
├── fixtures/
│   ├── weather-widget/        ← Test widget source
│   │   ├── package.json
│   │   ├── README.md
│   │   └── widgets/
│   │       ├── WeatherWidget.js
│   │       └── WeatherWidget.dash.js
│   └── weather-widget.zip     ← Packaged test widget
└── testWidgetIntegration.js   ← Test suite

scripts/
└── testWidgetIntegration.js   ← Run via: npm run test:widgets
```

## Key Components

### WidgetRegistry (src/utils/WidgetRegistry.js)

**Responsibilities:**

-   Download widgets from URLs (supports templates/partials)
-   Extract ZIP files
-   Install from local paths (ZIP or folders)
-   Load widget configurations
-   Maintain registry.json
-   Uninstall widgets

**Key Methods:**

-   `downloadWidget()` - Download and install from URL
-   `installFromLocalPath()` - Install from local ZIP/folder
-   `registerWidgetsFromFolder()` - Batch register widgets
-   `loadWidgetComponents()` - Discover and load components
-   `uninstallWidget()` - Remove widget files

### DynamicWidgetLoader (src/utils/DynamicWidgetLoader.js)

**Responsibilities:**

-   Discover components in widgets (\*.dash.js files)
-   Load component configurations
-   Evaluate .dash.js config files
-   Register with ComponentManager

**Key Methods:**

-   `discoverWidgets()` - Find all components in widget
-   `loadWidget()` - Load single component
-   `loadConfigFile()` - Parse .dash.js
-   `setComponentManager()` - Connect to ComponentManager

### WidgetSystemManager (src/utils/WidgetSystemManager.js)

**Responsibilities:**

-   High-level API for widget operations
-   Initialize widget systems on startup
-   Load previously installed widgets
-   Provide convenient wrapper methods

**Key Methods:**

-   `initializeWidgetSystems()` - Setup on app start
-   `loadDownloadedWidgets()` - Restore installed widgets
-   `installWidget()` - Install wrapper
-   `installWidgetFromLocalPath()` - Local install wrapper
-   `loadWidgetsFromFolder()` - Folder load wrapper

### Widget API (public/lib/api/widgetApi.js)

**Responsibilities:**

-   Expose IPC handlers to renderer
-   Provide clean async/await API
-   Handle errors and logging
-   Manage event listeners

**Available Methods:**

-   `list()` - List all widgets
-   `get()` - Get single widget
-   `install()` - Install from URL
-   `installLocal()` - Install from local path
-   `loadFolder()` - Load from folder
-   `uninstall()` - Remove widget
-   `onInstalled()` - Listen to install events
-   `onLoaded()` - Listen to batch load events

## IPC Handlers

All handlers are set up in `setupWidgetRegistryHandlers()` (electron.js):

```javascript
ipcMain.handle('widget:list', ...)           ← List all widgets
ipcMain.handle('widget:get', ...)            ← Get single widget
ipcMain.handle('widget:install', ...)        ← Install from URL
ipcMain.handle('widget:install-local', ...)  ← Install from local
ipcMain.handle('widget:load-folder', ...)    ← Load multiple
ipcMain.handle('widget:uninstall', ...)      ← Remove widget
ipcMain.handle('widget:cache-path', ...)     ← Get cache dir
ipcMain.handle('widget:storage-path', ...)   ← Get storage dir
ipcMain.handle('widget:set-storage-path', ...)  ← Change storage dir
```

## Events

Events sent from main process to renderer:

```javascript
win.webContents.send("widget:installed", { widgetName, config });
win.webContents.send("widgets:loaded", { count, widgets });
```

Listen in renderer:

```javascript
mainApi.widgets.onInstalled(({ widgetName, config }) => {...})
mainApi.widgets.onLoaded(({ count, widgets }) => {...})
```

## Storage

### Directory Structure

```
~/Library/Application Support/Dash/          (macOS)
├── widgets/
│   ├── Weather/
│   │   ├── package.json
│   │   ├── widgets/
│   │   │   ├── WeatherWidget.js
│   │   │   └── WeatherWidget.dash.js
│   │   └── ... (other files)
│   ├── Calendar/
│   │   └── ... (similar structure)
│   └── registry.json                        (metadata)
└── ... (other app data)
```

### Registry Format

```json
{
  "lastUpdated": "2026-02-07T12:00:00Z",
  "widgets": [
    ["Weather", {
      "name": "WeatherWidget",
      "version": "1.0.0",
      "path": "/full/path/to/Weather",
      "registeredAt": "2026-02-07T12:00:00Z",
      ...
    }]
  ]
}
```

## Startup Flow

```
1. Electron main process starts
   ↓
2. electron.js createWindow()
   ├─ setupWidgetRegistryHandlers()  ← Sets up IPC
   └─ Creates BrowserWindow
   ↓
3. React app loads
   ↓
4. Dash.js componentDidMount()
   ├─ initializeWidgetSystems()      ← Setup ComponentManager
   └─ loadDownloadedWidgets()        ← Load cached widgets
   ↓
5. All widgets are registered and ready
```

## Hot Reload Flow

```
1. User calls: mainApi.widgets.install('Weather', url)
   ↓
2. Download and extract happens
   ↓
3. Components are auto-discovered and loaded
   ↓
4. ComponentManager registers components
   ↓
5. Main process sends 'widget:installed' event
   ↓
6. Renderer can listen to this event and update UI
   ↓
7. Widget immediately available - no restart needed!
```

## Error Handling

-   **Download errors** → Network issues, 404s, etc.
-   **Extraction errors** → Corrupted ZIP, permission issues
-   **Config errors** → Invalid dash.json, missing files
-   **Registration errors** → ComponentManager issues
-   **Uninstall errors** → Files in use, permission issues

All errors are logged and propagated up with descriptive messages.

## Testing

Run tests:

```bash
npm run test:widgets
```

Test coverage:

-   Widget discovery (local widgets)
-   Widget loading (config parsing)
-   Caching (repeated loads)
-   Configuration validation
-   File system operations
-   ZIP extraction and installation
-   Component registration
-   Registry serialization

All 17 tests pass ✓

## Integration with @trops/dash-react

The frontend can:

1. **List widgets** - Show installed widgets in UI
2. **Install widgets** - Download from URLs or local paths
3. **Uninstall widgets** - Remove widgets from app
4. **Manage settings** - Configure widget storage location
5. **Monitor events** - Update UI when widgets are installed
6. **Batch operations** - Load multiple widgets at once

Example components to build:

-   Widget Manager (list/uninstall)
-   Install Dialog (URL or file picker)
-   Settings Panel (storage path)
-   Widget Browser (marketplace)
-   Settings Panel for individual widgets

---

See individual documentation files for detailed information:

-   [WIDGET_API.md](./WIDGET_API.md) - API reference
-   [WIDGET_API_QUICK_REF.md](./WIDGET_API_QUICK_REF.md) - Quick guide
-   [WIDGET_HOT_RELOAD.md](./WIDGET_HOT_RELOAD.md) - Implementation details
