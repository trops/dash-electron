/**
 * electron.js
 *
 * The main brain!
 *
 * This is where we will place all of the listeners. This is very important.
 */

// Suppress EPIPE errors on stdout/stderr (common when running under concurrently)
process.stdout?.on?.("error", (err) => {
    if (err.code === "EPIPE") return;
    throw err;
});
process.stderr?.on?.("error", (err) => {
    if (err.code === "EPIPE") return;
    throw err;
});

// Load .env before any dash-core imports so controllers can read env vars
try {
    require("dotenv").config({
        path: require("path").join(__dirname, "..", ".env"),
    });
} catch (e) {
    // dotenv may not be available in packaged builds — that's fine
}

const path = require("path");
const { pathToFileURL } = require("url");
const {
    app,
    BrowserWindow,
    ipcMain,
    dialog,
    Menu,
    autoUpdater,
} = require("electron");

// Handle Squirrel install/uninstall/update events on Windows
if (require("electron-squirrel-startup")) app.quit();

// Use process.defaultApp or NODE_ENV check which are available before app is ready
const isDev = process.defaultApp || process.env.NODE_ENV === "development";
const pe = require("pluggable-electron/main");
const logger = require("./logger");

const { updateElectronApp } = require("update-electron-app");

// Auto-update: checks update.electronjs.org every 10 minutes
// Only runs in production (packaged app), no-ops in development
let updaterReady = false;
if (!isDev) {
    updateElectronApp({
        repo: "trops/dash-electron",
        updateInterval: "10 minutes",
        notifyUser: false,
        logger: {
            log: (...args) => logger.info("[auto-update]", ...args),
            warn: (...args) => logger.warn("[auto-update]", ...args),
            error: (...args) => logger.error("[auto-update]", ...args),
            info: (...args) => logger.info("[auto-update]", ...args),
        },
    });
    updaterReady = true;
    logger.info(
        `[auto-update] Initialized — repo: trops/dash-electron, feed: https://update.electronjs.org/trops/dash-electron/${
            process.platform
        }-${process.arch}/${app.getVersion()}`
    );
}

// --- Update state tracking ---
let updateState = "idle"; // idle | checking | downloaded
let manualCheckInProgress = false;

