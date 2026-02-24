/**
 * dialogController.js
 *
 * Open a dialog window for choosing files
 */
const { dialog } = require("electron");
const events = require("../events");

const showDialog = async (win, message, allowFile, extensions = ["*"]) => {
    const properties =
        allowFile === true
            ? ["openFile"]
            : ["openDirectory", "createDirectory"];
    const filters = allowFile === true ? [{ name: "Data", extensions }] : [];
    const result = await dialog.showOpenDialog({ properties, filters });
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
};

const fileChosenError = (win, message) => {
    win.webContents.send(events.CHOOSE_FILE_ERROR, message);
};

module.exports = {
    showDialog,
    fileChosenError,
};
