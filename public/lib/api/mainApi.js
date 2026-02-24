/**
 * mainApi.js
 *
 * All of your sub-apis will live in this file, simply import the api you create
 * and add to the mainApi. The mainApi will be exposed to the renderer using the electron bridge.
 *
 */
const { ipcRenderer, shell } = require("electron");
const secureStoreApi = require("./secureStoreApi");
const algoliaApi = require("./algoliaApi");
const pluginApi = require("./pluginApi");
const workspaceApi = require("./workspaceApi");
const layoutApi = require("./layoutApi");
const dataApi = require("./dataApi");
const settingsApi = require("./settingsApi");
const dialogApi = require("./dialogApi");
const openaiApi = require("./openaiApi");
const widgetApi = require("./widgetApi");
const providerApi = require("./providerApi");
const mcpApi = require("./mcpApi");
const registryApi = require("./registryApi");

// Events constants
const events = require("../events");
const menuItemsApi = require("./menuItemsApi");
const themeApi = require("./themeApi");

const mainApi = {
    // the main application identifier to STORE the data in the application folder.
    appId: null,

    setAppId: (appId) => {
        console.log("setting appId in the api ", appId);
        mainApi.appId = appId;
    },

    // keep these for general use
    on: (event, fn) => {
        ipcRenderer.addListener(event, fn);
    },
    removeAllListeners: (name = null) => {
        // can remove all listeners for event
        if (name) ipcRenderer.removeAllListeners(name);
    }, // this was removing too many listeners!
    removeListener: (name, fn) => ipcRenderer.removeListener(name, fn),

    // api's begin here
    algolia: algoliaApi,
    secureStoreApi: secureStoreApi,
    plugins: pluginApi,
    workspace: workspaceApi,
    layout: layoutApi,
    menuItems: menuItemsApi,
    themes: themeApi,
    data: { appId: this.appId, ...dataApi },
    settings: settingsApi,
    dialog: dialogApi,
    openai: openaiApi,
    widgets: widgetApi,
    providers: providerApi,
    mcp: mcpApi,
    registry: registryApi,

    shell: {
        openPath: (path) => shell.openPath(path),
        openExternal: (url) => {
            if (
                typeof url === "string" &&
                (url.startsWith("http://") || url.startsWith("https://"))
            ) {
                return shell.openExternal(url);
            }
        },
    },

    // included these in the bridge
    events: { ...events },

    publicEvents: events.public,

    pathPlugins: "", //path.join(app.getPath('userData'), 'plugins') || ''
};

module.exports = mainApi;
