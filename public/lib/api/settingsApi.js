/**
 * settingsApi.js
 *
 * Handle the settings configuration file
 */
// ipcRenderer that must be used to invoke the events
const { ipcRenderer } = require("electron");

const {
    SETTINGS_GET,
    SETTINGS_SAVE,
    SETTINGS_GET_DATA_DIR,
    SETTINGS_SET_DATA_DIR,
    SETTINGS_MIGRATE_DATA_DIR,
} = require("../events");

const settingsApi = {
    getSettingsForApplication: () => ipcRenderer.invoke(SETTINGS_GET, {}),
    saveSettingsForApplication: (data) =>
        ipcRenderer.invoke(SETTINGS_SAVE, { data }),
    getDataDirectory: () => ipcRenderer.invoke(SETTINGS_GET_DATA_DIR, {}),
    setDataDirectory: (dataDirectory) =>
        ipcRenderer.invoke(SETTINGS_SET_DATA_DIR, { dataDirectory }),
    migrateDataDirectory: (oldDirectory, newDirectory) =>
        ipcRenderer.invoke(SETTINGS_MIGRATE_DATA_DIR, {
            oldDirectory,
            newDirectory,
        }),
};

module.exports = settingsApi;
