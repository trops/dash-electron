const { contextBridge } = require("electron");
const { createMainApi } = require("@trops/dash-core/electron");

// Template-specific APIs
const algoliaApi = require("./lib/api/algoliaApi");
const openaiApi = require("./lib/api/openaiApi");
const menuItemsApi = require("./lib/api/menuItemsApi");
const pluginApi = require("./lib/api/pluginApi");

// Create mainApi with core APIs (from dash-core) + template extensions
const mainApi = createMainApi({
    algolia: algoliaApi,
    openai: openaiApi,
    menuItems: menuItemsApi,
    plugins: pluginApi,
});

// Expose the context bridge for renderer -> main communication
contextBridge.exposeInMainWorld("mainApi", mainApi);
