/**
 * widgetApi.js
 *
 * Frontend API for widget management
 * Provides methods to list, install, uninstall, and manage widgets
 *
 * Usage:
 * mainApi.widgets.list()
 * mainApi.widgets.install('Weather', 'https://github.com/user/weather-widget/releases/download/v1.0.0/weather.zip')
 * mainApi.widgets.installLocal('Weather', '/path/to/widget.zip')
 * mainApi.widgets.uninstall('Weather')
 */

const { ipcRenderer } = require("electron");

const widgetApi = {
    /**
     * List all installed widgets
     * @returns {Promise<Array>} Array of widget configurations
     */
    list: async () => {
        try {
            return await ipcRenderer.invoke("widget:list");
        } catch (error) {
            console.error("[WidgetApi] Error listing widgets:", error);
            throw error;
        }
    },

    /**
     * Get a specific widget by name
     * @param {string} widgetName - Name of the widget
     * @returns {Promise<Object|null>} Widget configuration or null if not found
     */
    get: async (widgetName) => {
        try {
            return await ipcRenderer.invoke("widget:get", widgetName);
        } catch (error) {
            console.error(
                `[WidgetApi] Error getting widget ${widgetName}:`,
                error
            );
            throw error;
        }
    },

    /**
     * Install a widget from a remote URL
     * Supports full URLs, template URLs with {version} and {name}, and partial URLs
     *
     * @param {string} widgetName - Name of the widget (e.g., "Weather")
     * @param {string} downloadUrl - Download URL (full, template, or partial)
     * @param {string} dashConfigUrl - Optional: URL to dash.json metadata
     * @returns {Promise<Object>} Widget configuration
     *
     * @example
     * // Full URL
     * await mainApi.widgets.install('Weather', 'https://github.com/user/weather-widget/releases/download/v1.0.0/weather.zip')
     *
     * // Template URL
     * await mainApi.widgets.install('Weather', 'https://github.com/user/weather-widget/releases/download/v{version}/{name}.zip')
     *
     * // Partial URL (auto-appends v{version}/{name}.zip)
     * await mainApi.widgets.install('Weather', 'https://github.com/user/weather-widget/releases/download/')
     */
    install: async (widgetName, downloadUrl, dashConfigUrl = null) => {
        try {
            console.log(
                `[WidgetApi] Installing widget: ${widgetName} from ${downloadUrl}`
            );
            const config = await ipcRenderer.invoke(
                "widget:install",
                widgetName,
                downloadUrl,
                dashConfigUrl
            );
            console.log(`[WidgetApi] ✓ Widget ${widgetName} installed`);
            return config;
        } catch (error) {
            console.error(
                `[WidgetApi] Error installing widget ${widgetName}:`,
                error
            );
            throw error;
        }
    },

    /**
     * Install a widget from a local ZIP file or folder
     *
     * @param {string} widgetName - Name of the widget
     * @param {string} localPath - Path to ZIP file or widget folder
     * @param {string} dashConfigPath - Optional: path to dash.json metadata
     * @returns {Promise<Object>} Widget configuration
     *
     * @example
     * // Install from ZIP
     * await mainApi.widgets.installLocal('Weather', '/Users/me/Downloads/weather-widget.zip')
     *
     * // Install from folder
     * await mainApi.widgets.installLocal('Weather', '/Users/me/CustomWidgets/weather')
     *
     * // Install from file:// URL
     * await mainApi.widgets.installLocal('Weather', 'file:///Users/me/weather-widget.zip')
     */
    installLocal: async (widgetName, localPath, dashConfigPath = null) => {
        try {
            console.log(
                `[WidgetApi] Installing local widget: ${widgetName} from ${localPath}`
            );
            const config = await ipcRenderer.invoke(
                "widget:install-local",
                widgetName,
                localPath,
                dashConfigPath
            );
            console.log(`[WidgetApi] ✓ Local widget ${widgetName} installed`);
            return config;
        } catch (error) {
            console.error(
                `[WidgetApi] Error installing local widget ${widgetName}:`,
                error
            );
            throw error;
        }
    },

    /**
     * Load multiple widgets from a folder
     * Each subfolder is treated as a separate widget
     *
     * @param {string} folderPath - Path to folder containing widget subdirectories
     * @returns {Promise<Array>} Array of loaded widget configurations
     *
     * @example
     * // Load all widgets from a folder
     * await mainApi.widgets.loadFolder('/Users/me/CustomWidgets')
     */
    loadFolder: async (folderPath) => {
        try {
            console.log(
                `[WidgetApi] Loading widgets from folder: ${folderPath}`
            );
            const results = await ipcRenderer.invoke(
                "widget:load-folder",
                folderPath
            );
            console.log(
                `[WidgetApi] ✓ Loaded ${results.length} widgets from folder`
            );
            return results;
        } catch (error) {
            console.error(
                `[WidgetApi] Error loading widgets from folder:`,
                error
            );
            throw error;
        }
    },

    /**
     * Uninstall a widget
     *
     * @param {string} widgetName - Name of the widget to uninstall
     * @returns {Promise<boolean>} True if successfully uninstalled, false otherwise
     *
     * @example
     * await mainApi.widgets.uninstall('Weather')
     */
    uninstall: async (widgetName) => {
        try {
            console.log(`[WidgetApi] Uninstalling widget: ${widgetName}`);
            const success = await ipcRenderer.invoke(
                "widget:uninstall",
                widgetName
            );
            if (success) {
                console.log(`[WidgetApi] ✓ Widget ${widgetName} uninstalled`);
            } else {
                console.warn(`[WidgetApi] Widget ${widgetName} not found`);
            }
            return success;
        } catch (error) {
            console.error(
                `[WidgetApi] Error uninstalling widget ${widgetName}:`,
                error
            );
            throw error;
        }
    },

    /**
     * Get the cache directory path where widgets are stored
     *
     * @returns {Promise<string>} Path to widgets cache directory
     */
    getCachePath: async () => {
        try {
            return await ipcRenderer.invoke("widget:cache-path");
        } catch (error) {
            console.error("[WidgetApi] Error getting cache path:", error);
            throw error;
        }
    },

    /**
     * Get the storage directory path (parent of widgets directory)
     *
     * @returns {Promise<string>} Path to storage directory
     */
    getStoragePath: async () => {
        try {
            return await ipcRenderer.invoke("widget:storage-path");
        } catch (error) {
            console.error("[WidgetApi] Error getting storage path:", error);
            throw error;
        }
    },

    /**
     * Set a custom storage path for widgets
     * Call this to move widget storage to a different location
     *
     * @param {string} customPath - Custom path for storing widgets
     * @returns {Promise<Object>} { success: boolean, path: string, error?: string }
     */
    setStoragePath: async (customPath) => {
        try {
            console.log(`[WidgetApi] Setting storage path to: ${customPath}`);
            const result = await ipcRenderer.invoke(
                "widget:set-storage-path",
                customPath
            );
            if (result.success) {
                console.log(
                    `[WidgetApi] ✓ Storage path changed to: ${customPath}`
                );
            }
            return result;
        } catch (error) {
            console.error("[WidgetApi] Error setting storage path:", error);
            throw error;
        }
    },

    /**
     * Get parsed .dash.js component configs for all installed widgets
     * Returns an array of { componentName, widgetPackage, config } objects
     *
     * @returns {Promise<Array>} Array of component configurations
     */
    getComponentConfigs: async () => {
        try {
            return await ipcRenderer.invoke("widget:get-component-configs");
        } catch (error) {
            console.error(
                "[WidgetApi] Error getting component configs:",
                error
            );
            return [];
        }
    },

    /**
     * Read the CJS bundle source for a single installed widget
     *
     * @param {string} widgetName - Name of the widget
     * @returns {Promise<Object>} { success, source, widgetName } or { success: false, error }
     */
    readBundle: async (widgetName) => {
        try {
            return await ipcRenderer.invoke("widget:read-bundle", widgetName);
        } catch (error) {
            console.error(
                `[WidgetApi] Error reading bundle for ${widgetName}:`,
                error
            );
            return { success: false, error: error.message };
        }
    },

    /**
     * Read CJS bundle sources for all installed widgets
     *
     * @returns {Promise<Array>} Array of { widgetName, source }
     */
    readAllBundles: async () => {
        try {
            return await ipcRenderer.invoke("widget:read-all-bundles");
        } catch (error) {
            console.error("[WidgetApi] Error reading all bundles:", error);
            return [];
        }
    },

    /**
     * Listen for widget installation events
     * Useful for updating UI when new widgets are installed
     *
     * @param {Function} callback - Function called when widget is installed
     *
     * @example
     * mainApi.widgets.onInstalled(({ widgetName, config }) => {
     *   console.log(`Widget ${widgetName} was installed!`);
     *   // Refresh widget list in UI
     * });
     */
    onInstalled: (callback) => {
        ipcRenderer.on("widget:installed", (event, data) => {
            callback(data);
        });
    },

    /**
     * Listen for batch widget loading events
     * Useful for updating UI when multiple widgets are loaded at once
     *
     * @param {Function} callback - Function called when widgets are loaded
     *
     * @example
     * mainApi.widgets.onLoaded(({ count, widgets }) => {
     *   console.log(`${count} widgets were loaded!`);
     *   // Refresh widget list in UI
     * });
     */
    onLoaded: (callback) => {
        ipcRenderer.on("widgets:loaded", (event, data) => {
            callback(data);
        });
    },

    /**
     * Remove listener for widget installation events
     *
     * @param {Function} callback - The callback to remove
     */
    removeInstalledListener: (callback) => {
        ipcRenderer.removeListener("widget:installed", callback);
    },

    /**
     * Remove listener for batch widget loading events
     *
     * @param {Function} callback - The callback to remove
     */
    removeLoadedListener: (callback) => {
        ipcRenderer.removeListener("widgets:loaded", callback);
    },
};

module.exports = widgetApi;
