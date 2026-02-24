const { app } = require("electron");
const path = require("path");
const { writeFileSync } = require("fs");
const events = require("../events");
const { getFileContents } = require("../utils/file");

const configFilename = "layouts.json";
const appName = "Dashboard";

const layoutController = {
    /**
     * saveLayout
     * Create a workspace from a json configuration object (no template)
     *
     * @param {BrowserWindow} win the main window
     * @param {string} appId the application id
     * @param {object} pageObject the page config object
     */
    saveLayoutForApplication: (win, appId, layoutObject) => {
        try {
            // filename to the pages file (live pages)
            const filename = path.join(
                app.getPath("userData"),
                appName,
                appId,
                configFilename
            );
            const layoutsArray = getFileContents(filename);

            // add the pageObject to the pages file
            layoutsArray.push(layoutObject);

            // write the new pages configuration back to the file
            writeFileSync(filename, JSON.stringify(layoutsArray, null, 2));

            // message the renderer
            win.webContents.send(events.LAYOUT_SAVE_COMPLETE, {
                layouts: layoutsArray,
            });
        } catch (e) {
            win.webContents.send(events.LAYOUT_SAVE_ERROR, {
                error: e.message,
            });
        }
    },

    /**
     *
     *
     * @param {BrowserWindow} win the main window
     * @param {string} appId the application id from Algolia
     */
    listLayoutsForApplication: (win, appId) => {
        try {
            const filename = path.join(
                app.getPath("userData"),
                appName,
                appId,
                configFilename
            );
            const layoutsArray = getFileContents(filename);
            win.webContents.send(events.LAYOUT_LIST_COMPLETE, {
                layouts: layoutsArray,
            });
        } catch (e) {
            win.webContents.send(events.LAYOUT_LIST_COMPLETE, {
                error: true,
                message: e.message,
            });
        }
    },
};

module.exports = layoutController;
