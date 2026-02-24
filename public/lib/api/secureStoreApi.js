const { ipcRenderer } = require("electron");
const {
    SECURE_STORE_ENCRYPTION_CHECK,
    SECURE_STORE_SET_DATA,
    SECURE_STORE_GET_DATA,
} = require("../events");
/**
 * secureStoreApi
 * - for Apple, keychain methods
 */
const secureStoreApi = {
    isEncryptionAvailable: () =>
        ipcRenderer.invoke(SECURE_STORE_ENCRYPTION_CHECK, {}),
    saveData: (key, value) =>
        ipcRenderer.invoke(SECURE_STORE_SET_DATA, { key, value }),
    getData: (key) => ipcRenderer.invoke(SECURE_STORE_GET_DATA, { key }),
};

module.exports = secureStoreApi;
