/**
 * Widget Registry System
 *
 * Manages widget discovery, download, and dynamic loading
 * Widgets are expected to have:
 * - package.json (or dash.json) with metadata
 * - widgets/ folder containing [WidgetName].js and [WidgetName].dash.js
 *
 * Files are stored in the Electron app's userData directory:
 * - macOS: ~/Library/Application Support/[appName]/
 * - Windows: %APPDATA%/[appName]/
 * - Linux: ~/.config/[appName]/
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const AdmZip = require("adm-zip");
const { fileURLToPath } = require("url");
const { app, ipcMain, BrowserWindow } = require("electron");
const { dynamicWidgetLoader } = require("./dynamicWidgetLoader");
const { compileWidget, findWidgetsDir } = require("./widgetCompiler");

let WIDGETS_CACHE_DIR = null;
let REGISTRY_CONFIG_FILE = null;

/**
 * Validate ZIP entries to prevent path traversal attacks.
 * Rejects entries containing '..' segments or absolute paths that would
 * write outside the target extraction directory.
 * @param {AdmZip} zip - AdmZip instance
 * @param {string} targetDir - Intended extraction directory
 * @throws {Error} If any entry would escape the target directory
 */
function validateZipEntries(zip, targetDir) {
    const resolvedTarget = path.resolve(targetDir);
    for (const entry of zip.getEntries()) {
        const entryPath = entry.entryName;
        // Reject entries with '..' path segments
        if (
            entryPath.split("/").includes("..") ||
            entryPath.split("\\").includes("..")
        ) {
            throw new Error(
                `Malicious ZIP entry rejected (path traversal): ${entryPath}`
            );
        }
        // Reject absolute paths
        if (path.isAbsolute(entryPath)) {
            throw new Error(
                `Malicious ZIP entry rejected (absolute path): ${entryPath}`
            );
        }
        // Final check: resolved path must be within target directory
        const resolvedEntry = path.resolve(resolvedTarget, entryPath);
        if (
            !resolvedEntry.startsWith(resolvedTarget + path.sep) &&
            resolvedEntry !== resolvedTarget
        ) {
            throw new Error(
                `Malicious ZIP entry rejected (escapes target): ${entryPath}`
            );
        }
    }
}

/**
 * Initialize registry with custom path or default userData path
 * @param {string} customPath - Optional custom path for storing widgets
 */
function initializeRegistry(customPath = null) {
    if (customPath) {
        WIDGETS_CACHE_DIR = path.join(customPath, "widgets");
    } else {
        WIDGETS_CACHE_DIR = path.join(app.getPath("userData"), "widgets");
    }
    REGISTRY_CONFIG_FILE = path.join(WIDGETS_CACHE_DIR, "registry.json");
    console.log(`[WidgetRegistry] Using storage path: ${WIDGETS_CACHE_DIR}`);
}

class WidgetRegistry {
    constructor(componentManager = null, customPath = null) {
        if (!WIDGETS_CACHE_DIR) {
            initializeRegistry(customPath);
        }

        this.widgets = new Map();
        this.componentManager = componentManager;
        this.ensureCacheDir();
        this.loadRegistry();
    }

    /**
     * Static method to initialize registry with custom path
     * Call this early in your app startup (e.g., in main.js)
     * @param {string} customPath - Custom path for storing widgets/configs
     */
    static initialize(customPath = null) {
        initializeRegistry(customPath);
    }

    /**
     * Set ComponentManager instance for automatic widget registration
     * @param {Object} manager - ComponentManager instance from @trops/dash-react
     */
    setComponentManager(manager) {
        this.componentManager = manager;
    }

    /**
     * Ensure cache directory exists
     */
    ensureCacheDir() {
        if (!fs.existsSync(WIDGETS_CACHE_DIR)) {
            fs.mkdirSync(WIDGETS_CACHE_DIR, { recursive: true });
        }
    }

