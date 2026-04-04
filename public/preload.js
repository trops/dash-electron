const { contextBridge, ipcRenderer } = require("electron");
const { defaultMainApi } = require("@trops/dash-core/electron");

const extendedApi = {
    ...defaultMainApi,
    popout: {
        open: (workspaceId) =>
            ipcRenderer.invoke("popout-open", { workspaceId }),
        setTitle: (workspaceId, title) =>
            ipcRenderer.invoke("popout-set-title", { workspaceId, title }),
    },
    widgetPopout: {
        open: (workspaceId, widgetId) =>
            ipcRenderer.invoke("widget-popout-open", {
                workspaceId,
                widgetId,
            }),
        setTitle: (workspaceId, widgetId, title) =>
            ipcRenderer.invoke("widget-popout-set-title", {
                workspaceId,
                widgetId,
                title,
            }),
    },
    algolia: {
        ...defaultMainApi.algolia,
        listIndices: (msg) => ipcRenderer.invoke("algolia-list-indices", msg),
        browseObjectsToFile: (msg) =>
            ipcRenderer.invoke("algolia-browse-objects", msg),
        search: (msg) => ipcRenderer.invoke("algolia-search", msg),
        partialUpdateObjectsFromDirectory: (msg) =>
            ipcRenderer.invoke("algolia-partial-update-objects", msg),
        getSettings: (msg) => ipcRenderer.invoke("algolia-get-settings", msg),
        setSettings: (msg) => ipcRenderer.invoke("algolia-set-settings", msg),
        getAnalyticsForQuery: (msg) =>
            ipcRenderer.invoke("algolia-analytics-for-query", msg),
    },
    clientCache: {
        invalidate: (appId, providerName) =>
            ipcRenderer.invoke("client-cache-invalidate", {
                appId,
                providerName,
            }),
        invalidateAll: () => ipcRenderer.invoke("client-cache-invalidate-all"),
    },
    responseCache: {
        clear: () => ipcRenderer.invoke("response-cache-clear"),
        stats: () => ipcRenderer.invoke("response-cache-stats"),
    },
    widgetBuilder: {
        aiBuild: (widgetName, componentCode, configCode, description) =>
            ipcRenderer.invoke("widget:ai-build", {
                widgetName,
                componentCode,
                configCode,
                description,
            }),
    },
    debug: {
        open: () => ipcRenderer.invoke("debug-window-open"),
        close: () => ipcRenderer.invoke("debug-window-close"),
        getApiCatalog: () => ipcRenderer.invoke("debug-api-catalog"),
        onLogEntry: (callback) => {
            const handler = (_event, entry) => callback(entry);
            ipcRenderer.on("debug:log-entry", handler);
            return () => ipcRenderer.removeListener("debug:log-entry", handler);
        },
    },
};

// Expose the context bridge for renderer -> main communication
contextBridge.exposeInMainWorld("mainApi", extendedApi);
