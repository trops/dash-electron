/**
 * index.js
 *
 * Add all of your methods that have been exported for convenience.
 */
const { showDialog, fileChosenError } = require("./dialogController");
const {
    isEncryptionAvailable,
    saveData,
    getData,
} = require("./secureStoreController");
const {
    listIndices,
    partialUpdateObjectsFromDirectory,
    createBatchesFromFile,
    browseObjectsToFile,
} = require("./algoliaController");
const {
    listWorkspacesForApplication,
    saveWorkspaceForApplication,
    deleteWorkspaceForApplication,
} = require("./workspaceController");
const {
    saveMenuItemForApplication,
    listMenuItemsForApplication,
} = require("./menuItemsController");
const {
    saveThemeForApplication,
    listThemesForApplication,
    deleteThemeForApplication,
} = require("./themeController");
const {
    convertJsonToCsvFile,
    convertJsonToCsvString,
    saveToFile,
    readFromFile,
    parseXMLStream,
    parseCSVStream,
    readLinesFromFile,
    transformFile,
    readJSONFromFile,
    readDataFromURL,
    extractColorsFromImageURL,
} = require("./dataController");
const {
    saveSettingsForApplication,
    getSettingsForApplication,
    getDataDirectory,
    setDataDirectory,
    migrateDataDirectory,
} = require("./settingsController");
const { describeImage } = require("./openaiController");
const {
    saveProvider,
    listProviders,
    getProvider,
    deleteProvider,
} = require("./providerController");

module.exports = {
    showDialog,
    fileChosenError,
    isEncryptionAvailable,
    listIndices,
    saveData,
    getData,
    listWorkspacesForApplication,
    saveWorkspaceForApplication,
    deleteWorkspaceForApplication,
    saveMenuItemForApplication,
    listMenuItemsForApplication,
    saveThemeForApplication,
    listThemesForApplication,
    deleteThemeForApplication,
    convertJsonToCsvFile,
    convertJsonToCsvString,
    parseXMLStream,
    parseCSVStream,
    readLinesFromFile,
    saveToFile,
    readFromFile,
    saveSettingsForApplication,
    getSettingsForApplication,
    describeImage,
    partialUpdateObjectsFromDirectory,
    createBatchesFromFile,
    transformFile,
    browseObjectsToFile,
    readJSONFromFile,
    readDataFromURL,
    extractColorsFromImageURL,
    saveProvider,
    listProviders,
    getProvider,
    deleteProvider,
    getDataDirectory,
    setDataDirectory,
    migrateDataDirectory,
};
