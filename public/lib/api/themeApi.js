/**
 * themeApi.js
 *
 * Handle the theme configuration file
 */

const { ipcRenderer } = require("electron");

const { THEME_LIST, THEME_SAVE, THEME_DELETE } = require("../events");

const themeApi = {
    listThemesForApplication: (appId) =>
        ipcRenderer.invoke(THEME_LIST, { appId }),
    saveThemeForApplication: (appId, themeName, themeObject) =>
        ipcRenderer.invoke(THEME_SAVE, { appId, themeName, themeObject }),
    deleteThemeForApplication: (appId, themeKey) =>
        ipcRenderer.invoke(THEME_DELETE, { appId, themeKey }),
};

module.exports = themeApi;