// --- macOS Application Menu ---
function buildMenu() {
    const appName = app.name || "Dash";

    // Dynamic update menu item based on state
    let updateMenuItem;
    if (updateState === "downloaded") {
        updateMenuItem = {
            label: "Restart to Update",
            click: () => autoUpdater.quitAndInstall(),
        };
    } else if (updateState === "checking") {
        updateMenuItem = {
            label: "Checking for Updates...",
            enabled: false,
        };
    } else {
        updateMenuItem = {
            label: updaterReady
                ? "Check for Updates..."
                : "Check for Updates (unavailable)",
            enabled: updaterReady,
            ...(updaterReady && {
                click: () => {
                    manualCheckInProgress = true;
                    updateState = "checking";
                    buildMenu();
                    // Safety timeout: reset stale checking state after 30s
                    if (manualCheckTimeout) clearTimeout(manualCheckTimeout);
                    manualCheckTimeout = setTimeout(() => {
                        if (manualCheckInProgress) {
                            logger.warn(
                                "[AutoUpdater] Manual check timed out after 30s"
                            );
                            resetManualCheck();
                            updateState = "idle";
                            buildMenu();
                        }
                    }, 30000);
                    autoUpdater.checkForUpdates();
                },
            }),
        };
    }

    const template = [
        {
            label: appName,
            submenu: [
                { role: "about" },
                { type: "separator" },
                updateMenuItem,
                { type: "separator" },
                { role: "hide" },
                { role: "hideOthers" },
                { role: "unhide" },
                { type: "separator" },
                { role: "quit" },
            ],
        },
        {
            label: "Edit",
            submenu: [
                { role: "undo" },
                { role: "redo" },
                { type: "separator" },
                { role: "cut" },
                { role: "copy" },
                { role: "paste" },
                { role: "selectAll" },
            ],
        },
        {
            label: "View",
            submenu: [
                { role: "reload" },
                { role: "forceReload" },
                { role: "toggleDevTools" },
                { type: "separator" },
                { role: "resetZoom" },
                { role: "zoomIn" },
                { role: "zoomOut" },
                { type: "separator" },
                { role: "togglefullscreen" },
                { type: "separator" },
                {
                    label: "Do Not Disturb",
                    type: "checkbox",
                    checked: notificationController
                        ? notificationController.getPreferences().doNotDisturb
                        : false,
                    click: (menuItem) => {
                        if (notificationController) {
                            notificationController.setGlobal({
                                doNotDisturb: menuItem.checked,
                            });
                            if (mainWindow && !mainWindow.isDestroyed()) {
                                mainWindow.webContents.send(
                                    "notification:dnd-changed",
                                    menuItem.checked
                                );
                            }
                        }
                    },
                },
            ],
        },
        {
            label: "Window",
            submenu: [
                { role: "minimize" },
                { role: "zoom" },
                { type: "separator" },
                { role: "front" },
            ],
        },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// --- autoUpdater event listeners (work alongside update-electron-app) ---
let manualCheckTimeout = null;

function resetManualCheck() {
    manualCheckInProgress = false;
    if (manualCheckTimeout) {
        clearTimeout(manualCheckTimeout);
        manualCheckTimeout = null;
    }
}

if (!isDev) {
    autoUpdater.on("checking-for-update", () => {
        logger.info("[AutoUpdater] Checking for updates...");
        updateState = "checking";
        buildMenu();
    });

    autoUpdater.on("update-available", (_event) => {
        logger.info("[AutoUpdater] Update available");
        updateState = "checking"; // stays checking until downloaded
        buildMenu();
        if (manualCheckInProgress) {
            dialog.showMessageBox({
                title: "Update Available",
                message: "A new version is being downloaded.",
                detail: "The update will be applied when the download finishes.",
                buttons: ["OK"],
            });
        }
    });

    autoUpdater.on("update-not-available", () => {
        logger.info(
            `[AutoUpdater] No update available — current version: ${app.getVersion()}`
        );
        updateState = "idle";
        buildMenu();
        const wasManual = manualCheckInProgress;
        resetManualCheck();
        if (wasManual) {
            dialog.showMessageBox({
                title: "No Updates",
                message: "You're up to date!",
                detail: `${
                    app.name
                } ${app.getVersion()} is the latest version.`,
                buttons: ["OK"],
            });
        }
    });

    autoUpdater.on("update-downloaded", (_event, releaseNotes, releaseName) => {
        logger.info(
            `[AutoUpdater] Update downloaded — release: ${
                releaseName || "unknown"
            }`
        );
        updateState = "downloaded";
        buildMenu();
        resetManualCheck();
        dialog
            .showMessageBox({
                title: "Update Ready",
                message: "A new version has been downloaded.",
                detail: `${
                    releaseName || "A new version"
                } is ready to install. Restart ${
                    app.name
                } to apply the update.`,
                buttons: ["Restart Now", "Later"],
                defaultId: 0,
                cancelId: 1,
            })
            .then(({ response }) => {
                if (response === 0) {
                    autoUpdater.quitAndInstall();
                }
            });
    });

    autoUpdater.on("error", (err) => {
        logger.error(
            `[AutoUpdater] Error: ${err?.message || "unknown error"}`,
            err?.stack
        );
        updateState = "idle";
        buildMenu();
        const wasManual = manualCheckInProgress;
        resetManualCheck();
        if (wasManual) {
            dialog.showMessageBox({
                title: "Update Error",
                message: "Could not check for updates.",
                detail: err?.message || "An unknown error occurred.",
                buttons: ["OK"],
            });
        }
    });
}

// Core controllers and events from dash-core
const dashCore = require("@trops/dash-core/electron");

const {
    // Controller functions (core)
    showDialog,
    fileChosenError,
    isEncryptionAvailable,
    listWorkspacesForApplication,
    saveWorkspaceForApplication,
    deleteWorkspaceForApplication,
    listThemesForApplication,
    saveThemeForApplication,
    deleteThemeForApplication,
    convertJsonToCsvFile,
    saveToFile,
    readFromFile,
    saveSettingsForApplication,
    getSettingsForApplication,
    getDataDirectory,
    setDataDirectory,
    migrateDataDirectory,
    parseXMLStream,
    parseCSVStream,
    readLinesFromFile,
    transformFile,
    readJSONFromFile,
    readDataFromURL,
    extractColorsFromImageURL,
    saveProvider,
    listProviders,
    getProvider,
    deleteProvider,
    // Dashboard config
    exportDashboardConfig,
    selectDashboardFile,
    importDashboardConfig,
    installDashboardFromRegistry,
    checkCompatibility,
    prepareDashboardForPublish,
    getDashboardPreview,
    checkDashboardUpdatesForApp,
    getProviderSetupManifest,
    getDashboardPublishPreview,
    // Dashboard ratings
    saveDashboardRating,
    getDashboardRating,
    listDashboardRatings,
    deleteDashboardRating,
    // Registry auth
    initiateDeviceFlow,
    pollForToken,
    getRegistryAuthStatus,
    getRegistryProfile,
    updateRegistryProfile,
    getRegistryPackages,
    updateRegistryPackage,
    deleteRegistryPackage,
    clearRegistryToken,
    publishToRegistry,
    // Session
    getRecentDashboards,
    addRecentDashboard,
    removeRecentDashboard,
    clearRecentDashboards,
    getSessionState,
    saveSessionState,
    clearSessionState,
    // Template controllers (now in dash-core)
    listIndices,
    partialUpdateObjectsFromDirectory,
    createBatchesFromFile,
    browseObjectsToFile,
    searchIndex,
    describeImage,
    saveMenuItemForApplication,
    listMenuItemsForApplication,
    pluginInstall,
    // Theme registry
    prepareThemeForPublish,
    installThemeFromRegistry,
    getThemePublishPreview,
    // Namespaced controllers
    mcpController,
    llmController,
    cliController,
    registryController,
    themeRegistryController,
    notificationController,
    schedulerController,
    webSocketController,
    // Theme from URL
    themeFromUrlController,
    paletteToThemeMapper,
    extractionCacheController,
    themeFromUrlErrors,
    // MCP Dash Server (hosted server for external LLM clients)
    mcpDashServerController,
    // Utils
    clientCache,
    responseCache,
    // Events
    events: coreEvents,
    // Widget system
    widgetRegistry,
    // Setup helpers
    setupCacheHandlers,
} = dashCore;

// Event constants (all from dash-core)
const {
    SECURE_STORE_ENCRYPTION_CHECK,
    WORKSPACE_LIST,
    WORKSPACE_SAVE,
    WORKSPACE_DELETE,
    LAYOUT_LIST,
    THEME_SAVE,
    THEME_DELETE,
    DATA_JSON_TO_CSV_FILE,
    DATA_JSON_TO_CSV_STRING,
    DATA_SAVE_TO_FILE,
    DATA_READ_FROM_FILE,
    SETTINGS_GET,
    SETTINGS_SAVE,
    SETTINGS_GET_DATA_DIR,
    SETTINGS_SET_DATA_DIR,
    SETTINGS_MIGRATE_DATA_DIR,
    CHOOSE_FILE,
    CHOOSE_FILE_ERROR,
    CHOOSE_FILE_COMPLETE,
    PARSE_XML_STREAM,
    PARSE_CSV_STREAM,
    READ_LINES,
    TRANSFORM_FILE,
    READ_JSON,
    READ_DATA_URL,
    EXTRACT_COLORS_FROM_IMAGE,
    PROVIDER_SAVE,
    PROVIDER_LIST,
    PROVIDER_GET,
    PROVIDER_DELETE,
    MCP_START_SERVER,
    MCP_STOP_SERVER,
    MCP_LIST_TOOLS,
    MCP_CALL_TOOL,
    MCP_LIST_RESOURCES,
    MCP_READ_RESOURCE,
    MCP_SERVER_STATUS,
    MCP_GET_CATALOG,
    MCP_RUN_AUTH,
    REGISTRY_FETCH_INDEX,
    REGISTRY_SEARCH,
    REGISTRY_GET_PACKAGE,
    REGISTRY_CHECK_UPDATES,
    REGISTRY_SEARCH_DASHBOARDS,
    REGISTRY_SEARCH_THEMES,
    THEME_PUBLISH,
    THEME_INSTALL_FROM_REGISTRY,
    THEME_PUBLISH_PREVIEW,
    ALGOLIA_LIST_INDICES,
    ALGOLIA_PARTIAL_UPDATE_OBJECTS,
    ALGOLIA_CREATE_BATCH,
    ALGOLIA_BROWSE_OBJECTS,
    ALGOLIA_SEARCH,
    ALGOLIA_ANALYTICS_FOR_QUERY,
    OPENAI_DESCRIBE_IMAGE,
    LLM_SEND_MESSAGE,
    LLM_ABORT_REQUEST,
    LLM_LIST_CONNECTED_TOOLS,
    LLM_CHECK_CLI_AVAILABLE,
    LLM_CLEAR_CLI_SESSION,
    LLM_CLI_SESSION_STATUS,
    LLM_CLI_END_SESSION,
    MENU_ITEMS_LIST,
    MENU_ITEMS_SAVE,
    DASHBOARD_CONFIG_EXPORT,
    DASHBOARD_CONFIG_IMPORT,
    DASHBOARD_CONFIG_SELECT_FILE,
    DASHBOARD_CONFIG_INSTALL,
    DASHBOARD_CONFIG_COMPATIBILITY,
    DASHBOARD_CONFIG_PUBLISH,
    DASHBOARD_CONFIG_PREVIEW,
    DASHBOARD_CONFIG_CHECK_UPDATES,
    DASHBOARD_CONFIG_PROVIDER_SETUP,
    DASHBOARD_CONFIG_PUBLISH_PREVIEW,
    DASHBOARD_RATING_SAVE,
    DASHBOARD_RATING_GET,
    DASHBOARD_RATING_LIST,
    DASHBOARD_RATING_DELETE,
    REGISTRY_AUTH_INITIATE_LOGIN,
    REGISTRY_AUTH_POLL_TOKEN,
    REGISTRY_AUTH_GET_STATUS,
    REGISTRY_AUTH_GET_PROFILE,
    REGISTRY_AUTH_LOGOUT,
    REGISTRY_AUTH_PUBLISH,
    REGISTRY_AUTH_UPDATE_PROFILE,
    REGISTRY_AUTH_GET_PACKAGES,
    REGISTRY_AUTH_UPDATE_PACKAGE,
    REGISTRY_AUTH_DELETE_PACKAGE,
    SESSION_GET_RECENTS,
    SESSION_ADD_RECENT,
    SESSION_REMOVE_RECENT,
    SESSION_CLEAR_RECENTS,
    SESSION_GET_STATE,
    SESSION_SAVE_STATE,
    SESSION_CLEAR_STATE,
    NOTIFICATION_SEND,
    NOTIFICATION_GET_PREFERENCES,
    NOTIFICATION_SET_PREFERENCES,
    NOTIFICATION_SET_GLOBAL,
    SCHEDULER_REGISTER_TASK,
    SCHEDULER_REMOVE_TASK,
    SCHEDULER_REMOVE_TASKS,
    SCHEDULER_GET_TASKS,
    SCHEDULER_UPDATE_TASK,
    SCHEDULER_ENABLE_TASK,
    SCHEDULER_DISABLE_TASK,
    SCHEDULER_GET_PENDING,
    WS_CONNECT,
    WS_DISCONNECT,
    WS_SEND,
    WS_STATUS,
    WS_GET_ALL,
    THEME_EXTRACT_FROM_URL,
    THEME_MAP_PALETTE_TO_THEME,
    MCP_DASH_SERVER_START,
    MCP_DASH_SERVER_STOP,
    MCP_DASH_SERVER_STATUS,
    MCP_DASH_SERVER_GET_TOKEN,
} = coreEvents;

// Widget System
const { setupWidgetRegistryHandlers } = widgetRegistry;

/**
 * Create the main window of the application
 */

let windows = new Set();
let mainWindow = null;
let popoutWindows = new Map(); // workspaceId string → BrowserWindow
let widgetPopoutWindows = new Map(); // "workspaceId:widgetId" → BrowserWindow
let debugWindow = null; // Debug Console BrowserWindow

/**
 * Get the BrowserWindow that sent an IPC event.
 * Falls back to mainWindow if the sender can't be resolved.
 */
function getSenderWindow(e) {
    return BrowserWindow.fromWebContents(e.sender) || mainWindow;
}

// Track whether IPC handlers have been registered (they must only be registered once)
let ipcHandlersRegistered = false;

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        icon: path.join(__dirname, "..", "assets", "icons", "icon-256.png"),
        width: 1920,
        height: 1080,
        minWidth: 1024,
        minHeight: 768,
        fullscreen: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: true,
        },
    });

    mainWindow.loadURL(
        isDev
            ? "http://localhost:3000"
            : pathToFileURL(path.join(__dirname, "../build/index.html")).href
    );

    if (isDev && process.env.DASH_DEVTOOLS === "true") {
        mainWindow.webContents.once("dom-ready", () => {
            mainWindow.webContents.openDevTools({ mode: "detach" });
        });
    }

    // Only register ipcMain.handle() once — they persist across window recreation
    if (!ipcHandlersRegistered) {
        ipcHandlersRegistered = true;

        // --- Dialog ---
        logger.loggedHandle(CHOOSE_FILE, async (e, message) => {
            return showDialog(
                getSenderWindow(e),
                message,
                message.allowFile,
                message.extensions
            );
        });
        logger.loggedHandle(CHOOSE_FILE_COMPLETE, (e, message) => {
            console.log("choose file complete ", e, message);
        });
        logger.loggedHandle(CHOOSE_FILE_ERROR, (e, message) =>
            fileChosenError(getSenderWindow(e), message)
        );

        // --- Secure Storage ---
        logger.loggedHandle(SECURE_STORE_ENCRYPTION_CHECK, (e, message) =>
            isEncryptionAvailable(getSenderWindow(e), message)
        );

        // --- Algolia (template-specific) ---
        // All handlers accept { providerHash, dashboardAppId, providerName }
        // and resolve credentials on the main process side.
        logger.loggedHandle(
            ALGOLIA_LIST_INDICES,
            responseCache.cachedHandler(
                "algolia-list-indices",
                async (e, { providerHash, dashboardAppId, providerName }) => {
                    try {
                        const client = await clientCache.getClient(
                            providerHash,
                            dashboardAppId,
                            providerName
                        );
                        const { items } = await client.listIndices();
                        const filtered = items.filter(
                            (item) => item.name.substring(0, 7) !== "sitehub"
                        );
                        const senderWin = getSenderWindow(e);
                        senderWin?.webContents?.send(
                            "algolia-list-indices-complete",
                            filtered
                        );
                        return filtered;
                    } catch (err) {
                        const senderWin = getSenderWindow(e);
                        senderWin?.webContents?.send(
                            "algolia-list-indices-error",
                            { error: err.message }
                        );
                        throw err;
                    }
                }
            )
        );
        logger.loggedHandle(
            ALGOLIA_PARTIAL_UPDATE_OBJECTS,
            async (
                e,
                {
                    dashboardAppId,
                    providerName,
                    indexName,
                    dir,
                    createIfNotExists,
                }
            ) => {
                const result = getProvider(null, dashboardAppId, providerName);
                if (result.error) throw new Error(result.message);
                const { appId, apiKey, key } = result.provider.credentials;
                partialUpdateObjectsFromDirectory(
                    getSenderWindow(e),
                    appId,
                    apiKey || key,
                    indexName,
                    dir,
                    createIfNotExists
                );
            }
        );
        logger.loggedHandle(ALGOLIA_CREATE_BATCH, (e, message) => {
            const { filepath, batchFilepath, batchSize } = message;
            createBatchesFromFile(
                getSenderWindow(e),
                filepath,
                batchFilepath,
                batchSize
            );
        });
        logger.loggedHandle(
            ALGOLIA_BROWSE_OBJECTS,
            async (
                e,
                { dashboardAppId, providerName, indexName, toFilename, query }
            ) => {
                const result = getProvider(null, dashboardAppId, providerName);
                if (result.error) throw new Error(result.message);
                const { appId, apiKey, key } = result.provider.credentials;
                browseObjectsToFile(
                    getSenderWindow(e),
                    appId,
                    apiKey || key,
                    indexName,
                    toFilename,
                    query
                );
            }
        );
        logger.loggedHandle(
            ALGOLIA_SEARCH,
            async (
                e,
                { dashboardAppId, providerName, indexName, query, options }
            ) => {
                const result = getProvider(null, dashboardAppId, providerName);
                if (result.error) throw new Error(result.message);
                const { appId, apiKey, key } = result.provider.credentials;
                return searchIndex(
                    getSenderWindow(e),
                    appId,
                    apiKey || key,
                    indexName,
                    query,
                    options
                );
            }
        );

        // --- Algolia Settings (use clientCache for cached client) ---
        logger.loggedHandle(
            "algolia-get-settings",
            responseCache.cachedHandler(
                "algolia-get-settings",
                async (
                    e,
                    { providerHash, dashboardAppId, providerName, indexName }
                ) => {
                    const client = await clientCache.getClient(
                        providerHash,
                        dashboardAppId,
                        providerName
                    );
                    const index = client.initIndex(indexName);
                    return await index.getSettings();
                }
            )
        );

        logger.loggedHandle(
            "algolia-set-settings",
            async (
                e,
                {
                    providerHash,
                    dashboardAppId,
                    providerName,
                    indexName,
                    settings,
                }
            ) => {
                const client = await clientCache.getClient(
                    providerHash,
                    dashboardAppId,
                    providerName
                );
                const index = client.initIndex(indexName);
                const result = await index.setSettings(settings);
                responseCache.invalidatePrefix("algolia-get-settings:");
                return result;
            }
        );

        logger.loggedHandle(
            ALGOLIA_ANALYTICS_FOR_QUERY,
            responseCache.cachedHandler(
                "algolia-analytics",
                async (
                    e,
                    { dashboardAppId, providerName, indexName, query }
                ) => {
                    try {
                        const result = getProvider(
                            null,
                            dashboardAppId,
                            providerName
                        );
                        if (result.error) throw new Error(result.message);
                        const { appId, apiKey, key } =
                            result.provider.credentials;
                        const resolvedApiKey = apiKey || key;
                        const endpoint =
                            typeof query === "string" ? query : query.endpoint;
                        const { endpoint: _, ...params } =
                            typeof query === "object" ? query : {};

                        console.log(
                            `[Algolia Analytics] ${endpoint} for index "${indexName}"`
                        );

                        const url = new URL(
                            `https://analytics.algolia.com/2/${endpoint}`
                        );
                        url.searchParams.set("index", indexName);
                        Object.entries(params).forEach(([key, value]) => {
                            if (value != null)
                                url.searchParams.set(key, String(value));
                        });

                        const resp = await fetch(url.toString(), {
                            headers: {
                                "X-Algolia-Application-Id": appId,
                                "X-Algolia-API-Key": resolvedApiKey,
                            },
                        });
                        if (!resp.ok) {
                            const text = await resp.text();
                            console.error(
                                `[Algolia Analytics] ${resp.status}: ${text}`
                            );
                            return {
                                error: true,
                                status: resp.status,
                                message: text,
                            };
                        }
                        return await resp.json();
                    } catch (err) {
                        console.error(
                            `[Algolia Analytics] Error: ${err.message || err}`
                        );
                        return {
                            error: true,
                            message: err.message || String(err),
                        };
                    }
                }
            )
        );

        // --- Plugins ---
        logger.loggedHandle("plugin-install", (e, message) =>
            pluginInstall(
                getSenderWindow(e),
                message.packageName,
                message.filepath
            )
        );

        // --- Workspaces ---
        logger.loggedHandle(WORKSPACE_LIST, (e, message) =>
            listWorkspacesForApplication(getSenderWindow(e), message.appId)
        );
        logger.loggedHandle(WORKSPACE_SAVE, async (e, message) => {
            const result = await saveWorkspaceForApplication(
                getSenderWindow(e),
                message.appId,
                message.data
            );
            // Broadcast to all windows so popouts can refresh
            for (const win of windows) {
                if (!win.isDestroyed()) {
                    win.webContents.send("workspace:saved");
                }
            }
            return result;
        });
        logger.loggedHandle(WORKSPACE_DELETE, (e, message) =>
            deleteWorkspaceForApplication(
                getSenderWindow(e),
                message.appId,
                message.workspaceId
            )
        );

        // --- Menu Items (template-specific) ---
        logger.loggedHandle(MENU_ITEMS_LIST, (e, message) =>
            listMenuItemsForApplication(getSenderWindow(e), message.appId)
        );
        logger.loggedHandle(MENU_ITEMS_SAVE, (e, message) =>
            saveMenuItemForApplication(
                getSenderWindow(e),
                message.appId,
                message.menuItem
            )
        );

        // --- Themes ---
        logger.loggedHandle("theme-list", (e, message) => {
            return listThemesForApplication(getSenderWindow(e), message.appId);
        });
        logger.loggedHandle(THEME_SAVE, (e, message) =>
            saveThemeForApplication(
                getSenderWindow(e),
                message.appId,
                message.themeName,
                message.themeObject
            )
        );
        logger.loggedHandle(THEME_DELETE, (e, message) =>
            deleteThemeForApplication(
                getSenderWindow(e),
                message.appId,
                message.themeKey
            )
        );

        // --- Theme from URL (with extraction cache) ---
        const {
            UrlTimeoutError,
            UrlUnreachableError,
            ExtractionFailedError,
            ThemeExtractionError,
        } = themeFromUrlErrors;

        const LOAD_TIMEOUT_MS = 15000;

        logger.loggedHandle(THEME_EXTRACT_FROM_URL, async (e, message) => {
            const { url, forceRefresh = false } = message;

            try {
                const data = await extractionCacheController.get(
                    url,
                    async () => {
                        const scanWindow = new BrowserWindow({
                            width: 1280,
                            height: 900,
                            show: false,
                            webPreferences: {
                                nodeIntegration: false,
                                contextIsolation: true,
                            },
                        });

                        let destroyed = false;
                        const destroyScanWindow = () => {
                            if (!destroyed) {
                                destroyed = true;
                                scanWindow.destroy();
                            }
                        };

                        try {
                            // Block navigation away from the target URL (e.g. auth redirects)
                            scanWindow.webContents.on(
                                "will-navigate",
                                (event) => {
                                    event.preventDefault();
                                }
                            );

                            // Load URL with timeout and did-fail-load handling
                            await new Promise((resolve, reject) => {
                                const timeout = setTimeout(() => {
                                    reject(
                                        new UrlTimeoutError(
                                            `Page load timed out after ${LOAD_TIMEOUT_MS}ms for ${url}`
                                        )
                                    );
                                }, LOAD_TIMEOUT_MS);

                                scanWindow.webContents.on(
                                    "did-fail-load",
                                    (event, errorCode, errorDescription) => {
                                        clearTimeout(timeout);
                                        const desc =
                                            errorDescription ||
                                            `Error code ${errorCode}`;
                                        if (
                                            errorDescription?.includes(
                                                "TIMED_OUT"
                                            )
                                        ) {
                                            reject(
                                                new UrlTimeoutError(
                                                    `Page load failed: ${desc}`
                                                )
                                            );
                                        } else {
                                            reject(
                                                new UrlUnreachableError(
                                                    `Page load failed: ${desc}`
                                                )
                                            );
                                        }
                                    }
                                );

                                scanWindow
                                    .loadURL(url)
                                    .then(() => {
                                        clearTimeout(timeout);
                                        resolve();
                                    })
                                    .catch((err) => {
                                        clearTimeout(timeout);
                                        reject(
                                            new UrlUnreachableError(
                                                `Failed to load ${url}: ${err.message}`,
                                                { cause: err }
                                            )
                                        );
                                    });
                            });

                            // Extract HTML, CSS, computed styles (legacy), and broad DOM color scan from the page
                            // Inner try-catch in the injected script handles CSP and runtime errors
                            const extracted = await scanWindow.webContents
                                .executeJavaScript(`
                                (function() {
                                    try {
                                        var htmlContent = document.documentElement.outerHTML;

                                        // Gather all CSS text from stylesheets
                                        var cssContent = '';
                                        try {
                                            for (var s = 0; s < document.styleSheets.length; s++) {
                                                try {
                                                    var rules = document.styleSheets[s].cssRules;
                                                    for (var r = 0; r < rules.length; r++) {
                                                        cssContent += rules[r].cssText + '\\n';
                                                    }
                                                } catch (e) {}
                                            }
                                        } catch (e) {}

                                        // Legacy: extract computed styles from key elements (backwards compat)
                                        var selectors = ['body', 'header', 'nav', 'main', 'footer', 'a', 'button', 'h1', 'h2'];
                                        var computedStyles = {};
                                        for (var si = 0; si < selectors.length; si++) {
                                            var sel = selectors[si];
                                            var elSel = document.querySelector(sel);
                                            if (!elSel) continue;
                                            var csSel = window.getComputedStyle(elSel);
                                            computedStyles[sel] = {
                                                color: csSel.color,
                                                backgroundColor: csSel.backgroundColor,
                                                borderColor: csSel.borderColor,
                                            };
                                        }

                                        // Broad DOM color scan — frequency-based
                                        var DEFAULT_COLORS = {
                                            'rgba(0, 0, 0, 0)': 1, 'transparent': 1,
                                            'rgb(0, 0, 0)': 1, 'rgb(255, 255, 255)': 1
                                        };
                                        var colorFreq = {};
                                        var elements = document.body ? document.body.querySelectorAll('*') : [];
                                        var limit = Math.min(elements.length, 500);
                                        for (var i = 0; i < limit; i++) {
                                            var el = elements[i];
                                            if (el.offsetWidth === 0 && el.offsetHeight === 0) continue;
                                            var cs = window.getComputedStyle(el);
                                            var props = ['color', 'backgroundColor', 'borderColor'];
                                            for (var p = 0; p < props.length; p++) {
                                                var val = cs[props[p]];
                                                if (val && !DEFAULT_COLORS[val]) {
                                                    colorFreq[val] = (colorFreq[val] || 0) + 1;
                                                }
                                            }
                                            if (el instanceof SVGElement) {
                                                var fill = cs.fill;
                                                var stroke = cs.stroke;
                                                if (fill && fill !== 'none' && !DEFAULT_COLORS[fill]) {
                                                    colorFreq[fill] = (colorFreq[fill] || 0) + 1;
                                                }
                                                if (stroke && stroke !== 'none' && !DEFAULT_COLORS[stroke]) {
                                                    colorFreq[stroke] = (colorFreq[stroke] || 0) + 1;
                                                }
                                            }
                                        }
                                        var domColors = Object.keys(colorFreq)
                                            .map(function(key) { return { color: key, count: colorFreq[key] }; })
                                            .sort(function(a, b) { return b.count - a.count; })
                                            .slice(0, 50);

                                        return { success: true, htmlContent: htmlContent, cssContent: cssContent, computedStyles: computedStyles, domColors: domColors };
                                    } catch (e) {
                                        return { success: false, error: { type: 'EXTRACTION_FAILED', message: e.message } };
                                    }
                                })();
                            `);

                            if (!extracted || !extracted.success) {
                                const errMsg =
                                    extracted?.error?.message ||
                                    "Script execution failed";
                                throw new ExtractionFailedError(
                                    `executeJavaScript failed: ${errMsg}`
                                );
                            }

                            return themeFromUrlController.extractColorsFromUrl({
                                htmlContent: extracted.htmlContent,
                                cssContent: extracted.cssContent,
                                computedStyles: extracted.computedStyles,
                                domColors: extracted.domColors,
                                baseUrl: url,
                            });
                        } finally {
                            destroyScanWindow();
                        }
                    },
                    { forceRefresh }
                );

                return { success: true, data };
            } catch (err) {
                if (err instanceof ThemeExtractionError) {
                    return {
                        success: false,
                        error: {
                            type: err.type,
                            message: err.userMessage,
                        },
                    };
                }
                // Unexpected error — wrap as generic extraction failure
                return {
                    success: false,
                    error: {
                        type: "EXTRACTION_FAILED",
                        message: "Failed to extract colors from this site.",
                    },
                };
            }
        });

        logger.loggedHandle(THEME_MAP_PALETTE_TO_THEME, (e, message) => {
            const { palette, overrides } = message;
            return paletteToThemeMapper.generateThemeFromPalette(
                palette,
                overrides
            );
        });

        // --- Layouts ---
        logger.loggedHandle(LAYOUT_LIST, (e, message) =>
            listLayoutsForApplication(getSenderWindow(e), message.appId)
        );

        // --- Data ---
        logger.loggedHandle(DATA_JSON_TO_CSV_FILE, (e, message) =>
            convertJsonToCsvFile(
                getSenderWindow(e),
                message.appId,
                message.jsonObject,
                message.filename
            )
        );
        logger.loggedHandle(DATA_JSON_TO_CSV_STRING, (e, message) =>
            convertJsonToCsvFile(
                getSenderWindow(e),
                message.appId,
                message.jsonObject
            )
        );
        logger.loggedHandle(PARSE_XML_STREAM, (e, message) => {
            const { filepath, outpath, start } = message;
            parseXMLStream(getSenderWindow(e), filepath, outpath, start);
        });
        logger.loggedHandle(PARSE_CSV_STREAM, (e, message) => {
            const {
                filepath,
                outpath,
                delimiter,
                headers,
                objectIdKey,
                limit,
            } = message;
            parseCSVStream(
                getSenderWindow(e),
                filepath,
                outpath,
                delimiter,
                objectIdKey,
                headers,
                limit
            );
        });
        logger.loggedHandle(READ_LINES, (e, message) => {
            const { filepath, lineCount } = message;
            readLinesFromFile(getSenderWindow(e), filepath, lineCount);
        });
        logger.loggedHandle(READ_JSON, (e, message) => {
            const { filepath, objectCount } = message;
            readJSONFromFile(getSenderWindow(e), filepath, objectCount);
        });
        logger.loggedHandle(TRANSFORM_FILE, (e, message) => {
            const { filepath, outFilepath, mappingFunctionBody, args } =
                message;
            transformFile(
                getSenderWindow(e),
                filepath,
                outFilepath,
                mappingFunctionBody,
                args
            );
        });
        logger.loggedHandle(EXTRACT_COLORS_FROM_IMAGE, (e, message) => {
            const { url } = message;
            extractColorsFromImageURL(getSenderWindow(e), url);
        });
        logger.loggedHandle(DATA_SAVE_TO_FILE, (e, message) =>
            saveToFile(
                getSenderWindow(e),
                message.data,
                message.filename,
                message.append,
                message.returnEmpty
            )
        );
        logger.loggedHandle(DATA_READ_FROM_FILE, (e, message) =>
            readFromFile(
                getSenderWindow(e),
                message.filename,
                message.returnEmpty
            )
        );
        logger.loggedHandle(READ_DATA_URL, (e, message) =>
            readDataFromURL(getSenderWindow(e), message.url, message.toFilepath)
        );

        // --- Settings ---
        logger.loggedHandle(SETTINGS_GET, (e, message) =>
            getSettingsForApplication(getSenderWindow(e))
        );
        logger.loggedHandle(SETTINGS_SAVE, (e, message) =>
            saveSettingsForApplication(getSenderWindow(e), message.data)
        );
        logger.loggedHandle(SETTINGS_GET_DATA_DIR, (e, message) =>
            getDataDirectory(getSenderWindow(e))
        );
        logger.loggedHandle(SETTINGS_SET_DATA_DIR, (e, message) =>
            setDataDirectory(getSenderWindow(e), message.dataDirectory)
        );
        logger.loggedHandle(SETTINGS_MIGRATE_DATA_DIR, (e, message) =>
            migrateDataDirectory(
                getSenderWindow(e),
                message.oldDirectory,
                message.newDirectory
            )
        );

        // --- OpenAI (template-specific) ---
        logger.loggedHandle(OPENAI_DESCRIBE_IMAGE, (e, message) => {
            describeImage(
                getSenderWindow(e),
                message.imageUrl,
                message.apiKey,
                message.prompt
            );
        });

        // --- Providers ---
        logger.loggedHandle(PROVIDER_SAVE, (e, message) =>
            saveProvider(
                getSenderWindow(e),
                message.appId,
                message.providerName,
                message.providerType,
                message.credentials,
                message.providerClass,
                message.mcpConfig,
                message.allowedTools,
                message.wsConfig
            )
        );
        logger.loggedHandle(PROVIDER_LIST, (e, message) =>
            listProviders(getSenderWindow(e), message.appId)
        );
        logger.loggedHandle(PROVIDER_GET, (e, message) =>
            getProvider(getSenderWindow(e), message.appId, message.providerName)
        );
        logger.loggedHandle(PROVIDER_DELETE, (e, message) =>
            deleteProvider(
                getSenderWindow(e),
                message.appId,
                message.providerName
            )
        );

        // --- MCP ---
        logger.loggedHandle(MCP_START_SERVER, (e, message) =>
            mcpController.startServer(
                getSenderWindow(e),
                message.serverName,
                message.mcpConfig,
                message.credentials
            )
        );
        logger.loggedHandle(MCP_STOP_SERVER, (e, message) =>
            mcpController.stopServer(getSenderWindow(e), message.serverName)
        );
        logger.loggedHandle(MCP_LIST_TOOLS, (e, message) =>
            mcpController.listTools(getSenderWindow(e), message.serverName)
        );
        logger.loggedHandle(MCP_CALL_TOOL, (e, message) =>
            mcpController.callTool(
                getSenderWindow(e),
                message.serverName,
                message.toolName,
                message.args,
                message.allowedTools
            )
        );
        logger.loggedHandle(MCP_LIST_RESOURCES, (e, message) =>
            mcpController.listResources(getSenderWindow(e), message.serverName)
        );
        logger.loggedHandle(MCP_READ_RESOURCE, (e, message) =>
            mcpController.readResource(
                getSenderWindow(e),
                message.serverName,
                message.uri
            )
        );
        logger.loggedHandle(MCP_SERVER_STATUS, (e, message) =>
            mcpController.getServerStatus(
                getSenderWindow(e),
                message.serverName
            )
        );
        logger.loggedHandle(MCP_GET_CATALOG, (e) =>
            mcpController.getCatalog(getSenderWindow(e))
        );
        logger.loggedHandle(MCP_RUN_AUTH, (e, message) =>
            mcpController.runAuth(
                getSenderWindow(e),
                message.mcpConfig,
                message.credentials,
                message.authCommand
            )
        );

        // --- MCP Dash Server (hosted server for external LLM clients) ---
        logger.loggedHandle(MCP_DASH_SERVER_START, (e, message) =>
            mcpDashServerController.startServer(getSenderWindow(e), message)
        );
        logger.loggedHandle(MCP_DASH_SERVER_STOP, (e) =>
            mcpDashServerController.stopServer(getSenderWindow(e))
        );
        logger.loggedHandle(MCP_DASH_SERVER_STATUS, (e) =>
            mcpDashServerController.getStatus(getSenderWindow(e))
        );
        logger.loggedHandle(MCP_DASH_SERVER_GET_TOKEN, (e) =>
            mcpDashServerController.getOrCreateToken(getSenderWindow(e))
        );

        // --- WebSocket ---
        logger.loggedHandle(WS_CONNECT, (e, message) =>
            webSocketController.connect(
                getSenderWindow(e),
                message.providerName,
                message.config
            )
        );
        logger.loggedHandle(WS_DISCONNECT, (e, message) =>
            webSocketController.disconnect(
                getSenderWindow(e),
                message.providerName
            )
        );
        logger.loggedHandle(WS_SEND, (e, message) =>
            webSocketController.send(
                getSenderWindow(e),
                message.providerName,
                message.data
            )
        );
        logger.loggedHandle(WS_STATUS, (e, message) =>
            webSocketController.getStatus(
                getSenderWindow(e),
                message.providerName
            )
        );
        logger.loggedHandle(WS_GET_ALL, (e) =>
            webSocketController.getAll(getSenderWindow(e))
        );

        // --- LLM ---
        logger.loggedHandle(LLM_SEND_MESSAGE, (e, msg) =>
            llmController.sendMessage(getSenderWindow(e), msg.requestId, msg)
        );
        logger.loggedHandle(LLM_ABORT_REQUEST, (e, msg) =>
            llmController.abortRequest(getSenderWindow(e), msg.requestId)
        );
        logger.loggedHandle(LLM_LIST_CONNECTED_TOOLS, () =>
            mcpController.listConnectedServers()
        );
        logger.loggedHandle(LLM_CHECK_CLI_AVAILABLE, () =>
            cliController.isAvailable()
        );
        logger.loggedHandle(LLM_CLEAR_CLI_SESSION, (e, msg) =>
            cliController.clearSession(msg.widgetUuid)
        );
        logger.loggedHandle(LLM_CLI_SESSION_STATUS, (e, msg) =>
            cliController.getSessionStatus(msg.widgetUuid)
        );
        logger.loggedHandle(LLM_CLI_END_SESSION, (e, msg) =>
            cliController.endSession(msg.widgetUuid)
        );

        // --- Registry ---
        logger.loggedHandle(REGISTRY_FETCH_INDEX, (e, forceRefresh) =>
            registryController.fetchRegistryIndex(forceRefresh)
        );
        logger.loggedHandle(REGISTRY_SEARCH, (e, query, filters) =>
            registryController.searchRegistry(query, filters)
        );
        logger.loggedHandle(REGISTRY_GET_PACKAGE, (e, packageName) =>
            registryController.getPackage(packageName)
        );
        logger.loggedHandle(REGISTRY_CHECK_UPDATES, (e, installedWidgets) =>
            registryController.checkUpdates(installedWidgets)
        );
        logger.loggedHandle(REGISTRY_SEARCH_DASHBOARDS, (e, query, filters) =>
            registryController.searchDashboards(query, filters)
        );
        logger.loggedHandle(REGISTRY_SEARCH_THEMES, (e, query, filters) =>
            registryController.searchThemes(query, filters)
        );

        // --- Theme Registry ---
        logger.loggedHandle(THEME_PUBLISH, (e, msg) =>
            themeRegistryController.prepareThemeForPublish(
                getSenderWindow(e),
                msg.appId,
                msg.themeKey,
                msg.options
            )
        );
        logger.loggedHandle(THEME_INSTALL_FROM_REGISTRY, (e, msg) =>
            themeRegistryController.installThemeFromRegistry(
                getSenderWindow(e),
                msg.appId,
                msg.packageName
            )
        );
        logger.loggedHandle(THEME_PUBLISH_PREVIEW, (e, msg) =>
            themeRegistryController.getThemePublishPreview(
                msg.appId,
                msg.themeKey
            )
        );

        // --- Dashboard Config ---
        logger.loggedHandle(DASHBOARD_CONFIG_EXPORT, (e, message) =>
            exportDashboardConfig(
                getSenderWindow(e),
                message.appId,
                message.workspaceId,
                message.options,
                widgetRegistry.getWidgetRegistry()
            )
        );
        logger.loggedHandle(DASHBOARD_CONFIG_SELECT_FILE, (e) =>
            selectDashboardFile(getSenderWindow(e))
        );
        logger.loggedHandle(DASHBOARD_CONFIG_IMPORT, (e, message) =>
            importDashboardConfig(
                getSenderWindow(e),
                message.appId,
                widgetRegistry.getWidgetRegistry(),
                {
                    filePath: message.filePath,
                    name: message.name,
                    menuId: message.menuId,
                    themeKey: message.themeKey,
                }
            )
        );
        logger.loggedHandle(DASHBOARD_CONFIG_INSTALL, (e, message) =>
            installDashboardFromRegistry(
                getSenderWindow(e),
                message.appId,
                message.packageName,
                widgetRegistry.getWidgetRegistry()
            )
        );
        logger.loggedHandle(DASHBOARD_CONFIG_COMPATIBILITY, (e, msg) =>
            checkCompatibility(
                msg.dashboardWidgets,
                widgetRegistry.getWidgetRegistry()
            )
        );
        logger.loggedHandle(DASHBOARD_CONFIG_PUBLISH, (e, message) =>
            prepareDashboardForPublish(
                getSenderWindow(e),
                message.appId,
                message.workspaceId,
                message.options,
                widgetRegistry.getWidgetRegistry()
            )
        );
        logger.loggedHandle(DASHBOARD_CONFIG_PREVIEW, (e, message) =>
            getDashboardPreview(
                message.packageName,
                widgetRegistry.getWidgetRegistry()
            )
        );
        logger.loggedHandle(DASHBOARD_CONFIG_CHECK_UPDATES, (e, message) =>
            checkDashboardUpdatesForApp(message.appId)
        );
        logger.loggedHandle(DASHBOARD_CONFIG_PROVIDER_SETUP, (e, message) =>
            getProviderSetupManifest(message.appId, message.requiredProviders)
        );
        logger.loggedHandle(DASHBOARD_CONFIG_PUBLISH_PREVIEW, (e, message) =>
            getDashboardPublishPreview(
                message.appId,
                message.workspaceId,
                widgetRegistry.getWidgetRegistry()
            )
        );

        // --- Dashboard Ratings ---
        logger.loggedHandle(DASHBOARD_RATING_SAVE, (e, message) =>
            saveDashboardRating(
                message.appId,
                message.packageName,
                message.rating
            )
        );
        logger.loggedHandle(DASHBOARD_RATING_GET, (e, message) =>
            getDashboardRating(message.appId, message.packageName)
        );
        logger.loggedHandle(DASHBOARD_RATING_LIST, (e, message) =>
            listDashboardRatings(message.appId)
        );
        logger.loggedHandle(DASHBOARD_RATING_DELETE, (e, message) =>
            deleteDashboardRating(message.appId, message.packageName)
        );

        // --- Registry Auth ---
        logger.loggedHandle(REGISTRY_AUTH_INITIATE_LOGIN, () =>
            initiateDeviceFlow()
        );
        logger.loggedHandle(REGISTRY_AUTH_POLL_TOKEN, async (e, message) => {
            const result = await pollForToken(message.deviceCode);
            if (result?.userId) logger.setUserId(result.userId);
            return result;
        });
        logger.loggedHandle(REGISTRY_AUTH_GET_STATUS, () =>
            getRegistryAuthStatus()
        );
        logger.loggedHandle(REGISTRY_AUTH_GET_PROFILE, () =>
            getRegistryProfile()
        );
        logger.loggedHandle(REGISTRY_AUTH_LOGOUT, () => {
            logger.setUserId(null);
            return clearRegistryToken();
        });
        logger.loggedHandle(REGISTRY_AUTH_PUBLISH, (e, message) =>
            publishToRegistry(message.zipPath, message.manifest)
        );
        logger.loggedHandle(REGISTRY_AUTH_UPDATE_PROFILE, (e, message) =>
            updateRegistryProfile(message)
        );
        logger.loggedHandle(REGISTRY_AUTH_GET_PACKAGES, () =>
            getRegistryPackages()
        );
        logger.loggedHandle(REGISTRY_AUTH_UPDATE_PACKAGE, (e, message) =>
            updateRegistryPackage(message.scope, message.name, message.updates)
        );
        logger.loggedHandle(REGISTRY_AUTH_DELETE_PACKAGE, (e, message) =>
            deleteRegistryPackage(message.scope, message.name)
        );

        // --- Session ---
        logger.loggedHandle(SESSION_GET_RECENTS, () => getRecentDashboards());
        logger.loggedHandle(SESSION_ADD_RECENT, (e, message) =>
            addRecentDashboard(message.workspaceId, message.name)
        );
        logger.loggedHandle(SESSION_REMOVE_RECENT, (e, message) =>
            removeRecentDashboard(message.workspaceId)
        );
        logger.loggedHandle(SESSION_CLEAR_RECENTS, () =>
            clearRecentDashboards()
        );
        logger.loggedHandle(SESSION_GET_STATE, () => getSessionState());
        logger.loggedHandle(SESSION_SAVE_STATE, (e, message) =>
            saveSessionState(message.openTabIds, message.activeTabId)
        );
        logger.loggedHandle(SESSION_CLEAR_STATE, () => clearSessionState());

        // --- Widget System ---
        setupWidgetRegistryHandlers();

        // Ensure @ai-built/ directory exists for the widget builder CLI
        try {
            const registry = widgetRegistry.getWidgetRegistry();
            const cachePath = registry.getCachePath();
            const aiBuiltDir = path.join(cachePath, "@ai-built");
            require("fs").mkdirSync(aiBuiltDir, { recursive: true });
        } catch (_) {
            // Non-fatal — directory will be created on first widget build
        }

        // --- Cache Management ---
        setupCacheHandlers();

        // --- Popout Windows ---
        logger.loggedHandle("popout-open", (e, message) => {
            const wsId = String(message.workspaceId);
            const existing = popoutWindows.get(wsId);
            if (existing && !existing.isDestroyed()) {
                existing.focus();
                return { focused: true };
            }
            createPopoutWindow(wsId);
            return { opened: true };
        });
        logger.loggedHandle("popout-set-title", (e, message) => {
            const wsId = String(message.workspaceId);
            const win = popoutWindows.get(wsId);
            if (win && !win.isDestroyed()) {
                win.setTitle(message.title);
            }
        });

        // --- Widget Popout Windows ---
        logger.loggedHandle("widget-popout-open", (e, message) => {
            const key = `${message.workspaceId}:${message.widgetId}`;
            const existing = widgetPopoutWindows.get(key);
            if (existing && !existing.isDestroyed()) {
                existing.focus();
                return { focused: true };
            }
            createWidgetPopoutWindow(message.workspaceId, message.widgetId);
            return { opened: true };
        });
        logger.loggedHandle("widget-popout-set-title", (e, message) => {
            const key = `${message.workspaceId}:${message.widgetId}`;
            const win = widgetPopoutWindows.get(key);
            if (win && !win.isDestroyed()) {
                win.setTitle(message.title);
            }
        });
        // --- Debug Console Window ---
        logger.loggedHandle("debug-window-open", () => {
            if (debugWindow && !debugWindow.isDestroyed()) {
                debugWindow.focus();
                return { focused: true };
            }
            createDebugWindow();
            return { opened: true };
        });
        logger.loggedHandle("debug-window-close", () => {
            destroyDebugWindow();
            return { closed: true };
        });
        logger.loggedHandle("debug-api-catalog", () => {
            return logger.getApiCatalog();
        });

        // --- Notifications ---
        logger.loggedHandle(NOTIFICATION_SEND, (e, payload) =>
            notificationController.send(mainWindow, payload)
        );
        logger.loggedHandle(NOTIFICATION_GET_PREFERENCES, () =>
            notificationController.getPreferences()
        );
        logger.loggedHandle(
            NOTIFICATION_SET_PREFERENCES,
            (e, { widgetId, prefs }) =>
                notificationController.setPreferences(widgetId, prefs)
        );
        logger.loggedHandle(NOTIFICATION_SET_GLOBAL, (e, settings) =>
            notificationController.setGlobal(settings)
        );

        // --- Scheduler ---
        logger.loggedHandle(SCHEDULER_REGISTER_TASK, (e, payload) =>
            schedulerController.registerTask(payload)
        );
        logger.loggedHandle(SCHEDULER_REMOVE_TASK, (e, taskId) =>
            schedulerController.removeTask(taskId)
        );
        logger.loggedHandle(SCHEDULER_REMOVE_TASKS, (e, widgetId) =>
            schedulerController.removeTasks(widgetId)
        );
        logger.loggedHandle(SCHEDULER_GET_TASKS, (e, widgetId) =>
            schedulerController.getTasks(widgetId)
        );
        logger.loggedHandle(SCHEDULER_UPDATE_TASK, (e, { taskId, updates }) =>
            schedulerController.updateTask(taskId, updates)
        );
        logger.loggedHandle(SCHEDULER_ENABLE_TASK, (e, taskId) =>
            schedulerController.enableTask(taskId)
        );
        logger.loggedHandle(SCHEDULER_DISABLE_TASK, (e, taskId) =>
            schedulerController.disableTask(taskId)
        );
        logger.loggedHandle(SCHEDULER_GET_PENDING, (e, widgetId) =>
            schedulerController.getPendingResults(widgetId)
        );

        // --- Widget Event IPC Bridge ---
        // Broadcasts widget pub/sub events to all windows except the sender
        ipcMain.on("widget-event:publish", (e, message) => {
            for (const win of windows) {
                if (!win.isDestroyed() && win.webContents !== e.sender) {
                    win.webContents.send("widget-event:broadcast", message);
                }
            }
        });
        // --- AI Widget Builder: Preview Compile ---
        // Compiles widget code and returns the bundle source for live preview.
        // Does NOT install — just compile and return.
        logger.loggedHandle("widget:ai-compile-preview", async (e, message) => {
            const { widgetName, componentCode, configCode } = message;
            const path = require("path");
            const fs = require("fs");
            const os = require("os");

            const buildDir = path.join(
                os.tmpdir(),
                `dash-ai-preview-${widgetName}-${Date.now()}`
            );

            try {
                const widgetsDir = path.join(buildDir, "widgets");
                fs.mkdirSync(widgetsDir, { recursive: true });
                fs.writeFileSync(
                    path.join(widgetsDir, `${widgetName}.js`),
                    componentCode,
                    "utf8"
                );
                fs.writeFileSync(
                    path.join(widgetsDir, `${widgetName}.dash.js`),
                    configCode,
                    "utf8"
                );

                const dashCore = require("@trops/dash-core/electron");
                await dashCore.widgetCompiler.compileWidget(buildDir);

                const outputPath = path.join(buildDir, "dist", "index.cjs.js");
                if (!fs.existsSync(outputPath)) {
                    return {
                        success: false,
                        error: "Compilation produced no output.",
                    };
                }

                const bundleSource = fs.readFileSync(outputPath, "utf8");

                // Clean up temp dir
                fs.rmSync(buildDir, { recursive: true, force: true });

                return {
                    success: true,
                    bundleSource,
                    widgetName,
                };
            } catch (err) {
                try {
                    fs.rmSync(buildDir, { recursive: true, force: true });
                } catch (e) {
                    /* ignore cleanup errors */
                }
                return { success: false, error: err.message };
            }
        });

        // --- AI Widget Builder: Install ---
        // Compiles AI-generated widget code and installs to @ai-built/ scope.
        // Called from the Widget Builder modal UI — the LLM never touches the filesystem.
        logger.loggedHandle("widget:ai-build", async (e, message) => {
            const { widgetName, componentCode, configCode, description } =
                message;

            const path = require("path");
            const fs = require("fs");
            const os = require("os");

            const buildDir = path.join(
                os.tmpdir(),
                `dash-ai-build-${widgetName}-${Date.now()}`
            );

            try {
                // Create temp directory structure
                const widgetsDir = path.join(buildDir, "widgets");
                fs.mkdirSync(widgetsDir, { recursive: true });

                // Write component file
                fs.writeFileSync(
                    path.join(widgetsDir, `${widgetName}.js`),
                    componentCode,
                    "utf8"
                );

                // Write config file
                fs.writeFileSync(
                    path.join(widgetsDir, `${widgetName}.dash.js`),
                    configCode,
                    "utf8"
                );

                // Write dash.json manifest
                fs.writeFileSync(
                    path.join(buildDir, "dash.json"),
                    JSON.stringify(
                        {
                            name: `@ai-built/${widgetName.toLowerCase()}`,
                            displayName: widgetName
                                .replace(/([A-Z])/g, " $1")
                                .trim(),
                            version: "1.0.0",
                            description:
                                description ||
                                `AI-generated widget: ${widgetName}`,
                            author: "AI Assistant",
                            widgets: [
                                {
                                    name: widgetName,
                                    displayName: widgetName
                                        .replace(/([A-Z])/g, " $1")
                                        .trim(),
                                    description: description || "",
                                },
                            ],
                            createdAt: new Date().toISOString(),
                        },
                        null,
                        2
                    ),
                    "utf8"
                );

                // Compile via widgetCompiler (from dash-core)
                const dashCore = require("@trops/dash-core/electron");
                await dashCore.widgetCompiler.compileWidget(buildDir);

                // Verify output
                const outputPath = path.join(buildDir, "dist", "index.cjs.js");
                if (!fs.existsSync(outputPath)) {
                    return {
                        success: false,
                        error: "Compilation produced no output. Check for syntax errors.",
                    };
                }

                // Install to @ai-built/ scope
                const scopedName = `@ai-built/${widgetName.toLowerCase()}`;
                const registry = dashCore.widgetRegistry.getWidgetRegistry();
                const config = await registry.installFromLocalPath(
                    scopedName,
                    buildDir,
                    true,
                    path.join(buildDir, "dash.json")
                );

                // Broadcast to all windows
                for (const win of windows) {
                    if (!win.isDestroyed()) {
                        win.webContents.send("widget:installed", {
                            widgetName: scopedName,
                            config,
                        });
                    }
                }

                return {
                    success: true,
                    widgetName: scopedName,
                };
            } catch (err) {
                console.error("[widget:ai-build] Error:", err);
                return {
                    success: false,
                    error: err.message,
                };
            }
        });
    } // end ipcHandlersRegistered guard

    windows.add(mainWindow);
    logger.logLifecycle("window-created");

    mainWindow.on("closed", () => {
        windows.delete(mainWindow);
        mainWindow = null;
    });
}

