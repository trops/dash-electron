/**
 * providerController.js
 *
 * Handle provider (credentials) management with encryption
 * Saves encrypted credentials to ~/.userData/Dashboard/{appId}/providers.json
 */
const { app, safeStorage } = require("electron");
const path = require("path");
const { writeFileSync } = require("fs");
const {
    ensureDirectoryExistence,
    getFileContents,
    writeToFile,
} = require("../utils/file");

const appName = "Dashboard";
const configFilename = "providers.json";

const providerController = {
    /**
     * saveProvider
     * Save a new provider with encrypted credentials
     *
     * @param {BrowserWindow} win the main window
     * @param {string} appId the application id
     * @param {string} providerName user-defined name (e.g., "Algolia Production")
     * @param {string} providerType provider type (e.g., "algolia", "slack")
     * @param {object} credentials credentials object
     * @param {string} providerClass "credential" (default) or "mcp"
     * @param {object} mcpConfig MCP server config (transport, command, args, envMapping) - only for providerClass "mcp"
     */
    saveProvider: (
        win,
        appId,
        providerName,
        providerType,
        credentials,
        providerClass = "credential",
        mcpConfig = null
    ) => {
        try {
            // Build file path
            const filename = path.join(
                app.getPath("userData"),
                appName,
                appId,
                configFilename
            );

            // Ensure directory exists
            ensureDirectoryExistence(filename);

            // Load existing providers
            const providers = getFileContents(filename, {});

            // Encrypt credentials
            const credentialsJson = JSON.stringify(credentials);
            const encryptedCredentials =
                safeStorage.encryptString(credentialsJson);

            // Add/update provider
            const providerEntry = {
                type: providerType,
                providerClass: providerClass || "credential",
                credentials: encryptedCredentials.toString("base64"),
                dateCreated:
                    providers[providerName]?.dateCreated ||
                    new Date().toISOString(),
                dateUpdated: new Date().toISOString(),
            };

            // Add mcpConfig for MCP providers
            if (providerClass === "mcp" && mcpConfig) {
                providerEntry.mcpConfig = mcpConfig;
            }

            providers[providerName] = providerEntry;

            // Save to file with restrictive permissions (owner read/write only)
            writeFileSync(filename, JSON.stringify(providers, null, 2), {
                mode: 0o600,
            });

            console.log(
                `[providerController] Provider saved: ${providerName} (${providerType}, ${providerClass})`
            );

            // Return the data for ipcMain.handle() - modern promise-based approach
            return {
                success: true,
                providerName,
                providerType,
                providerClass,
            };
        } catch (error) {
            console.error("[providerController] Error saving provider:", error);
            return {
                error: true,
                message: error.message,
            };
        }
    },

    /**
     * listProviders
     * Get list of all providers with decrypted credentials
     *
     * @param {BrowserWindow} win the main window
     * @param {string} appId the application id
     */
    listProviders: (win, appId) => {
        try {
            const filename = path.join(
                app.getPath("userData"),
                appName,
                appId,
                configFilename
            );

            // Load providers file
            const providersData = getFileContents(filename, {});

            // Decrypt all credentials
            const decryptedProviders = [];
            Object.entries(providersData).forEach(([name, data]) => {
                try {
                    const credentialsBuffer = Buffer.from(
                        data.credentials,
                        "base64"
                    );
                    const decryptedJson =
                        safeStorage.decryptString(credentialsBuffer);
                    const credentials = JSON.parse(decryptedJson);

                    const provider = {
                        name,
                        type: data.type,
                        providerClass: data.providerClass || "credential",
                        credentials,
                        dateCreated: data.dateCreated,
                        dateUpdated: data.dateUpdated,
                    };

                    // Include mcpConfig for MCP providers
                    if (data.mcpConfig) {
                        provider.mcpConfig = data.mcpConfig;
                    }

                    decryptedProviders.push(provider);
                } catch (decryptError) {
                    console.error(
                        `[providerController] Failed to decrypt provider ${name}:`,
                        decryptError
                    );
                    // Skip this provider if decryption fails
                }
            });

            console.log(
                `[providerController] Loaded ${decryptedProviders.length} providers`
            );

            // Return the data for ipcMain.handle() - modern promise-based approach
            return {
                providers: decryptedProviders,
            };
        } catch (error) {
            console.error(
                "[providerController] Error listing providers:",
                error
            );
            return {
                error: true,
                message: error.message,
                providers: [],
            };
        }
    },

    /**
     * getProvider
     * Get a specific provider by name with decrypted credentials
     *
     * @param {BrowserWindow} win the main window
     * @param {string} appId the application id
     * @param {string} providerName the provider name to retrieve
     */
    getProvider: (win, appId, providerName) => {
        try {
            const filename = path.join(
                app.getPath("userData"),
                appName,
                appId,
                configFilename
            );

            // Load providers file
            const providersData = getFileContents(filename, {});

            // Find and decrypt the specific provider
            const providerData = providersData[providerName];
            if (!providerData) {
                throw new Error(`Provider not found: ${providerName}`);
            }

            const credentialsBuffer = Buffer.from(
                providerData.credentials,
                "base64"
            );
            const decryptedJson = safeStorage.decryptString(credentialsBuffer);
            const credentials = JSON.parse(decryptedJson);

            const provider = {
                name: providerName,
                type: providerData.type,
                providerClass: providerData.providerClass || "credential",
                credentials,
                dateCreated: providerData.dateCreated,
                dateUpdated: providerData.dateUpdated,
            };

            // Include mcpConfig for MCP providers
            if (providerData.mcpConfig) {
                provider.mcpConfig = providerData.mcpConfig;
            }

            console.log(
                `[providerController] Provider retrieved: ${providerName}`
            );

            // Return the data for ipcMain.handle() - modern promise-based approach
            return {
                provider,
            };
        } catch (error) {
            console.error(
                "[providerController] Error getting provider:",
                error
            );
            return {
                error: true,
                message: error.message,
            };
        }
    },

    /**
     * deleteProvider
     * Delete a provider from the providers file
     *
     * @param {BrowserWindow} win the main window
     * @param {string} appId the application id
     * @param {string} providerName the provider name to delete
     */
    deleteProvider: (win, appId, providerName) => {
        try {
            const filename = path.join(
                app.getPath("userData"),
                appName,
                appId,
                configFilename
            );

            // Load existing providers
            const providers = getFileContents(filename, {});

            // Delete the provider
            if (!providers.hasOwnProperty(providerName)) {
                throw new Error(`Provider not found: ${providerName}`);
            }

            delete providers[providerName];

            // Save to file with restrictive permissions (owner read/write only)
            writeFileSync(filename, JSON.stringify(providers, null, 2), {
                mode: 0o600,
            });

            console.log(
                `[providerController] Provider deleted: ${providerName}`
            );

            // Return the data for ipcMain.handle() - modern promise-based approach
            return {
                success: true,
                providerName,
            };
        } catch (error) {
            console.error(
                "[providerController] Error deleting provider:",
                error
            );
            return {
                error: true,
                message: error.message,
            };
        }
    },
};

module.exports = providerController;
