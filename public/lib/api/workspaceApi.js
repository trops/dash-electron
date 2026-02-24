/**
 * workspaceApi.js
 *
 * Handle the workspace configuration file
 */
const { ipcRenderer } = require("electron");
const {
    WORKSPACE_LIST,
    WORKSPACE_SAVE,
    WORKSPACE_DELETE,
} = require("../events");

const workspaceApi = {
    /**
     * listWorkspacesForApplication
     * read the workspaces.json file in the app config directory
     * on the local user's machine and return the list of workspaces (dashboards)
     *
     * @param {String} appId the appId specified in the dash initialization
     */
    listWorkspacesForApplication: (appId) => {
        console.log("listWorkspacesForApplication called with appId:", appId);
        return ipcRenderer.invoke(WORKSPACE_LIST, { appId });
    },

    /**
     * saveWorkspaceForApplication
     * Save the new workspace to the workspaces.json config file
     * @param {String} appId
     * @param {Object} data
     * @returns
     */
    saveWorkspaceForApplication: (appId, data) =>
        ipcRenderer.invoke(WORKSPACE_SAVE, { appId, data }),

    /**
     * deleteWorkspaceForApplication
     * Delete a workspace from the workspaces.json config file
     * @param {String} appId
     * @param {String} workspaceId
     * @returns
     */
    deleteWorkspaceForApplication: (appId, workspaceId) =>
        ipcRenderer.invoke(WORKSPACE_DELETE, { appId, workspaceId }),
};

module.exports = workspaceApi;
