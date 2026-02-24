/**
 * layoutApi.js
 *
 * Handle the layout configuration file
 */
// ipcRenderer that must be used to invoke the events
const { ipcRenderer } = require("electron");

const { LAYOUT_LIST, LAYOUT_SAVE } = require("../events");

const layoutApi = {
    listLayoutsForApplication: (appId) =>
        ipcRenderer.invoke(LAYOUT_LIST, { appId }),
    saveLayoutForApplication: (appId, data) =>
        ipcRenderer.invoke(LAYOUT_SAVE, { appId, data }),
};

module.exports = layoutApi;
