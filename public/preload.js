const { contextBridge, ipcRenderer } = require("electron");
const mainApi = require("./lib/api");

// Expose the context bridge for renderer -> main communication
contextBridge.exposeInMainWorld("mainApi", mainApi);
