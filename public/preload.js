const { contextBridge, ipcRenderer } = require("electron");
const { defaultMainApi } = require("@trops/dash-core/electron");

const extendedApi = {
    ...defaultMainApi,
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
};

// Expose the context bridge for renderer -> main communication
contextBridge.exposeInMainWorld("mainApi", extendedApi);