function createPopoutWindow(workspaceId) {
    const popoutWin = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 640,
        minHeight: 480,
        fullscreen: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: true,
        },
    });

    const hashRoute = `#/popout/${workspaceId}`;
    popoutWin.loadURL(
        isDev
            ? `http://localhost:3000${hashRoute}`
            : `${
                  pathToFileURL(path.join(__dirname, "../build/index.html"))
                      .href
              }${hashRoute}`
    );

    windows.add(popoutWin);
    popoutWindows.set(String(workspaceId), popoutWin);

    popoutWin.on("closed", () => {
        windows.delete(popoutWin);
        popoutWindows.delete(String(workspaceId));
    });

    return popoutWin;
}

function createWidgetPopoutWindow(workspaceId, widgetId) {
    const popoutWin = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 400,
        minHeight: 300,
        fullscreen: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: true,
        },
    });

    const hashRoute = `#/popout-widget/${workspaceId}/${widgetId}`;
    popoutWin.loadURL(
        isDev
            ? `http://localhost:3000${hashRoute}`
            : `${
                  pathToFileURL(path.join(__dirname, "../build/index.html"))
                      .href
              }${hashRoute}`
    );

    const key = `${workspaceId}:${widgetId}`;
    windows.add(popoutWin);
    widgetPopoutWindows.set(key, popoutWin);

    popoutWin.on("closed", () => {
        windows.delete(popoutWin);
        widgetPopoutWindows.delete(key);
    });

    return popoutWin;
}

