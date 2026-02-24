const { app } = require("electron");
const path = require("path");
const { writeFileSync } = require("fs");
const events = require("../events");
const { getFileContents } = require("../utils/file");

const configFilename = "workspaces.json";
const appName = "Dashboard";

const workspaceController = {
    /**
     * createWorkspace
     *
     * Use a simple scaffold to create the Page skeleton for the user
     *
     * @param {BrowserWindow} win the main window
     * @param {string} appId the application id from Algolia
     * @param {object} page the page configuration file
     */
    /*
    "id": "<page-id-here>",
    "package":"",
    "repository":"",
    "author": "<user-name>",
    "version": "1",
    "displayName": "<page-display-name>",
    "indexName": "<algolia-index-name>",
    "date_created": "",
    "date_edited": "",
    "administration": {
      "context": false,
      "searchBox": true,
      "query": false
    },
    "layout": {}
    }
        */

    /**
     * saveWorkspace
     * Create a workspace from a json configuration object (no template)
     *
     * @param {BrowserWindow} win the main window
     * @param {string} appId the application id
     * @param {object} pageObject the page config object
     */
    saveWorkspaceForApplication: (win, appId, workspaceObject) => {
        try {
            // filename to the pages file (live pages)
            const filename = path.join(
                app.getPath("userData"),
                appName,
                appId,
                configFilename
            );
            const workspacesArray = getFileContents(filename);

            // lets check to see if we already have this one!
            let indexOfExistingItem = null;
            workspacesArray.forEach((element, index) => {
                if (element["id"] === workspaceObject["id"]) {
                    indexOfExistingItem = index;
                }
            });

            // replace item if we have an id already matching our input object
            if (indexOfExistingItem !== null) {
                // update the existing workspace item
                workspacesArray[indexOfExistingItem] = workspaceObject;
            } else {
                // add the pageObject to the pages file
                workspacesArray.push(workspaceObject);
            }

            // write the new pages configuration back to the file
            writeFileSync(filename, JSON.stringify(workspacesArray, null, 2));

            console.log("[workspaceController] Workspace saved successfully");

            // Return the data for ipcMain.handle() - modern promise-based approach
            return {
                workspaces: workspacesArray,
                success: true,
            };
        } catch (e) {
            console.error("[workspaceController] Error saving workspace:", e);
            // Return error object with empty workspaces array
            return {
                error: true,
                message: e.message,
                workspaces: [],
            };
        }
    },

    saveMenuItemsForApplication: (win, appId, menuItems) => {
        try {
            // filename to the workspaces file
            const filename = path.join(
                app.getPath("userData"),
                appName,
                appId,
                configFilename
            );
            const workspacesArray = getFileContents(filename);

            // Update menu items for workspaces
            // This assumes menuItems is an object with workspace IDs as keys
            // and updates the menuId property for each workspace
            if (menuItems && typeof menuItems === "object") {
                workspacesArray.forEach((workspace, index) => {
                    if (menuItems[workspace.id]) {
                        workspacesArray[index].menuId = menuItems[workspace.id];
                    }
                });
            }

            // write the updated workspaces configuration back to the file
            writeFileSync(filename, JSON.stringify(workspacesArray, null, 2));

            console.log("[workspaceController] Menu items saved successfully");

            // Return the data for ipcMain.handle() - modern promise-based approach
            return {
                workspaces: workspacesArray,
                success: true,
            };
        } catch (e) {
            console.error("[workspaceController] Error saving menu items:", e);
            // Return error object with empty workspaces array
            return {
                error: true,
                message: e.message,
                workspaces: [],
            };
        }
    },

    /**
     * loadPagesForApplication
     * Load the pages for the application <userdata>/appId/pages.json
     *
     * @param {BrowserWindow} win the main window
     * @param {string} appId the application id from Algolia
     */
    deleteWorkspaceForApplication: (win, appId, workspaceId) => {
        try {
            const filename = path.join(
                app.getPath("userData"),
                appName,
                appId,
                configFilename
            );
            const workspacesArray = getFileContents(filename);

            const filtered = workspacesArray.filter(
                (workspace) => workspace.id !== workspaceId
            );

            writeFileSync(filename, JSON.stringify(filtered, null, 2));

            console.log(
                `[workspaceController] Workspace ${workspaceId} deleted successfully`
            );

            return {
                workspaces: filtered,
                success: true,
            };
        } catch (e) {
            console.error("[workspaceController] Error deleting workspace:", e);
            return {
                error: true,
                message: e.message,
                workspaces: [],
            };
        }
    },

    listWorkspacesForApplication: (win, appId) => {
        try {
            const filename = path.join(
                app.getPath("userData"),
                appName,
                appId,
                configFilename
            );

            const workspacesArray = getFileContents(filename);
            console.log(
                `[workspaceController] Loaded ${workspacesArray.length} workspaces for appId: ${appId}`
            );
            // Return the data for ipcMain.handle() - modern promise-based approach
            return {
                workspaces: workspacesArray,
            };
        } catch (e) {
            console.error("[workspaceController] Error listing workspaces:", e);
            // Return error object with empty workspaces array
            return {
                error: true,
                message: e.message,
                workspaces: [],
            };
        }
    },

    listMenuItemsForApplication: (win, appId) => {
        try {
            const filename = path.join(
                app.getPath("userData"),
                appName,
                appId,
                configFilename
            );
            const workspacesArray = getFileContents(filename);

            // Extract unique menu items from workspaces
            // Each workspace can have a menuId, we need to build the menu items list
            const menuItemsMap = new Map();

            workspacesArray.forEach((workspace) => {
                if (workspace.menuId) {
                    if (!menuItemsMap.has(workspace.menuId)) {
                        menuItemsMap.set(workspace.menuId, {
                            id: workspace.menuId,
                            name:
                                workspace.name ||
                                `Menu Item ${workspace.menuId}`,
                            // Add other menu item properties as needed
                        });
                    }
                }
            });

            const menuItemsArray = Array.from(menuItemsMap.values());

            // Return the menu items data for ipcMain.handle()
            return {
                menuItems: menuItemsArray,
            };
        } catch (e) {
            console.error("[workspaceController] Error listing menu items:", e);
            // Return error object with empty menu items array
            return {
                error: true,
                message: e.message,
                menuItems: [],
            };
        }
    },
};

module.exports = workspaceController;
