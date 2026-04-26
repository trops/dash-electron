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
    workspaceSilent: {
        save: (appId, data) =>
            ipcRenderer.invoke("workspace-save-silent", { appId, data }),
        notifySaved: () => ipcRenderer.invoke("workspace:notify-saved"),
    },
    widgetBuilder: {
        compilePreview: (
            widgetName,
            componentCode,
            configCode,
            sourcePackage,
            files
        ) =>
            ipcRenderer.invoke("widget:ai-compile-preview", {
                widgetName,
                componentCode,
                configCode,
                sourcePackage,
                // Multi-file payload (Phase 2). When present, the main
                // process writes every file before compiling so esbuild
                // can resolve sibling imports. Optional —
                // componentCode/configCode alone still work for legacy
                // single-file widgets.
                files,
            }),
        aiBuild: (
            widgetName,
            componentCode,
            configCode,
            description,
            cellContext,
            appId,
            remixMeta,
            files
        ) =>
            ipcRenderer.invoke("widget:ai-build", {
                widgetName,
                componentCode,
                configCode,
                description,
                cellContext,
                appId,
                remixMeta,
                // Multi-file payload (Phase 2): each entry is
                // { path, content } relative to the package root. When
                // present and non-empty, the main process writes ALL
                // listed files instead of just the legacy
                // componentCode+configCode pair. componentCode/configCode
                // are still passed alongside for the post-install
                // category injection + ComponentManager registration
                // path which keys off the primary widget.
                files,
            }),
        readSources: (widgetName, componentName) =>
            ipcRenderer.invoke("widget:read-sources", {
                widgetName,
                componentName,
            }),
    },
    aiAssistant: {
        // Probes Claude CLI availability, esbuild native helper
        // availability, and @ai-built/ directory writability. Returns
        // a structured object with per-check ok/error/diagnostics so
        // the UI can show a banner with the actual problem instead of
        // letting the user hit an opaque ENOENT mid-compile.
        healthCheck: () => ipcRenderer.invoke("ai-assistant:health-check"),
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
