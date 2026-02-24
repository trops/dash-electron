const { contextBridge } = require("electron");
const { defaultMainApi } = require("@trops/dash-core/electron");

// Expose the context bridge for renderer -> main communication
contextBridge.exposeInMainWorld("mainApi", defaultMainApi);