    /**
     * Load registry from disk
     */
    loadRegistry() {
        try {
            if (fs.existsSync(REGISTRY_CONFIG_FILE)) {
                const data = fs.readFileSync(REGISTRY_CONFIG_FILE, "utf8");
                const registryData = JSON.parse(data);
                this.widgets = new Map(registryData.widgets || []);
                console.log(
                    `[WidgetRegistry] Loaded ${this.widgets.size} widgets from cache`
                );
            }
        } catch (error) {
            console.error("[WidgetRegistry] Error loading registry:", error);
        }
    }

    /**
     * Save registry to disk
     */
    saveRegistry() {
        try {
            const registryData = {
                lastUpdated: new Date().toISOString(),
                widgets: Array.from(this.widgets.entries()),
            };
            fs.writeFileSync(
                REGISTRY_CONFIG_FILE,
                JSON.stringify(registryData, null, 2)
            );
        } catch (error) {
            console.error("[WidgetRegistry] Error saving registry:", error);
        }
    }

    /**
     * Resolve download URL from partial template or full URL
     * Supports placeholders: {version}, {name}
     *
     * Examples:
     * - Full URL: "https://github.com/user/widget/releases/download/v1.0.0/widget.zip"
     * - Template: "https://github.com/user/weather-widget/releases/download/v{version}/weather-widget.zip"
     * - Partial: "https://github.com/user/weather-widget/releases/download/" (auto-generates v{version}/{name}.zip)
     *
     * @param {string} urlTemplate - URL template or partial URL
     * @param {string} version - Widget version (e.g., "1.0.0")
     * @param {string} name - Widget name (e.g., "weather-widget")
     * @returns {string} Resolved download URL
     */
    resolveDownloadUrl(urlTemplate, version, name) {
        if (!urlTemplate) return null;

        if (urlTemplate.endsWith("/")) {
            return `${urlTemplate}v${version}/${name}.zip`;
        }

        let url = urlTemplate;
        url = url.replace("{version}", version);
        url = url.replace("{name}", name);
        return url;
    }

    /**
     * Determine if the input points to a local path (file:// or filesystem path)
     * @param {string} input - URL or path
     * @returns {boolean}
     */
    isLocalSource(input) {
        if (!input) return false;
        if (input.startsWith("file://")) return true;
        if (input.startsWith("http://") || input.startsWith("https://"))
            return false;
        const resolvedPath = this.resolveLocalPath(input);
        return fs.existsSync(resolvedPath);
    }

    /**
     * Normalize a local path (supports file:// and ~)
     * @param {string} input - Local path or file:// URL
     * @returns {string}
     */
    resolveLocalPath(input) {
        if (input.startsWith("file://")) {
            return fileURLToPath(input);
        }
        if (input.startsWith("~")) {
            return path.join(os.homedir(), input.slice(1));
        }
        return path.resolve(input);
    }

    /**
     * Install a widget from a local ZIP file or folder path
     * @param {string} widgetName - Name of the widget
     * @param {string} localPath - Path to ZIP file or widget folder
     * @param {boolean} autoRegister - Automatically register with ComponentManager
     * @param {string} dashConfigPath - Optional: path to dash.json metadata file
     * @returns {Promise<Object>} Widget configuration
     */
    async installFromLocalPath(
        widgetName,
        localPath,
        autoRegister = true,
        dashConfigPath = null
    ) {
        try {
            const resolvedPath = this.resolveLocalPath(localPath);

            if (!fs.existsSync(resolvedPath)) {
                throw new Error(`Local path not found: ${resolvedPath}`);
            }

            const widgetPath = path.join(WIDGETS_CACHE_DIR, widgetName);

            if (fs.existsSync(widgetPath)) {
                fs.rmSync(widgetPath, { recursive: true });
            }

            const isDirectory = fs.statSync(resolvedPath).isDirectory();
            if (isDirectory) {
                fs.cpSync(resolvedPath, widgetPath, { recursive: true });
            } else if (resolvedPath.endsWith(".zip")) {
                const zip = new AdmZip(resolvedPath);
                validateZipEntries(zip, widgetPath);
                zip.extractAllTo(widgetPath, true);
            } else {
                throw new Error(
                    `Unsupported local source type: ${resolvedPath}`
                );
            }

            let config = await this.loadWidgetConfig(widgetName, widgetPath);

            if (dashConfigPath) {
                const configPath = this.resolveLocalPath(dashConfigPath);
                if (fs.existsSync(configPath)) {
                    const dashConfig = JSON.parse(
                        fs.readFileSync(configPath, "utf8")
                    );
                    config = { ...config, ...dashConfig };
                }
            }

            this.registerWidget(widgetName, config, widgetPath, false);

            if (autoRegister) {
                await this.loadWidgetComponents(widgetName, widgetPath);
            }

            return config;
        } catch (error) {
            console.error(
                `[WidgetRegistry] Error installing local widget ${widgetName}:`,
                error
            );
            throw error;
        }
    }