function createDebugWindow() {
    if (debugWindow && !debugWindow.isDestroyed()) {
        debugWindow.focus();
        return debugWindow;
    }

    debugWindow = new BrowserWindow({
        width: 960,
        height: 640,
        minWidth: 600,
        minHeight: 400,
        title: "Dash — Debug Console",
        fullscreen: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: true,
        },
    });

    const hashRoute = "#/debug-console";
    debugWindow.loadURL(
        isDev
            ? `http://localhost:3000${hashRoute}`
            : `${
                  pathToFileURL(path.join(__dirname, "../build/index.html"))
                      .href
              }${hashRoute}`
    );

    // Wire up the logger broadcast
    logger.setDebugWindow(debugWindow);

    // Send buffered entries once the window is ready
    debugWindow.webContents.once("dom-ready", () => {
        const buffer = logger.getRingBuffer();
        for (const entry of buffer) {
            if (debugWindow && !debugWindow.isDestroyed()) {
                debugWindow.webContents.send("debug:log-entry", entry);
            }
        }
    });

    windows.add(debugWindow);

    debugWindow.on("closed", () => {
        windows.delete(debugWindow);
        logger.setDebugWindow(null);
        debugWindow = null;
    });

    return debugWindow;
}

function destroyDebugWindow() {
    if (debugWindow && !debugWindow.isDestroyed()) {
        debugWindow.close();
    }
    logger.setDebugWindow(null);
    debugWindow = null;
}

