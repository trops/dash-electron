const { app } = require("electron");
const path = require("path");
const { writeFileSync } = require("fs");
const events = require("../events");
const { getFileContents } = require("../utils/file");

const configFilename = "menuItems.json";
const appName = "Dashboard";

const menuItemsController = {
    saveMenuItemForApplication: (win, appId, menuItem) => {
        try {
            // filename to the pages file (live pages)
            const filename = path.join(
                app.getPath("userData"),
                appName,
                appId,
                configFilename
            );
            const menuItemsArray = getFileContents(filename);

            menuItemsArray.filter((mi) => mi !== null);

            // add the menuItems object to the file
            menuItemsArray.push(menuItem);

            // write the new pages configuration back to the file
            writeFileSync(filename, JSON.stringify(menuItemsArray, null, 2));

            console.log("[menuItemsController] Menu item saved successfully");

            // Return the data for ipcMain.handle() - modern promise-based approach
            return {
                menuItems: menuItemsArray,
                success: true,
            };
        } catch (e) {
            console.error("[menuItemsController] Error saving menu item:", e);
            // Return error object with empty menu items array
            return {
                error: true,
                message: e.message,
                menuItems: [],
            };
        }
    },

    /**
     * removePage
     * Remove the page from the pages.json
     * @param {*} win
     * @param {*} appId
     * @param {*} pageId
     */
    // removePage:(win, appId, pageId) => {
    //     try {
    //         if (pageId !== null && appId !== null) {
    //             const filename = path.join(app.getPath('userData'), "Sitehub", appId, "pages.json");
    //             const pagesArray = getFileContents(filename);
    //             // remove all pages with the old page id
    //             const pages = pagesArray.filter(p => p.id !== pageId);
    //             // lets write this new
    //             writeFileSync(filename, JSON.stringify(pages, null, 2));
    //             win.webContents.send(events.PAGE_REMOVE_PAGE_COMPLETE, pages);
    //         } else {
    //             win.webContents.send(events.PAGE_REMOVE_PAGE_ERROR, { error: true, message: "Invalid Page Data" });
    //         }
    //     } catch(e) {
    //         console.log('remove page ', e.message);
    //         win.webContents.send(events.PAGE_REMOVE_PAGE_ERROR, { error: true, message: e.message });
    //     }
    // },

    listMenuItemsForApplication: (win, appId) => {
        try {
            const filename = path.join(
                app.getPath("userData"),
                appName,
                appId,
                configFilename
            );
            const menuItemsArray = getFileContents(filename);
            const filtered = menuItemsArray.filter((mi) => mi !== null);
            // Return the data for ipcMain.handle() - modern promise-based approach
            return {
                menuItems: filtered,
            };
        } catch (e) {
            console.error("[menuItemsController] Error listing menu items:", e);
            // Return error object with empty menu items array
            return {
                error: true,
                message: e.message,
                menuItems: [],
            };
        }
    },
};

module.exports = menuItemsController;
