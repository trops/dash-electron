/**
 * settingsController
 */

const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const events = require("../events");
const { getFileContents, writeToFile } = require("../utils/file");

const configFilename = "settings.json";
const appName = "Dashboard";

// Helper function to recursively copy directory
function copyDirectory(source, destination) {
    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
    }

    const files = fs.readdirSync(source);
    for (const file of files) {
        const srcPath = path.join(source, file);
        const destPath = path.join(destination, file);
        const stat = fs.lstatSync(srcPath);

        // Skip symlinks to prevent following links to sensitive files
        if (stat.isSymbolicLink()) {
            console.warn(`[settingsController] Skipping symlink: ${srcPath}`);
            continue;
        }

        if (stat.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

const settingsController = {
    /**
     * saveSettingsForApplication
     * Save the settings object to a file (settings.json)
     * @param {BrowserWindow} win
     * @param {Object} data the settings object to be saved
     */
    saveSettingsForApplication: (win, data) => {
        try {
            if (data) {
                // <appId>/settings.json
                const filename = path.join(
                    app.getPath("userData"),
                    appName,
                    configFilename
                );
                writeToFile(filename, JSON.stringify(data, null, 2));
                console.log("[settingsController] Settings saved successfully");
                // Return the data for ipcMain.handle() - modern promise-based approach
                return {
                    success: true,
                    settings: data,
                };
            } else {
                return {
                    error: true,
                    message: "No Settings Data provided",
                };
            }
        } catch (e) {
            console.error("[settingsController] Error saving settings:", e);
            return {
                error: true,
                message: e.message,
            };
        }
    },

    /**
     * getSettingsForApplication
     * Get the settings for the entire application, not application ID specific
     * We can write different settings into this file but save ALL into one object.
     * @param {BrowserWindow} win
     */
    getSettingsForApplication: (win) => {
        try {
            // <appId>/settings.json
            const filename = path.join(
                app.getPath("userData"),
                appName,
                configFilename
            );
            // make sure the file exists...
            const fileContents = getFileContents(filename, {});
            console.log("[settingsController] Settings loaded successfully");
            // Return the data for ipcMain.handle() - modern promise-based approach
            return {
                success: true,
                settings: fileContents,
            };
        } catch (e) {
            console.error("[settingsController] Error loading settings:", e);
            return {
                error: true,
                message: e.message,
                settings: {},
            };
        }
    },

    /**
     * getDataDirectory
     * Get the current user data directory path
     * Returns the default if not set by user
     * @param {BrowserWindow} win
     */
    getDataDirectory: (win) => {
        try {
            const settingsPath = path.join(
                app.getPath("userData"),
                appName,
                configFilename
            );
            const settings = getFileContents(settingsPath, {});
            const userDataDir =
                settings.userDataDirectory ||
                path.join(app.getPath("userData"), appName);

            console.log(
                "[settingsController] Data directory retrieved successfully"
            );
            // Return the data for ipcMain.handle() - modern promise-based approach
            return {
                success: true,
                dataDirectory: userDataDir,
                isDefault: !settings.userDataDirectory,
            };
        } catch (e) {
            console.error(
                "[settingsController] Error getting data directory:",
                e
            );
            return {
                error: true,
                message: e.message,
            };
        }
    },

    /**
     * setDataDirectory
     * Validate and set a new user data directory
     * @param {BrowserWindow} win
     * @param {String} newPath the new directory path
     */
    setDataDirectory: (win, newPath) => {
        try {
            // Validate the path exists and is a directory
            if (!fs.existsSync(newPath)) {
                fs.mkdirSync(newPath, { recursive: true });
            }

            const stats = fs.statSync(newPath);
            if (!stats.isDirectory()) {
                throw new Error("Path is not a directory");
            }

            // Update settings
            const settingsPath = path.join(
                app.getPath("userData"),
                appName,
                configFilename
            );
            const settings = getFileContents(settingsPath, {});
            settings.userDataDirectory = newPath;
            writeToFile(settingsPath, JSON.stringify(settings, null, 2));

            console.log("[settingsController] Data directory set successfully");
            // Return the data for ipcMain.handle() - modern promise-based approach
            return {
                success: true,
                dataDirectory: newPath,
            };
        } catch (e) {
            console.error(
                "[settingsController] Error setting data directory:",
                e
            );
            return {
                error: true,
                message: e.message,
            };
        }
    },

    /**
     * migrateDataDirectory
     * Copy all files from old data directory to new one
     * @param {BrowserWindow} win
     * @param {String} oldPath the old directory path
     * @param {String} newPath the new directory path
     */
    migrateDataDirectory: (win, oldPath, newPath) => {
        try {
            // Resolve paths to prevent traversal
            const resolvedOldPath = path.resolve(oldPath);
            const resolvedNewPath = path.resolve(newPath);

            // Validate oldPath is the current configured data directory
            const settingsCheckPath = path.join(
                app.getPath("userData"),
                appName,
                configFilename
            );
            const currentSettings = getFileContents(settingsCheckPath, {});
            const currentDataDir =
                currentSettings.userDataDirectory ||
                path.join(app.getPath("userData"), appName);
            if (resolvedOldPath !== path.resolve(currentDataDir)) {
                throw new Error(
                    "Source path must be the current data directory"
                );
            }

            // Block system directories as targets
            const blockedPrefixes = [
                "/System",
                "/usr",
                "/bin",
                "/etc",
                "/var",
                "/sbin",
                "/lib",
            ];
            for (const prefix of blockedPrefixes) {
                if (
                    resolvedNewPath.startsWith(prefix + "/") ||
                    resolvedNewPath === prefix
                ) {
                    throw new Error(
                        "Cannot migrate to a system directory: " + prefix
                    );
                }
            }

            // Validate paths
            if (!fs.existsSync(resolvedOldPath)) {
                throw new Error("Source directory does not exist");
            }

            if (!fs.existsSync(resolvedNewPath)) {
                fs.mkdirSync(resolvedNewPath, { recursive: true });
            }

            // Copy files
            copyDirectory(resolvedOldPath, resolvedNewPath);

            // Update settings to use new path
            const settingsPath = path.join(
                app.getPath("userData"),
                appName,
                configFilename
            );
            const settings = getFileContents(settingsPath, {});
            settings.userDataDirectory = resolvedNewPath;
            writeToFile(settingsPath, JSON.stringify(settings, null, 2));

            console.log(
                "[settingsController] Data directory migrated successfully"
            );
            // Return the data for ipcMain.handle() - modern promise-based approach
            return {
                success: true,
                oldDirectory: resolvedOldPath,
                newDirectory: resolvedNewPath,
            };
        } catch (e) {
            console.error(
                "[settingsController] Error migrating data directory:",
                e
            );
            return {
                error: true,
                message: e.message,
            };
        }
    },
};

module.exports = settingsController;