app.whenReady().then(() => {
    pe.init({
        confirmInstall: async (plugins) => {
            const answer = await dialog.showMessageBox({
                message: `Are you sure you want to install the plugins ${plugins.join(
                    ", "
                )}`,
                buttons: ["Ok", "Cancel"],
                cancelId: 1,
            });
            return answer.response == 0;
        },
        pluginsPath: path.join(app.getPath("userData"), "plugins"),
    });

    console.log("plugins path", path.join(app.getPath("userData"), "plugins"));

    // Initialize logger
    logger.init(() => {
        const result = getDataDirectory(mainWindow);
        return (
            result?.dataDirectory ||
            path.join(app.getPath("userData"), "Dashboard")
        );
    });

    // Fetch initial auth status for logging
    const authStatus = getRegistryAuthStatus();
    if (authStatus?.authenticated) {
        logger.setUserId(authStatus.userId);
    }

    // Clean old logs (>30 days)
    logger.cleanOldLogs(30);

    logger.logLifecycle("app-ready", { version: app.getVersion() });

    buildMenu();
    createWindow();

    // --- Scheduler lifecycle ---
    schedulerController.init({
        getWindows: () => BrowserWindow.getAllWindows(),
        notificationController,
        getMainWindow: () => mainWindow,
    });
    schedulerController.start();

    // --- MCP Dash Server auto-start ---
    mcpDashServerController.autoStart(mainWindow).catch((err) => {
        console.error("[electron] MCP Dash Server auto-start failed:", err);
    });

    const { powerMonitor } = require("electron");
    powerMonitor.on("suspend", () => schedulerController.handleSuspend());
    powerMonitor.on("resume", () => schedulerController.handleResume());
});

app.on("window-all-closed", () => {
    logger.logLifecycle("window-all-closed");
    schedulerController.stop();
    mcpController.stopAllServers().catch((err) => {
        console.error("[electron] Error stopping MCP servers:", err);
    });
    mcpDashServerController.stopServer(mainWindow).catch((err) => {
        console.error("[electron] Error stopping MCP Dash Server:", err);
    });
    webSocketController.disconnectAll().catch((err) => {
        console.error("[electron] Error closing WebSocket connections:", err);
    });
    clientCache.clear();
    responseCache.clear();

    // Close all popout windows
    for (const [, win] of popoutWindows) {
        if (!win.isDestroyed()) win.close();
    }
    popoutWindows.clear();

    // Close all widget popout windows
    for (const [, win] of widgetPopoutWindows) {
        if (!win.isDestroyed()) win.close();
    }
    widgetPopoutWindows.clear();

    // Close debug window
    destroyDebugWindow();

    if (process.platform !== "darwin") {
        windows.delete(mainWindow);
        mainWindow = null;
        app.quit();
    }
});

app.on("activate", () => {
    logger.logLifecycle("app-activated");
    if (windows.size === 0) {
        createWindow();
    }
});
