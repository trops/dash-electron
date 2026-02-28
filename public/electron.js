/**
 * electron.js
 *
 * The main brain!
 *
 * This is where we will place all of the listeners. This is very important.
 */

const path = require("path");
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
// Use process.defaultApp or NODE_ENV check which are available before app is ready
const isDev = process.defaultApp || process.env.NODE_ENV === "development";
const pe = require("pluggable-electron/main");

const { updateElectronApp } = require("update-electron-app");

// Auto-update: checks update.electronjs.org every 10 minutes
// Only runs in production (packaged app), no-ops in development
if (!isDev && process.env.REACT_APP_GITHUB_USER && process.env.REACT_APP_GITHUB_REPO) {
    updateElectronApp();
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

    // Set Content-Security-Policy
    mainWindow.webContents.session.webRequest.onHeadersReceived(
        (details, callback) => {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    "Content-Security-Policy": [
                        isDev
                            ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' data: https://cdn.jsdelivr.net; worker-src 'self' blob:; connect-src 'self' https: http://localhost:3000 ws://localhost:3000"
                            : "default-src 'self'; script-src 'self' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data:; font-src 'self' data: https://cdn.jsdelivr.net; worker-src 'self' blob:; connect-src 'self' https:",
                    ],
                },
            });
        }
    );

    mainWindow.loadURL(
        isDev
            ? "http://localhost:3000"
            : `file://${path.join(__dirname, "../build/index.html")}`
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
                mainWindow,
                message,
                message.allowFile,
                message.extensions
            );
        });
        ipcMain.handle(CHOOSE_FILE_COMPLETE, (e, message) => {
            console.log("choose file complete ", e, message);
        });
        ipcMain.handle(CHOOSE_FILE_ERROR, (e, message) =>
            fileChosenError(mainWindow, message)
        );

        // --- Secure Storage ---
        ipcMain.handle(SECURE_STORE_ENCRYPTION_CHECK, (e, message) =>
            isEncryptionAvailable(mainWindow, message)
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
                        mainWindow?.webContents?.send(
                            "algolia-list-indices-complete",
                            filtered
                        );
                        return filtered;
                    } catch (err) {
                        mainWindow?.webContents?.send(
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
                    mainWindow,
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
                mainWindow,
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
                    mainWindow,
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
                    mainWindow,
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
            pluginInstall(mainWindow, message.packageName, message.filepath)
        );

        // --- Workspaces ---
        ipcMain.handle(WORKSPACE_LIST, (e, message) =>
            listWorkspacesForApplication(mainWindow, message.appId)
        );
        ipcMain.handle(WORKSPACE_SAVE, (e, message) =>
            saveWorkspaceForApplication(mainWindow, message.appId, message.data)
        );
        ipcMain.handle(WORKSPACE_DELETE, (e, message) =>
            deleteWorkspaceForApplication(
                mainWindow,
                message.appId,
                message.workspaceId
            )
        );

        // --- Menu Items (template-specific) ---
        ipcMain.handle(MENU_ITEMS_LIST, (e, message) =>
            listMenuItemsForApplication(mainWindow, message.appId)
        );
        ipcMain.handle(MENU_ITEMS_SAVE, (e, message) =>
            saveMenuItemForApplication(
                mainWindow,
                message.appId,
                message.menuItem
            )
        );

        // --- Themes ---
        ipcMain.handle("theme-list", (e, message) => {
            return listThemesForApplication(mainWindow, message.appId);
        });
        ipcMain.handle(THEME_SAVE, (e, message) =>
            saveThemeForApplication(
                mainWindow,
                message.appId,
                message.themeName,
                message.themeObject
            )
        );
        ipcMain.handle(THEME_DELETE, (e, message) =>
            deleteThemeForApplication(
                mainWindow,
                message.appId,
                message.themeKey
            )
        );

        // --- Layouts ---
        ipcMain.handle(LAYOUT_LIST, (e, message) =>
            listLayoutsForApplication(mainWindow, message.appId)
        );

        // --- Data ---
        ipcMain.handle(DATA_JSON_TO_CSV_FILE, (e, message) =>
            convertJsonToCsvFile(
                mainWindow,
                message.appId,
                message.jsonObject,
                message.filename
            )
        );
        ipcMain.handle(DATA_JSON_TO_CSV_STRING, (e, message) =>
            convertJsonToCsvFile(mainWindow, message.appId, message.jsonObject)
        );
        ipcMain.handle(PARSE_XML_STREAM, (e, message) => {
            const { filepath, outpath, start } = message;
            parseXMLStream(mainWindow, filepath, outpath, start);
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
                mainWindow,
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
            readLinesFromFile(mainWindow, filepath, lineCount);
        });
        ipcMain.handle(READ_JSON, (e, message) => {
            const { filepath, objectCount } = message;
            readJSONFromFile(mainWindow, filepath, objectCount);
        });
        ipcMain.handle(TRANSFORM_FILE, (e, message) => {
            const { filepath, outFilepath, mappingFunctionBody, args } =
                message;
            transformFile(
                mainWindow,
                filepath,
                outFilepath,
                mappingFunctionBody,
                args
            );
        });
        ipcMain.handle(EXTRACT_COLORS_FROM_IMAGE, (e, message) => {
            const { url } = message;
            extractColorsFromImageURL(mainWindow, url);
        });
        ipcMain.handle(DATA_SAVE_TO_FILE, (e, message) =>
            saveToFile(
                mainWindow,
                message.data,
                message.filename,
                message.append,
                message.returnEmpty
            )
        );
        ipcMain.handle(DATA_READ_FROM_FILE, (e, message) =>
            readFromFile(mainWindow, message.filename, message.returnEmpty)
        );
        ipcMain.handle(READ_DATA_URL, (e, message) =>
            readDataFromURL(mainWindow, message.url, message.toFilepath)
        );

        // --- Settings ---
        ipcMain.handle(SETTINGS_GET, (e, message) =>
            getSettingsForApplication(mainWindow)
        );
        ipcMain.handle(SETTINGS_SAVE, (e, message) =>
            saveSettingsForApplication(mainWindow, message.data)
        );
        ipcMain.handle(SETTINGS_GET_DATA_DIR, (e, message) =>
            getDataDirectory(mainWindow)
        );
        ipcMain.handle(SETTINGS_SET_DATA_DIR, (e, message) =>
            setDataDirectory(mainWindow, message.dataDirectory)
        );
        ipcMain.handle(SETTINGS_MIGRATE_DATA_DIR, (e, message) =>
            migrateDataDirectory(
                mainWindow,
                message.oldDirectory,
                message.newDirectory
            )
        );

        // --- OpenAI (template-specific) ---
        ipcMain.handle(OPENAI_DESCRIBE_IMAGE, (e, message) => {
            describeImage(
                mainWindow,
                message.imageUrl,
                message.apiKey,
                message.prompt
            );
        });

        // --- Providers ---
        ipcMain.handle(PROVIDER_SAVE, (e, message) =>
            saveProvider(
                mainWindow,
                message.appId,
                message.providerName,
                message.providerType,
                message.credentials,
                message.providerClass,
                message.mcpConfig
            )
        );
        ipcMain.handle(PROVIDER_LIST, (e, message) =>
            listProviders(mainWindow, message.appId)
        );
        ipcMain.handle(PROVIDER_GET, (e, message) =>
            getProvider(mainWindow, message.appId, message.providerName)
        );
        ipcMain.handle(PROVIDER_DELETE, (e, message) =>
            deleteProvider(mainWindow, message.appId, message.providerName)
        );

        // --- MCP ---
        ipcMain.handle(MCP_START_SERVER, (e, message) =>
            mcpController.startServer(
                mainWindow,
                message.serverName,
                message.mcpConfig,
                message.credentials
            )
        );
        ipcMain.handle(MCP_STOP_SERVER, (e, message) =>
            mcpController.stopServer(mainWindow, message.serverName)
        );
        ipcMain.handle(MCP_LIST_TOOLS, (e, message) =>
            mcpController.listTools(mainWindow, message.serverName)
        );
        ipcMain.handle(MCP_CALL_TOOL, (e, message) =>
            mcpController.callTool(
                mainWindow,
                message.serverName,
                message.toolName,
                message.args,
                message.allowedTools
            )
        );
        ipcMain.handle(MCP_LIST_RESOURCES, (e, message) =>
            mcpController.listResources(mainWindow, message.serverName)
        );
        ipcMain.handle(MCP_READ_RESOURCE, (e, message) =>
            mcpController.readResource(
                mainWindow,
                message.serverName,
                message.uri
            )
        );
        ipcMain.handle(MCP_SERVER_STATUS, (e, message) =>
            mcpController.getServerStatus(mainWindow, message.serverName)
        );
        ipcMain.handle(MCP_GET_CATALOG, () =>
            mcpController.getCatalog(mainWindow)
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
    } // end ipcHandlersRegistered guard

    windows.add(mainWindow);

    mainWindow.on("closed", () => {
        windows.delete(mainWindow);
        mainWindow = null;
    });
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
    createWindow();
});

app.on("window-all-closed", () => {
    mcpController.stopAllServers().catch((err) => {
        console.error("[electron] Error stopping MCP servers:", err);
    });
    clientCache.clear();
    responseCache.clear();

    if (process.platform !== "darwin") {
        windows.delete(mainWindow);
        mainWindow = null;
        app.quit();
    }
});

app.on("activate", () => {
    if (windows.size === 0) {
        console.log("activate");
    }
});