    /**
     * Check if a directory looks like a valid widget folder.
     * A directory is a widget if it has:
     * - package.json or dash.json at its root, OR
     * - A widgets/ subdirectory containing at least one .dash.js file
     * @param {string} dirPath - Path to the directory
     * @returns {boolean}
     */
    isWidgetFolder(dirPath) {
        if (fs.existsSync(path.join(dirPath, "package.json"))) return true;
        if (fs.existsSync(path.join(dirPath, "dash.json"))) return true;

        const widgetsDir = path.join(dirPath, "widgets");
        if (
            fs.existsSync(widgetsDir) &&
            fs.statSync(widgetsDir).isDirectory()
        ) {
            const files = fs.readdirSync(widgetsDir);
            if (files.some((f) => f.endsWith(".dash.js"))) return true;
        }

        return false;
    }

    /**
     * Register all widgets found in a local folder.
     *
     * Smart detection:
     * 1. If the selected folder itself is a widget, install it directly.
     * 2. Otherwise iterate subdirectories, skipping non-widget dirs.
     *
     * @param {string} folderPath - Path containing widget folders (or a single widget folder)
     * @param {boolean} autoRegister - Automatically register with ComponentManager
     * @returns {Promise<Array>} Registered widgets (with optional `mode` and `skipped` metadata)
     */
    async registerWidgetsFromFolder(folderPath, autoRegister = true) {
        const SKIP_DIRS = new Set(["node_modules", "dist", "__MACOSX", ".git"]);

        try {
            const resolvedPath = this.resolveLocalPath(folderPath);
            if (!fs.existsSync(resolvedPath)) {
                throw new Error(`Folder not found: ${resolvedPath}`);
            }
            if (!fs.statSync(resolvedPath).isDirectory()) {
                throw new Error(`Path is not a directory: ${resolvedPath}`);
            }

            // 1. Check if the selected folder itself is a widget
            if (this.isWidgetFolder(resolvedPath)) {
                const widgetName = path.basename(resolvedPath);
                const config = await this.installFromLocalPath(
                    widgetName,
                    resolvedPath,
                    autoRegister
                );
                return [
                    {
                        name: widgetName,
                        path: resolvedPath,
                        ...config,
                        mode: "single",
                    },
                ];
            }

            // 2. Iterate subdirectories with filtering
            const entries = fs.readdirSync(resolvedPath, {
                withFileTypes: true,
            });
            const results = [];
            let skipped = 0;

            for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                // Skip hidden dirs and known non-widget dirs
                if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) {
                    skipped++;
                    continue;
                }

                const widgetPath = path.join(resolvedPath, entry.name);

                if (!this.isWidgetFolder(widgetPath)) {
                    skipped++;
                    continue;
                }

                const config = await this.loadWidgetConfig(
                    entry.name,
                    widgetPath
                );
                this.registerWidget(entry.name, config, widgetPath, false);

                if (autoRegister) {
                    await this.loadWidgetComponents(entry.name, widgetPath);
                }

                results.push({
                    name: entry.name,
                    path: widgetPath,
                    ...config,
                });
            }

