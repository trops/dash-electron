/**
 * providerApi.js
 *
 * Handle provider (credentials) management - save, load, list providers
 * Communicates with main process via IPC to handle encryption and file storage
 */
const { ipcRenderer } = require("electron");
const {
    PROVIDER_SAVE,
    PROVIDER_LIST,
    PROVIDER_GET,
    PROVIDER_DELETE,
} = require("../events");

const providerApi = {
    /**
     * saveProvider
     * Save a new provider with encrypted credentials to providers.json
     * Promise-based version
     *
     * @param {String} appId - the appId specified in the dash initialization
     * @param {String} providerName - user-defined name (e.g., "Algolia Production")
     * @param {String} providerType - provider type (e.g., "algolia", "slack")
     * @param {Object} credentials - credentials object (shape depends on provider type)
     * @param {String} providerClass - "credential" (default) or "mcp"
     * @param {Object} mcpConfig - MCP server config (only for providerClass "mcp")
     * @returns {Promise}
     */
    saveProvider: (
        appId,
        providerName,
        providerType,
        credentials,
        providerClass = "credential",
        mcpConfig = null
    ) =>
        ipcRenderer.invoke(PROVIDER_SAVE, {
            appId,
            providerName,
            providerType,
            credentials,
            providerClass,
            mcpConfig,
        }),

    /**
     * listProviders
     * Get list of all available providers with decrypted credentials
     * Promise-based version
     *
     * @param {String} appId - the appId specified in the dash initialization
     * @returns {Promise<Array>} Array of provider objects with name, type, credentials
     */
    listProviders: (appId) => ipcRenderer.invoke(PROVIDER_LIST, { appId }),

    /**
     * getProvider
     * Get a specific provider by name with decrypted credentials
     * Promise-based version
     *
     * @param {String} appId - the appId specified in the dash initialization
     * @param {String} providerName - the provider name to retrieve
     * @returns {Promise<Object>} Provider object with name, type, credentials
     */
    getProvider: (appId, providerName) =>
        ipcRenderer.invoke(PROVIDER_GET, { appId, providerName }),

    /**
     * deleteProvider
     * Delete a provider from providers.json
     * Promise-based version
     *
     * @param {String} appId - the appId specified in the dash initialization
     * @param {String} providerName - the provider name to delete
     * @returns {Promise}
     */
    deleteProvider: (appId, providerName) =>
        ipcRenderer.invoke(PROVIDER_DELETE, { appId, providerName }),

    /**
     * listProvidersForApplication
     * Get list of all available providers with decrypted credentials
     * Event-listener-based version for use with ElectronDashboardApi
     *
     * @param {String} appId - the appId specified in the dash initialization
     */
    listProvidersForApplication: (appId) => {
        ipcRenderer
            .invoke(PROVIDER_LIST, { appId })
            .then((result) => {
                // Emit the event for ElectronDashboardApi to listen to
                ipcRenderer.send("PROVIDER_LIST_COMPLETE", result);
            })
            .catch((error) => {
                ipcRenderer.send("PROVIDER_LIST_ERROR", {
                    error: error.message,
                });
            });
    },

    /**
     * saveProviderForApplication
     * Save a new provider with encrypted credentials to providers.json
     * Event-listener-based version for use with ElectronDashboardApi
     */
    saveProviderForApplication: (
        appId,
        providerName,
        providerType,
        credentials
    ) => {
        ipcRenderer
            .invoke(PROVIDER_SAVE, {
                appId,
                providerName,
                providerType,
                credentials,
            })
            .then((result) => {
                ipcRenderer.send("PROVIDER_SAVE_COMPLETE", result);
            })
            .catch((error) => {
                ipcRenderer.send("PROVIDER_SAVE_ERROR", {
                    error: error.message,
                });
            });
    },

    /**
     * getProviderForApplication
     * Get a specific provider by name with decrypted credentials
     * Event-listener-based version for use with ElectronDashboardApi
     */
    getProviderForApplication: (appId, providerName) => {
        ipcRenderer
            .invoke(PROVIDER_GET, { appId, providerName })
            .then((result) => {
                ipcRenderer.send("PROVIDER_GET_COMPLETE", result);
            })
            .catch((error) => {
                ipcRenderer.send("PROVIDER_GET_ERROR", {
                    error: error.message,
                });
            });
    },

    /**
     * deleteProviderForApplication
     * Delete a provider from providers.json
     * Event-listener-based version for use with ElectronDashboardApi
     */
    deleteProviderForApplication: (appId, providerName) => {
        ipcRenderer
            .invoke(PROVIDER_DELETE, { appId, providerName })
            .then((result) => {
                ipcRenderer.send("PROVIDER_DELETE_COMPLETE", result);
            })
            .catch((error) => {
                ipcRenderer.send("PROVIDER_DELETE_ERROR", {
                    error: error.message,
                });
            });
    },
};

module.exports = providerApi;
