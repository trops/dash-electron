/**
 * secureStore
 */
const { safeStorage } = require("electron");
const Store = require("electron-store");
const events = require("../events");

const schema = {
    appId: {
        type: "string",
    },
    apiKey: {
        type: "string",
    },
};

const isEncryptionAvailable = (win) => {
    const result = safeStorage.isEncryptionAvailable();
    win.webContents.send(events.SECURE_STORE_ENCRYPTION_CHECK_COMPLETE, result);
};

const encryptString = (win, str) => {
    const result = safeStorage.encryptString(str);
    win.webContents.send("secure-storage-encrypt-string-complete", result);
};

const decryptString = (win, str) => {
    const result = safeStorage.decryptString(str);
    win.webContents.send("secure-storage-decrypt-string-complete", result);
};

const saveData = (key, value) => {
    try {
        const store = new Store({ schema });
        store.set(key, value);
        return getData(key);
    } catch (e) {
        return { data: null };
    }
};

const getData = (key) => {
    try {
        const store = new Store({ schema });
        const value = store.get(key);
        if (value) {
            return { [key]: value };
        } else {
            return null;
        }
    } catch (e) {
        return null;
    }
};

module.exports = {
    isEncryptionAvailable,
    encryptString,
    decryptString,
    saveData,
    getData,
};