            // Attach skipped count as metadata on the array
            results.skipped = skipped;
            return results;
        } catch (error) {
            console.error(
                "[WidgetRegistry] Error registering widgets from folder:",
                error
            );
            throw error;
        }
    }

    /**
     * Download widget from URL (ZIP file)
     * @param {string} widgetName - Name of the widget
     * @param {string} downloadUrl - URL to download ZIP file from (supports templates and partial URLs)
     * @param {string} dashConfigUrl - Optional: URL to dash.json metadata file
     * @param {boolean} autoRegister - Automatically register with ComponentManager
     * @returns {Promise<Object>} Widget configuration
     */
    async downloadWidget(
        widgetName,
        downloadUrl,
        dashConfigUrl = null,
        autoRegister = true
    ) {
        try {
            if (this.isLocalSource(downloadUrl)) {
                return this.installFromLocalPath(
                    widgetName,
                    downloadUrl,
                    autoRegister,
                    dashConfigUrl
                );
            }
            // Enforce HTTPS to prevent MITM attacks on widget downloads
            const parsedUrl = new URL(downloadUrl);
            if (parsedUrl.protocol !== "https:") {
                throw new Error(
                    `Widget downloads must use HTTPS. Refusing to fetch: ${downloadUrl}`
                );
            }

            console.log(
                `[WidgetRegistry] Downloading widget: ${widgetName} from ${downloadUrl}`
            );

            const response = await fetch(downloadUrl);
            if (!response.ok)
                throw new Error(`Failed to fetch: ${response.statusText}`);

            const buffer = await response.arrayBuffer();
            const zip = new AdmZip(Buffer.from(buffer));

            const widgetPath = path.join(WIDGETS_CACHE_DIR, widgetName);

            if (fs.existsSync(widgetPath)) {
                fs.rmSync(widgetPath, { recursive: true });
            }

            validateZipEntries(zip, widgetPath);
            zip.extractAllTo(widgetPath, true);
            console.log(`[WidgetRegistry] Extracted widget to: ${widgetPath}`);

            let config = await this.loadWidgetConfig(widgetName, widgetPath);

            if (dashConfigUrl) {
                const dashConfig = await this.fetchJSON(dashConfigUrl);
                config = { ...config, ...dashConfig };
            }

            this.registerWidget(widgetName, config, widgetPath, false);

            if (autoRegister) {
                await this.loadWidgetComponents(widgetName, widgetPath);
            }

            return config;
        } catch (error) {
            console.error(
                `[WidgetRegistry] Error downloading widget ${widgetName}:`,
                error
            );
            throw error;
        }
    }

    /**
     * Load widget configuration from local path
     * @param {string} widgetName - Name of the widget
     * @param {string} widgetPath - Path to widget directory
     * @returns {Promise<Object>} Widget configuration
     */
    async loadWidgetConfig(widgetName, widgetPath) {
        try {
            const dashJsonPath = path.join(widgetPath, "dash.json");
            if (fs.existsSync(dashJsonPath)) {
                const data = fs.readFileSync(dashJsonPath, "utf8");
                return JSON.parse(data);
            }

            const packageJsonPath = path.join(widgetPath, "package.json");
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(
                    fs.readFileSync(packageJsonPath, "utf8")
                );
                return {
                    name: packageJson.name || widgetName,
                    version: packageJson.version,
                    description: packageJson.description,
                    author: packageJson.author,
                    repository: packageJson.repository,
                };
            }

            return {
                name: widgetName,
                version: "1.0.0",
            };
        } catch (error) {
            console.error(
                `[WidgetRegistry] Error loading config for ${widgetName}:`,
                error
            );
            return { name: widgetName };
        }
    }

    /**
     * Register a widget in the registry
     * @param {string} widgetName - Name of the widget
     * @param {Object} config - Widget configuration
     * @param {string} widgetPath - Path to widget directory
     * @param {boolean} autoRegister - Automatically register with ComponentManager
     */
    registerWidget(widgetName, config, widgetPath, autoRegister = true) {
        const widgetEntry = {
            name: widgetName,
            path: widgetPath,
            ...config,
            registeredAt: new Date().toISOString(),
        };

        this.widgets.set(widgetName, widgetEntry);
        this.saveRegistry();
        console.log(`[WidgetRegistry] Registered widget: ${widgetName}`);
    }

    /**
     * Load all components for a widget and register them with ComponentManager
     * @param {string} widgetName - Name of the widget
     * @param {string} widgetPath - Path to widget directory
     */
    async loadWidgetComponents(widgetName, widgetPath) {
        try {
            // Auto-compile widget source to CJS bundle if none exists
            if (!findBundlePath(widgetPath)) {
                try {
                    await compileWidget(widgetPath);
                    console.log(`[WidgetRegistry] Auto-compiled ${widgetName}`);
                } catch (compileError) {
                    console.warn(
                        `[WidgetRegistry] Could not compile ${widgetName}:`,
                        compileError
                    );
                }
            }

            if (this.componentManager) {
                dynamicWidgetLoader.setComponentManager(this.componentManager);
            }

            const components = dynamicWidgetLoader.discoverWidgets(widgetPath);
            console.log(
                `[WidgetRegistry] Found ${components.length} components in ${widgetName}`
            );

            const existingEntry = this.widgets.get(widgetName);
            let registryUpdated = false;

            // Store component names as displayName on the registry entry
            // so settings UI shows "WeatherWidget" instead of "weather-widget"
            if (components.length > 0 && existingEntry) {
                existingEntry.displayName = components.join(", ");
                existingEntry.componentNames = components;
                registryUpdated = true;
            }

            for (const componentName of components) {
                try {
                    const result = await dynamicWidgetLoader.loadWidget(
                        widgetName,
                        widgetPath,
                        componentName,
                        true
                    );
                    console.log(`[WidgetRegistry] ✓ Loaded ${componentName}`);

                    // Enrich registry entry with .dash.js config fields
                    // (icon, providers, workspace, etc.) so the settings UI
                    // has full display data without needing ComponentManager.
                    if (result?.config && existingEntry) {
                        const cfg = result.config;
                        if (cfg.icon && !existingEntry.icon)
                            existingEntry.icon = cfg.icon;
                        if (
                            cfg.providers?.length &&
                            !existingEntry.providers?.length
                        )
                            existingEntry.providers = cfg.providers;
                        if (cfg.workspace && !existingEntry.workspace)
                            existingEntry.workspace = cfg.workspace;
                        if (cfg.events?.length && !existingEntry.events?.length)
                            existingEntry.events = cfg.events;
                        if (
                            cfg.eventHandlers?.length &&
                            !existingEntry.eventHandlers?.length
                        )
                            existingEntry.eventHandlers = cfg.eventHandlers;
                        registryUpdated = true;
                    }
                } catch (error) {
                    console.error(
                        `[WidgetRegistry] Error loading component ${componentName}:`,
                        error
                    );
                }
            }

            if (registryUpdated && existingEntry) {
                this.widgets.set(widgetName, existingEntry);
                this.saveRegistry();
            }
        } catch (error) {
            console.error(
                "[WidgetRegistry] Error loading widget components:",
                error
            );
        }
    }

    /**
     * Get all registered widgets
     * @returns {Array} List of widget configurations
     */
    getWidgets() {
        return Array.from(this.widgets.values());
    }

    /**
     * Get widget by name
     * @param {string} widgetName - Name of the widget
     * @returns {Object|null} Widget configuration or null
     */
    getWidget(widgetName) {
        return this.widgets.get(widgetName) || null;
    }

    /**
     * Uninstall a widget
     * @param {string} widgetName - Name of the widget to remove
     */
    uninstallWidget(widgetName) {
        const widget = this.widgets.get(widgetName);
        if (!widget) {
            console.warn(`[WidgetRegistry] Widget not found: ${widgetName}`);
            return false;
        }

        try {
            if (fs.existsSync(widget.path)) {
                fs.rmSync(widget.path, { recursive: true });
            }
            this.widgets.delete(widgetName);
            this.saveRegistry();
            console.log(`[WidgetRegistry] Uninstalled widget: ${widgetName}`);
            return true;
        } catch (error) {
            console.error(
                `[WidgetRegistry] Error uninstalling ${widgetName}:`,
                error
            );
            return false;
        }
    }

    /**
     * Helper: Fetch JSON from URL
     */
    async fetchJSON(url) {
        const response = await fetch(url);
        if (!response.ok)
            throw new Error(`Failed to fetch: ${response.statusText}`);
        return response.json();
    }

    /**
     * Get cache directory path
     */
    getCachePath() {
        return WIDGETS_CACHE_DIR;
    }

    /**
     * Get the storage directory (parent of widgets directory)
     * @returns {string} Full path to storage directory
     */
    getStoragePath() {
        return path.dirname(WIDGETS_CACHE_DIR);
    }
}

