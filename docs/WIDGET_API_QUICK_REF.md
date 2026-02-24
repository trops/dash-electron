# Widget Management Quick Reference

For frontend developers using @trops/dash-react to build widget management UI.

## Available Methods

```javascript
// List all widgets
const widgets = await mainApi.widgets.list();

// Get single widget
const widget = await mainApi.widgets.get("Weather");

// Install from URL
await mainApi.widgets.install(
    "Weather",
    "https://github.com/user/weather/releases/download/v1.0.0/weather.zip"
);

// Install from local file/folder
await mainApi.widgets.installLocal("Weather", "/path/to/widget.zip");

// Load multiple from folder
await mainApi.widgets.loadFolder("/path/to/widgets/");

// Uninstall
await mainApi.widgets.uninstall("Weather");

// Get cache path
const path = await mainApi.widgets.getCachePath();

// Get storage path
const path = await mainApi.widgets.getStoragePath();

// Change storage path
await mainApi.widgets.setStoragePath("/new/path");
```

## Listen to Events

```javascript
// When a widget is installed
mainApi.widgets.onInstalled(({ widgetName, config }) => {
    console.log(`${widgetName} installed!`);
});

// When multiple widgets are loaded
mainApi.widgets.onLoaded(({ count, widgets }) => {
    console.log(`Loaded ${count} widgets`);
});

// Remove listeners when done
mainApi.widgets.removeInstalledListener(handler);
mainApi.widgets.removeLoadedListener(handler);
```

## Widget Object Structure

```javascript
{
  name: "WeatherWidget",           // Component class name
  displayName: "Weather",           // User-friendly name
  description: "Weather widget",
  version: "1.0.0",
  author: "John Doe",
  icon: "🌤️",
  category: "utilities",
  path: "/full/path/to/widget",     // Installation directory
  registeredAt: "2026-02-07T...",   // When it was installed
  downloadUrl: "https://...",       // For checking updates
  defaultWidth: 2,                  // Grid units
  defaultHeight: 2,
  minWidth: 1,
  maxWidth: 4,
  resizable: true,
  settings: [],                     // Widget configuration options
  canHaveChildren: false
}
```

## Common Patterns

### React Hook for Widget List

```javascript
function useWidgets() {
    const [widgets, setWidgets] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        const loadWidgets = async () => {
            const list = await mainApi.widgets.list();
            setWidgets(list);
            setLoading(false);
        };

        loadWidgets();

        const handleInstalled = () => loadWidgets();
        mainApi.widgets.onInstalled(handleInstalled);

        return () => mainApi.widgets.removeInstalledListener(handleInstalled);
    }, []);

    return { widgets, loading };
}

// Usage
function WidgetList() {
    const { widgets, loading } = useWidgets();
    return (
        <div>
            {widgets.map((w) => (
                <div key={w.name}>{w.displayName}</div>
            ))}
        </div>
    );
}
```

### Install Dialog Component

```javascript
function InstallWidgetDialog({ onClose }) {
    const [url, setUrl] = React.useState("");
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState("");

    const handleInstall = async () => {
        try {
            setLoading(true);
            setError("");
            await mainApi.widgets.install("MyWidget", url);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Download URL"
            />
            {error && <p style={{ color: "red" }}>{error}</p>}
            <button onClick={handleInstall} disabled={loading}>
                {loading ? "Installing..." : "Install"}
            </button>
        </div>
    );
}
```

### Widget Manager Component

```javascript
function WidgetManager() {
    const [widgets, setWidgets] = React.useState([]);

    React.useEffect(() => {
        const refresh = async () => {
            const list = await mainApi.widgets.list();
            setWidgets(list);
        };

        refresh();
        mainApi.widgets.onInstalled(() => refresh());
        mainApi.widgets.onLoaded(() => refresh());
    }, []);

    const uninstall = async (name) => {
        if (window.confirm(`Remove ${name}?`)) {
            await mainApi.widgets.uninstall(name);
            setWidgets(widgets.filter((w) => w.name !== name));
        }
    };

    return (
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Version</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                {widgets.map((w) => (
                    <tr key={w.name}>
                        <td>{w.displayName}</td>
                        <td>{w.version}</td>
                        <td>
                            <button onClick={() => uninstall(w.name)}>
                                Uninstall
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
```

## Error Messages

```javascript
// Handle errors properly
try {
    await mainApi.widgets.install(name, url);
} catch (error) {
    // error.message examples:
    // "Failed to fetch: 404 Not Found"
    // "Local path not found: /path/to/zip"
    // "Widget not found: UnknownWidget"
    // "Error loading widget config: ..."

    console.error(`Failed: ${error.message}`);
}
```

## URL Formats for Install

```javascript
// Full URL - use exactly as-is
await mainApi.widgets.install(
    "Weather",
    "https://github.com/user/repo/releases/download/v1.0.0/weather.zip"
);

// Template URL - replace {version} and {name}
await mainApi.widgets.install(
    "Weather",
    "https://github.com/user/repo/releases/download/v{version}/{name}.zip"
);

// Partial URL - auto-appends v{version}/{name}.zip
await mainApi.widgets.install(
    "Weather",
    "https://github.com/user/repo/releases/download/"
);
```

## Testing in Console

```javascript
// In dev tools console:
await mainApi.widgets.list();
await mainApi.widgets.install("Weather", "path/to/weather.zip");
await mainApi.widgets.getCachePath();
```

---

See [WIDGET_API.md](./WIDGET_API.md) for full documentation.
