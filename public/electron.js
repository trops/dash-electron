/**
 * electron.js
 *
 * The main brain!
 *
 * This is where we will place all of the listeners. This is very important.
 */

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

const { updateElectronApp } = require("update-electron-app");

// Auto-update: checks update.electronjs.org every 10 minutes
// Only runs in production (packaged app), no-ops in development
// Repo is auto-detected from package.json "repository" field
if (!isDev) {
    updateElectronApp({ notifyUser: false });
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
            label: "Check for Updates...",
            click: () => {
                manualCheckInProgress = true;
                updateState = "checking";
                buildMenu();
                autoUpdater.checkForUpdates();
            },
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
if (!isDev) {
    autoUpdater.on("update-not-available", () => {
        updateState = "idle";
        buildMenu();
        if (manualCheckInProgress) {
            manualCheckInProgress = false;
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
        updateState = "downloaded";
        buildMenu();
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
        manualCheckInProgress = false;
    });

    autoUpdater.on("error", (err) => {
        updateState = "idle";
        buildMenu();
        if (manualCheckInProgress) {
            manualCheckInProgress = false;
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
    // Namespaced controllers
    mcpController,
    registryController,
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
    REGISTRY_FETCH_INDEX,
    REGISTRY_SEARCH,
    REGISTRY_GET_PACKAGE,
    REGISTRY_CHECK_UPDATES,
    ALGOLIA_LIST_INDICES,
    ALGOLIA_PARTIAL_UPDATE_OBJECTS,
    ALGOLIA_CREATE_BATCH,
    ALGOLIA_BROWSE_OBJECTS,
    ALGOLIA_SEARCH,
    ALGOLIA_ANALYTICS_FOR_QUERY,
    OPENAI_DESCRIBE_IMAGE,
    MENU_ITEMS_LIST,
    MENU_ITEMS_SAVE,
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
    ipcMain.removeAllListeners();

    // Create the browser window.
    mainWindow = new BrowserWindow({
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
        ipcMain.handle(CHOOSE_FILE, async (e, message) => {
            return showDialog(
                getSenderWindow(e),
                message,
                message.allowFile,
                message.extensions
            );
        });
        ipcMain.handle(CHOOSE_FILE_COMPLETE, (e, message) => {
            console.log("choose file complete ", e, message);
        });
        ipcMain.handle(CHOOSE_FILE_ERROR, (e, message) =>
            fileChosenError(getSenderWindow(e), message)
        );

        // --- Secure Storage ---
        ipcMain.handle(SECURE_STORE_ENCRYPTION_CHECK, (e, message) =>
            isEncryptionAvailable(getSenderWindow(e), message)
        );

        // --- Algolia (template-specific) ---
        // All handlers accept { providerHash, dashboardAppId, providerName }
        // and resolve credentials on the main process side.
        ipcMain.handle(
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
        ipcMain.handle(
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
        ipcMain.handle(ALGOLIA_CREATE_BATCH, (e, message) => {
            const { filepath, batchFilepath, batchSize } = message;
            createBatchesFromFile(
                getSenderWindow(e),
                filepath,
                batchFilepath,
                batchSize
            );
        });
        ipcMain.handle(
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
        ipcMain.handle(
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
        ipcMain.handle(
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

        ipcMain.handle(
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

        ipcMain.handle(
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
        ipcMain.handle("plugin-install", (e, message) =>
            pluginInstall(getSenderWindow(e), message.packageName, message.filepath)
        );

        // --- Workspaces ---
        ipcMain.handle(WORKSPACE_LIST, (e, message) =>
            listWorkspacesForApplication(getSenderWindow(e), message.appId)
        );
        ipcMain.handle(WORKSPACE_SAVE, async (e, message) => {
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
        ipcMain.handle(WORKSPACE_DELETE, (e, message) =>
            deleteWorkspaceForApplication(
                getSenderWindow(e),
                message.appId,
                message.workspaceId
            )
        );

        // --- Menu Items (template-specific) ---
        ipcMain.handle(MENU_ITEMS_LIST, (e, message) =>
            listMenuItemsForApplication(getSenderWindow(e), message.appId)
        );
        ipcMain.handle(MENU_ITEMS_SAVE, (e, message) =>
            saveMenuItemForApplication(
                getSenderWindow(e),
                message.appId,
                message.menuItem
            )
        );

        // --- Themes ---
        ipcMain.handle("theme-list", (e, message) => {
            return listThemesForApplication(getSenderWindow(e), message.appId);
        });
        ipcMain.handle(THEME_SAVE, (e, message) =>
            saveThemeForApplication(
                getSenderWindow(e),
                message.appId,
                message.themeName,
                message.themeObject
            )
        );
        ipcMain.handle(THEME_DELETE, (e, message) =>
            deleteThemeForApplication(
                getSenderWindow(e),
                message.appId,
                message.themeKey
            )
        );

        // --- Layouts ---
        ipcMain.handle(LAYOUT_LIST, (e, message) =>
            listLayoutsForApplication(getSenderWindow(e), message.appId)
        );

        // --- Data ---
        ipcMain.handle(DATA_JSON_TO_CSV_FILE, (e, message) =>
            convertJsonToCsvFile(
                getSenderWindow(e),
                message.appId,
                message.jsonObject,
                message.filename
            )
        );
        ipcMain.handle(DATA_JSON_TO_CSV_STRING, (e, message) =>
            convertJsonToCsvFile(getSenderWindow(e), message.appId, message.jsonObject)
        );
        ipcMain.handle(PARSE_XML_STREAM, (e, message) => {
            const { filepath, outpath, start } = message;
            parseXMLStream(getSenderWindow(e), filepath, outpath, start);
        });
        ipcMain.handle(PARSE_CSV_STREAM, (e, message) => {
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
        ipcMain.handle(READ_LINES, (e, message) => {
            const { filepath, lineCount } = message;
            readLinesFromFile(getSenderWindow(e), filepath, lineCount);
        });
        ipcMain.handle(READ_JSON, (e, message) => {
            const { filepath, objectCount } = message;
            readJSONFromFile(getSenderWindow(e), filepath, objectCount);
        });
        ipcMain.handle(TRANSFORM_FILE, (e, message) => {
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
        ipcMain.handle(EXTRACT_COLORS_FROM_IMAGE, (e, message) => {
            const { url } = message;
            extractColorsFromImageURL(getSenderWindow(e), url);
        });
        ipcMain.handle(DATA_SAVE_TO_FILE, (e, message) =>
            saveToFile(
                getSenderWindow(e),
                message.data,
                message.filename,
                message.append,
                message.returnEmpty
            )
        );
        ipcMain.handle(DATA_READ_FROM_FILE, (e, message) =>
            readFromFile(getSenderWindow(e), message.filename, message.returnEmpty)
        );
        ipcMain.handle(READ_DATA_URL, (e, message) =>
            readDataFromURL(getSenderWindow(e), message.url, message.toFilepath)
        );

        // --- Settings ---
        ipcMain.handle(SETTINGS_GET, (e, message) =>
            getSettingsForApplication(getSenderWindow(e))
        );
        ipcMain.handle(SETTINGS_SAVE, (e, message) =>
            saveSettingsForApplication(getSenderWindow(e), message.data)
        );
        ipcMain.handle(SETTINGS_GET_DATA_DIR, (e, message) =>
            getDataDirectory(getSenderWindow(e))
        );
        ipcMain.handle(SETTINGS_SET_DATA_DIR, (e, message) =>
            setDataDirectory(getSenderWindow(e), message.dataDirectory)
        );
        ipcMain.handle(SETTINGS_MIGRATE_DATA_DIR, (e, message) =>
            migrateDataDirectory(
                getSenderWindow(e),
                message.oldDirectory,
                message.newDirectory
            )
        );

        // --- OpenAI (template-specific) ---
        ipcMain.handle(OPENAI_DESCRIBE_IMAGE, (e, message) => {
            describeImage(
                getSenderWindow(e),
                message.imageUrl,
                message.apiKey,
                message.prompt
            );
        });

        // --- Providers ---
        ipcMain.handle(PROVIDER_SAVE, (e, message) =>
            saveProvider(
                getSenderWindow(e),
                message.appId,
                message.providerName,
                message.providerType,
                message.credentials,
                message.providerClass,
                message.mcpConfig
            )
        );
        ipcMain.handle(PROVIDER_LIST, (e, message) =>
            listProviders(getSenderWindow(e), message.appId)
        );
        ipcMain.handle(PROVIDER_GET, (e, message) =>
            getProvider(getSenderWindow(e), message.appId, message.providerName)
        );
        ipcMain.handle(PROVIDER_DELETE, (e, message) =>
            deleteProvider(getSenderWindow(e), message.appId, message.providerName)
        );

        // --- MCP ---
        ipcMain.handle(MCP_START_SERVER, (e, message) =>
            mcpController.startServer(
                getSenderWindow(e),
                message.serverName,
                message.mcpConfig,
                message.credentials
            )
        );
        ipcMain.handle(MCP_STOP_SERVER, (e, message) =>
            mcpController.stopServer(getSenderWindow(e), message.serverName)
        );
        ipcMain.handle(MCP_LIST_TOOLS, (e, message) =>
            mcpController.listTools(getSenderWindow(e), message.serverName)
        );
        ipcMain.handle(MCP_CALL_TOOL, (e, message) =>
            mcpController.callTool(
                getSenderWindow(e),
                message.serverName,
                message.toolName,
                message.args,
                message.allowedTools
            )
        );
        ipcMain.handle(MCP_LIST_RESOURCES, (e, message) =>
            mcpController.listResources(getSenderWindow(e), message.serverName)
        );
        ipcMain.handle(MCP_READ_RESOURCE, (e, message) =>
            mcpController.readResource(
                getSenderWindow(e),
                message.serverName,
                message.uri
            )
        );
        ipcMain.handle(MCP_SERVER_STATUS, (e, message) =>
            mcpController.getServerStatus(getSenderWindow(e), message.serverName)
        );
        ipcMain.handle(MCP_GET_CATALOG, (e) =>
            mcpController.getCatalog(getSenderWindow(e))
        );

        // --- Registry ---
        ipcMain.handle(REGISTRY_FETCH_INDEX, (e, forceRefresh) =>
            registryController.fetchRegistryIndex(forceRefresh)
        );
        ipcMain.handle(REGISTRY_SEARCH, (e, query, filters) =>
            registryController.searchRegistry(query, filters)
        );
        ipcMain.handle(REGISTRY_GET_PACKAGE, (e, packageName) =>
            registryController.getPackage(packageName)
        );
        ipcMain.handle(REGISTRY_CHECK_UPDATES, (e, installedWidgets) =>
            registryController.checkUpdates(installedWidgets)
        );

        // --- Widget System ---
        setupWidgetRegistryHandlers();

        // --- Cache Management ---
        setupCacheHandlers();

        // --- Popout Windows ---
        ipcMain.handle("popout-open", (e, message) => {
            const wsId = String(message.workspaceId);
            const existing = popoutWindows.get(wsId);
            if (existing && !existing.isDestroyed()) {
                existing.focus();
                return { focused: true };
            }
            createPopoutWindow(wsId);
            return { opened: true };
        });
        ipcMain.handle("popout-set-title", (e, message) => {
            const wsId = String(message.workspaceId);
            const win = popoutWindows.get(wsId);
            if (win && !win.isDestroyed()) {
                win.setTitle(message.title);
            }
        });

        // --- Widget Popout Windows ---
        ipcMain.handle("widget-popout-open", (e, message) => {
            const key = `${message.workspaceId}:${message.widgetId}`;
            const existing = widgetPopoutWindows.get(key);
            if (existing && !existing.isDestroyed()) {
                existing.focus();
                return { focused: true };
            }
            createWidgetPopoutWindow(message.workspaceId, message.widgetId);
            return { opened: true };
        });
        ipcMain.handle("widget-popout-set-title", (e, message) => {
            const key = `${message.workspaceId}:${message.widgetId}`;
            const win = widgetPopoutWindows.get(key);
            if (win && !win.isDestroyed()) {
                win.setTitle(message.title);
            }
        });
        // --- Widget Event IPC Bridge ---
        // Broadcasts widget pub/sub events to all windows except the sender
        ipcMain.on("widget-event:publish", (e, message) => {
            for (const win of windows) {
                if (!win.isDestroyed() && win.webContents !== e.sender) {
                    win.webContents.send("widget-event:broadcast", message);
                }
            }
        });
    } // end ipcHandlersRegistered guard

    windows.add(mainWindow);

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
    buildMenu();
    createWindow();
});

app.on("window-all-closed", () => {
    mcpController.stopAllServers().catch((err) => {
        console.error("[electron] Error stopping MCP servers:", err);
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

    if (process.platform !== "darwin") {
        windows.delete(mainWindow);
        mainWindow = null;
        app.quit();
    }
});

app.on("activate", () => {
    if (windows.size === 0) {
        createWindow();
    }
});
