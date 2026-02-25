/**
 * Complete Example: Widget Registry System
 *
 * This demonstrates the full workflow:
 * 1. Initialize registry in Electron main process
 * 2. Setup IPC handlers
 * 3. Load widgets in renderer
 * 4. Register with ComponentManager
 */

// ============================================================
// MAIN PROCESS (public/electron.js or main.js)
// ============================================================

import { app } from "electron";
import {
    WidgetRegistry,
    setupWidgetRegistryHandlers,
} from "./src/utils/WidgetRegistry.js";

function setupWidgetSystem() {
    // Optional: Use custom storage path
    // WidgetRegistry.initialize('/custom/path');

    // Setup IPC handlers so renderer can communicate with registry
    setupWidgetRegistryHandlers();

    console.log("[Main] Widget registry initialized");
}

// Call this in app.whenReady()
app.whenReady().then(() => {
    setupWidgetSystem();
    // ... rest of electron setup
});

// ============================================================
// RENDERER PROCESS (React component)
// ============================================================

import { useEffect, useState } from "react";
import { ComponentManager } from "@trops/dash-react";
import {
    initializeWidgetSystems,
    loadDownloadedWidgets,
    installWidget,
    uninstallWidget,
} from "./src/utils/WidgetSystemManager";

export function WidgetMarketplace() {
    const [widgets, setWidgets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [storePath, setStorePath] = useState("");

    // Initialize systems and load existing widgets
    useEffect(() => {
        async function init() {
            try {
                // Initialize widget systems with ComponentManager
                // This connects registry and loader to ComponentManager
                await initializeWidgetSystems();

                // Load any previously downloaded widgets
                await loadDownloadedWidgets();

                // Get current storage path for display
                const path = await window.electron.invoke(
                    "widget:storage-path"
                );
                setStorePath(path);

                // List all widgets
                const list = await window.electron.invoke("widget:list");
                setWidgets(list);

                console.log("✓ Widget system ready");
            } catch (error) {
                console.error("Failed to initialize widgets:", error);
            }
        }

        init();
    }, []);

    // Install a widget from URL
    const handleInstallWidget = async (widgetName, downloadUrl) => {
        setLoading(true);
        try {
            const config = await installWidget(widgetName, downloadUrl);
            console.log(`✓ Installed widget: ${widgetName}`);

            // Refresh widget list
            const list = await window.electron.invoke("widget:list");
            setWidgets(list);
        } catch (error) {
            console.error(`Failed to install widget: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Uninstall a widget
    const handleUninstallWidget = (widgetName) => {
        uninstallWidget(widgetName);
        setWidgets(widgets.filter((w) => w.name !== widgetName));
    };

    return (
        <div className="widget-marketplace">
            <h2>Widget Marketplace</h2>

            <div className="storage-info">
                <p>Storage Path: {storePath}</p>
            </div>

            <div className="install-widget">
                <h3>Install New Widget</h3>
                <button
                    onClick={() =>
                        handleInstallWidget(
                            "MyAwesomeWidget",
                            "https://github.com/user/my-awesome-widget/archive/main.zip"
                        )
                    }
                    disabled={loading}
                >
                    {loading ? "Installing..." : "Install Widget"}
                </button>
            </div>

            <div className="installed-widgets">
                <h3>Installed Widgets ({widgets.length})</h3>
                <ul>
                    {widgets.map((widget) => (
                        <li key={widget.name}>
                            <div className="widget-info">
                                <strong>{widget.name}</strong>
                                <p>{widget.description || "No description"}</p>
                                <small>v{widget.version || "1.0.0"}</small>
                            </div>
                            <button
                                onClick={() =>
                                    handleUninstallWidget(widget.name)
                                }
                                className="uninstall-btn"
                            >
                                Uninstall
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

// ============================================================
// USAGE EXAMPLE: Download and Install a Widget
// ============================================================

/*

// User clicks "Install" button in marketplace
async function downloadAndInstallWidget() {
  try {
    // Option 1: From GitHub
    await window.electron.invoke(
      'widget:install',
      'WeatherWidget',
      'https://github.com/user/weather-widget/archive/refs/heads/main.zip'
    );
    
    // Option 2: From custom server
    await window.electron.invoke(
      'widget:install',
      'CalendarWidget',
      'https://widgets.example.com/calendar-widget.zip'
    );
    
    console.log('✓ Widget installed and ready to use!');
    
    // Widget is now:
    // 1. Downloaded to userData/widgets/
    // 2. Registered in registry.json
    // 3. Automatically registered with ComponentManager
    // 4. Ready to be placed in dashboards
    
  } catch (error) {
    console.error('Installation failed:', error);
  }
}

*/
