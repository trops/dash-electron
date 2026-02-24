/**
 * registryApi.js
 *
 * Frontend API for the widget registry/marketplace.
 * Wraps IPC calls to the registryController in the main process.
 *
 * Usage:
 * mainApi.registry.search("weather")
 * mainApi.registry.getPackage("weather-widgets")
 * mainApi.registry.fetchIndex(true)
 * mainApi.registry.checkUpdates([{ name: "weather-widgets", version: "1.0.0" }])
 */

const { ipcRenderer } = require("electron");

const registryApi = {
    /**
     * Fetch the registry index (uses cache with 5-min TTL)
     * @param {boolean} forceRefresh - Force a fresh fetch bypassing cache
     * @returns {Promise<Object>} The registry index
     */
    fetchIndex: async (forceRefresh = false) => {
        try {
            return await ipcRenderer.invoke(
                "registry:fetch-index",
                forceRefresh
            );
        } catch (error) {
            console.error("[RegistryApi] Error fetching index:", error);
            throw error;
        }
    },

    /**
     * Search the registry for packages and widgets
     * @param {string} query - Search query
     * @param {Object} filters - Optional filters { category, author, tag }
     * @returns {Promise<Object>} { packages: [...], totalWidgets: number }
     */
    search: async (query = "", filters = {}) => {
        try {
            return await ipcRenderer.invoke("registry:search", query, filters);
        } catch (error) {
            console.error("[RegistryApi] Error searching registry:", error);
            throw error;
        }
    },

    /**
     * Get a specific package by name
     * @param {string} packageName - Name of the package
     * @returns {Promise<Object|null>} Package data or null
     */
    getPackage: async (packageName) => {
        try {
            return await ipcRenderer.invoke(
                "registry:get-package",
                packageName
            );
        } catch (error) {
            console.error(
                `[RegistryApi] Error getting package ${packageName}:`,
                error
            );
            throw error;
        }
    },

    /**
     * Check for updates to installed widgets
     * @param {Array<Object>} installedWidgets - Array of { name, version }
     * @returns {Promise<Array<Object>>} Widgets with available updates
     */
    checkUpdates: async (installedWidgets = []) => {
        try {
            return await ipcRenderer.invoke(
                "registry:check-updates",
                installedWidgets
            );
        } catch (error) {
            console.error("[RegistryApi] Error checking updates:", error);
            throw error;
        }
    },
};

module.exports = registryApi;
