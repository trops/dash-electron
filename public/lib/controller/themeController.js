const { app } = require("electron");
const path = require("path");
const { writeFileSync } = require("fs");
const events = require("../events");
const { getFileContents } = require("../utils/file");

const configFilename = "themes.json";
const appName = "Dashboard";

const themeController = {
    /**
     * saveTheme
     * Create a new Theme that can be used in the application
     * (can have several themes per application)
     *
     * @param {BrowserWindow} win the main window
     * @param {string} appId the application id
     * @param {object} themeObject the theme object
     */
    saveThemeForApplication: (win, appId, name, obj) => {
        try {
            // filename to the pages file (live pages)
            const filename = path.join(
                app.getPath("userData"),
                appName,
                appId,
                configFilename
            );
            const data = getFileContents(filename, {});

            // Add/update the theme based on the name
            if (name in data === false) {
                data[name] = {};
            }

            data[name] = obj;

            // write the new pages configuration back to the file
            writeFileSync(filename, JSON.stringify(data, null, 2));

            console.log("[themeController] Theme saved successfully");

            // Return the data for ipcMain.handle() - modern promise-based approach
            return {
                themes: data,
                key: name,
                theme: obj,
                success: true,
            };
        } catch (e) {
            console.error("[themeController] Error saving theme:", e);
            // Return error object
            return {
                error: true,
                message: e.message,
                themes: {},
            };
        }
    },

    /**
     * listThemesForApplication
     *
     * @param {BrowserWindow} win the main window
     * @param {string} appId the application id from Algolia
     */
    listThemesForApplication: (win, appId) => {
        try {
            const filename = path.join(
                app.getPath("userData"),
                appName,
                appId,
                configFilename
            );

            const data = getFileContents(filename, {});

            console.log(
                "[themeController] Loading themes from:",
                filename,
                "Found:",
                Object.keys(data).length,
                "themes"
            );

            // Return the data for ipcMain.handle() - modern promise-based approach
            return {
                themes: data,
            };
        } catch (e) {
            console.error("[themeController] Error loading themes:", e);
            // Return error object with empty themes
            return {
                error: true,
                message: e.message,
                themes: {},
            };
        }
    },

    /**
     * deleteThemeForApplication
     * Delete a theme from the application's theme configuration
     *
     * @param {BrowserWindow} win the main window
     * @param {string} appId the application id
     * @param {string} themeKey the key of the theme to delete
     */
    deleteThemeForApplication: (win, appId, themeKey) => {
        try {
            const filename = path.join(
                app.getPath("userData"),
                appName,
                appId,
                configFilename
            );
            const data = getFileContents(filename, {});

            if (themeKey in data) {
                delete data[themeKey];
                writeFileSync(filename, JSON.stringify(data, null, 2));
            }

            console.log(
                "[themeController] Theme deleted successfully:",
                themeKey
            );

            return {
                themes: data,
                success: true,
            };
        } catch (e) {
            console.error("[themeController] Error deleting theme:", e);
            return {
                error: true,
                message: e.message,
                themes: {},
            };
        }
    },
};

module.exports = themeController;
