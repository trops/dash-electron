/**
 * algoliaApi.js
 *
 * This is a stub sample that can be used as a template for other api's
 */
// ipcRenderer that must be used to invoke the events
const { ipcRenderer } = require("electron");
/**
 * Sample
 *
    const {
        ALGOLIA_LIST_INDICES,
    } = require('../events');
 */

const pluginApi = {
    // SAMPLE
    install: (packageName, filepath) =>
        ipcRenderer.invoke("plugin-install", { packageName, filepath }),
    uninstall: (filepath) => ipcRenderer.invoke("plugin-uninstall", filepath),
};

module.exports = pluginApi;