// Lazy initialization to avoid accessing app.getPath before app is ready
let widgetRegistry = null;

function getWidgetRegistry() {
    if (!widgetRegistry) {
        widgetRegistry = new WidgetRegistry();
    }
    return widgetRegistry;
}

/**
 * Look for a CJS bundle file in a widget directory.
 * Checks multiple candidate paths in priority order because
 * packageZip.js may extract dist/ contents to the widget root.
 *
 * @param {string} widgetPath - Path to the widget directory
 * @returns {string|null} Absolute path to the bundle, or null if not found
 */
function findBundlePath(widgetPath) {
    const candidates = [
        path.join(widgetPath, "dist", "index.cjs.js"),
        path.join(widgetPath, "index.cjs.js"),
        path.join(widgetPath, "dist", "index.js"),
        path.join(widgetPath, "index.js"),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return null;
}

/**
 * Setup IPC handlers for widget management (use in main.js)
 */
function setupWidgetRegistryHandlers() {
    ipcMain.handle("widget:list", () => getWidgetRegistry().getWidgets());

    ipcMain.handle("widget:get", (event, widgetName) => {
        return getWidgetRegistry().getWidget(widgetName);
    });

    ipcMain.handle(
        "widget:install",
        async (event, widgetName, downloadUrl, dashConfigUrl) => {
            const config = await getWidgetRegistry().downloadWidget(
                widgetName,
                downloadUrl,
                dashConfigUrl
            );

            BrowserWindow.getAllWindows().forEach((win) => {
                win.webContents.send("widget:installed", {
                    widgetName,
                    config,
                });
            });

            return config;
        }
    );

    ipcMain.handle(
        "widget:install-local",
        async (event, widgetName, localPath, dashConfigPath) => {
            const config = await getWidgetRegistry().installFromLocalPath(
                widgetName,
                localPath,
                true,
                dashConfigPath
            );

            BrowserWindow.getAllWindows().forEach((win) => {
                win.webContents.send("widget:installed", {
                    widgetName,
                    config,
                });
            });

            return config;
        }
    );

    ipcMain.handle("widget:load-folder", async (event, folderPath) => {
        const results = await getWidgetRegistry().registerWidgetsFromFolder(
            folderPath,
            true
        );

        BrowserWindow.getAllWindows().forEach((win) => {
            win.webContents.send("widgets:loaded", {
                count: results.length,
                widgets: results,
            });
        });

        return results;
    });

    ipcMain.handle("widget:uninstall", (event, widgetName) => {
        return getWidgetRegistry().uninstallWidget(widgetName);
    });

    ipcMain.handle("widget:cache-path", () =>
        getWidgetRegistry().getCachePath()
    );

    ipcMain.handle("widget:storage-path", () =>
        getWidgetRegistry().getStoragePath()
    );

    ipcMain.handle("widget:get-component-configs", async () => {
        try {
            const registry = getWidgetRegistry();
            const installedWidgets = registry.getWidgets();
            const configs = [];

            for (const widget of installedWidgets) {
                const widgetPath = widget.path;
                if (!widgetPath || !fs.existsSync(widgetPath)) continue;

                const componentNames =
                    dynamicWidgetLoader.discoverWidgets(widgetPath);
                const widgetsDir = findWidgetsDir(widgetPath);
                for (const componentName of componentNames) {
                    try {
                        const configPath = path.join(
                            widgetsDir || path.join(widgetPath, "widgets"),
                            `${componentName}.dash.js`
                        );
                        const config = await dynamicWidgetLoader.loadConfigFile(
                            configPath
                        );
                        configs.push({
                            componentName,
                            widgetPackage: widget.name,
                            config,
                        });
                    } catch (err) {
                        console.error(
                            `[WidgetRegistry] Error loading config for ${componentName}:`,
                            err
                        );
                    }
                }
            }

            return configs;
        } catch (error) {
            console.error(
                "[WidgetRegistry] Error getting component configs:",
                error
            );
            return [];
        }
    });

    ipcMain.handle("widget:read-bundle", async (event, widgetName) => {
        try {
            const registry = getWidgetRegistry();
            const widget = registry.getWidget(widgetName);
            if (!widget || !widget.path) {
                return {
                    success: false,
                    error: `Widget not found: ${widgetName}`,
                };
            }

            let bundlePath = findBundlePath(widget.path);

            // Auto-compile if no bundle exists (same as read-all-bundles)
            if (!bundlePath) {
                try {
                    const compiled = await compileWidget(widget.path);
                    if (compiled) {
                        bundlePath = compiled;
                    }
                } catch (compileError) {
                    console.warn(
                        `[WidgetRegistry] Could not compile ${widgetName}:`,
                        compileError
                    );
                }
            }

            if (!bundlePath) {
                return {
                    success: false,
                    error: `No bundle found in: ${widget.path}`,
                };
            }

            const source = fs.readFileSync(bundlePath, "utf8");
            return { success: true, source, widgetName };
        } catch (error) {
            console.error(
                `[WidgetRegistry] Error reading bundle for ${widgetName}:`,
                error
            );
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle("widget:read-all-bundles", async () => {
        try {
            const registry = getWidgetRegistry();
            const installedWidgets = registry.getWidgets();
            const results = [];

            for (const widget of installedWidgets) {
                const widgetPath = widget.path;
                if (!widgetPath || !fs.existsSync(widgetPath)) continue;

                let bundlePath = findBundlePath(widgetPath);

                // Auto-compile if no bundle exists
                if (!bundlePath) {
                    try {
                        const compiled = await compileWidget(widgetPath);
                        if (compiled) {
                            bundlePath = compiled;
                        }
                    } catch (compileError) {
                        console.warn(
                            `[WidgetRegistry] Could not compile ${widget.name}:`,
                            compileError
                        );
                    }
                }

                if (!bundlePath) {
                    console.log(
                        `[WidgetRegistry] No CJS bundle for ${widget.name}, skipping (will use config fallback)`
                    );
                    continue;
                }

                try {
                    const source = fs.readFileSync(bundlePath, "utf8");
                    results.push({
                        widgetName: widget.name,
                        source,
                    });
                } catch (readError) {
                    console.error(
                        `[WidgetRegistry] Error reading bundle for ${widget.name}:`,
                        readError
                    );
                }
            }

            return results;
        } catch (error) {
            console.error("[WidgetRegistry] Error reading all bundles:", error);
            return [];
        }
    });

    ipcMain.handle("widget:set-storage-path", (event, customPath) => {
        try {
            WidgetRegistry.initialize(customPath);
            console.log(
                `[WidgetRegistry] Storage path changed to: ${customPath}`
            );
            return { success: true, path: customPath };
        } catch (error) {
            console.error(
                "[WidgetRegistry] Error setting storage path:",
                error
            );
            return { success: false, error: error.message };
        }
    });
}

module.exports = WidgetRegistry;
module.exports.getWidgetRegistry = getWidgetRegistry;
// For backward compatibility, provide widgetRegistry as a getter
Object.defineProperty(module.exports, "widgetRegistry", {
    get: getWidgetRegistry,
});
module.exports.setupWidgetRegistryHandlers = setupWidgetRegistryHandlers;
