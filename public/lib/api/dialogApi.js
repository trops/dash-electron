/**
 * layoutApi.js
 *
 * Handle the layout configuration file
 */
// ipcRenderer that must be used to invoke the events
const { ipcRenderer } = require("electron");

const { CHOOSE_FILE } = require("../events");

const dialogApi = {
    /**
     * chooseFile
     * @param {*} allowFile if false, will allow only directory selection
     * @param {*} extensions the file extensions allowed
     */
    chooseFile: (allowFile = true, extensions = ["*"]) => {
        console.log("dialog api choose file");
        return ipcRenderer.invoke(CHOOSE_FILE, { allowFile, extensions });
    },
};

module.exports = dialogApi;
