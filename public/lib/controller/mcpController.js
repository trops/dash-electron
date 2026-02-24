/**
 * mcpController.js
 *
 * Manages MCP (Model Context Protocol) server lifecycle in the main process.
 * Handles starting/stopping MCP servers, calling tools, listing tools/resources.
 *
 * Supports two transport types:
 *   - stdio: spawns a local child process (e.g., npx -y @algolia/mcp)
 *   - streamable_http: connects to a remote HTTP endpoint (e.g., https://mcp.us.algolia.com/...)
 *
 * Uses @modelcontextprotocol/sdk for protocol handling.
 */
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
    StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
const {
    StreamableHTTPClientTransport,
} = require("@modelcontextprotocol/sdk/client/streamableHttp.js");
const path = require("path");
const fs = require("fs");

/**
 * Active MCP server connections
 * Map<string, { client: Client, transport: Transport, tools: Array, status: string }>
 */
const activeServers = new Map();

/**
 * In-flight start promises for deduplication.
 * Prevents multiple simultaneous startServer calls for the same server
 * from spawning duplicate processes (e.g., 4 widgets all calling startServer("Slack")).
 * Map<string, Promise<result>>
 */
const pendingStarts = new Map();

/**
 * MCP Server status constants
 */
const STATUS = {
    DISCONNECTED: "disconnected",
    CONNECTING: "connecting",
    CONNECTED: "connected",
    ERROR: "error",
};

/**
 * Interpolate {{fieldName}} placeholders in a string with credential values.
 * Used for streamable_http URL and header templates.
 *
 * @param {string} template - String containing {{fieldName}} placeholders
 * @param {object} credentials - Credential values to interpolate
 * @returns {string} Interpolated string
 */
function interpolate(template, credentials) {
    if (!template || !credentials) return template;
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return credentials[key] !== undefined ? credentials[key] : match;
    });
}

const mcpController = {
    /**
     * startServer
     * Start an MCP server with the given config and credentials
     *
     * @param {BrowserWindow} win the main window
     * @param {string} serverName unique name for this server instance
     * @param {object} mcpConfig { transport, command, args, envMapping }
     * @param {object} credentials decrypted credentials object
     * @returns {{ success, serverName, tools, status } | { error, message }}
     */
    startServer: async (win, serverName, mcpConfig, credentials) => {
        // 1. Already connected? Return existing connection
        const existing = activeServers.get(serverName);
        if (
            existing &&
            existing.status === STATUS.CONNECTED &&
            existing.client
        ) {
            console.log(
                `[mcpController] Server already connected: ${serverName}`
            );
            return {
                success: true,
                serverName,
                tools: existing.tools,
                resources: existing.resources,
                status: STATUS.CONNECTED,
            };
        }

        // 2. Already starting? Piggyback on the pending promise
        if (pendingStarts.has(serverName)) {
            console.log(
                `[mcpController] Server already starting, deduplicating: ${serverName}`
            );
            return pendingStarts.get(serverName);
        }

        // 3. Fresh start — wrap in a promise and track it
        const startPromise = (async () => {
            try {
                // Stop if in stale/error state
                if (activeServers.has(serverName)) {
                    await mcpController.stopServer(win, serverName);
                }

                console.log(
                    `[mcpController] Starting server: ${serverName} (transport: ${
                        mcpConfig.transport || "stdio"
                    })`
                );

                // Create transport based on type
                let transport;
                if (mcpConfig.transport === "streamable_http") {
                    // Remote HTTP transport - connect to a hosted MCP server
                    const url = interpolate(mcpConfig.url, credentials);
                    if (!url) {
                        throw new Error(
                            "Streamable HTTP transport requires a URL"
                        );
                    }

                    // Build request headers from headerTemplate
                    const headers = {};
                    if (mcpConfig.headerTemplate && credentials) {
                        Object.entries(mcpConfig.headerTemplate).forEach(
                            ([headerName, template]) => {
                                headers[headerName] = interpolate(
                                    template,
                                    credentials
                                );
                            }
                        );
                    }

                    transport = new StreamableHTTPClientTransport(
                        new URL(url),
                        {
                            requestInit: {
                                headers,
                            },
                        }
                    );
                } else {
                    // stdio transport (default) - spawn a local child process
                    const env = { ...process.env };
                    if (mcpConfig.envMapping && credentials) {
                        Object.entries(mcpConfig.envMapping).forEach(
                            ([envVar, credentialKey]) => {
                                if (credentials[credentialKey] !== undefined) {
                                    env[envVar] = credentials[credentialKey];
                                }
                            }
                        );
                    }

                    transport = new StdioClientTransport({
                        command: mcpConfig.command,
                        args: mcpConfig.args || [],
                        env,
                    });
                }

                // Update status to connecting
                activeServers.set(serverName, {
                    client: null,
                    transport,
                    tools: [],
                    resources: [],
                    status: STATUS.CONNECTING,
                });

                // Create MCP client
                const client = new Client({
                    name: "dash",
                    version: "1.0.0",
                });

                // Connect to the server
                await client.connect(transport);

                // List available tools
                let tools = [];
                try {
                    const toolsResult = await client.listTools();
                    tools = toolsResult.tools || [];
                } catch (toolsError) {
                    console.warn(
                        `[mcpController] Could not list tools for ${serverName}:`,
                        toolsError.message
                    );
                }

                // List available resources
                let resources = [];
                try {
                    const resourcesResult = await client.listResources();
                    resources = resourcesResult.resources || [];
                } catch (resourcesError) {
                    // Resources are optional, many servers don't support them
                }

                // Store the active connection
                activeServers.set(serverName, {
                    client,
                    transport,
                    tools,
                    resources,
                    status: STATUS.CONNECTED,
                });

                console.log(
                    `[mcpController] Server connected: ${serverName} (${tools.length} tools, ${resources.length} resources)`
                );

                return {
                    success: true,
                    serverName,
                    tools,
                    resources,
                    status: STATUS.CONNECTED,
                };
            } catch (error) {
                console.error(
                    `[mcpController] Error starting server ${serverName}:`,
                    error
                );

                // Mark as error state
                activeServers.set(serverName, {
                    client: null,
                    transport: null,
                    tools: [],
                    resources: [],
                    status: STATUS.ERROR,
                    error: error.message,
                });

                return {
                    error: true,
                    message: error.message,
                    serverName,
                    status: STATUS.ERROR,
                };
            } finally {
                pendingStarts.delete(serverName);
            }
        })();

        pendingStarts.set(serverName, startPromise);
        return startPromise;
    },

    /**
     * stopServer
     * Stop a running MCP server
     *
     * @param {BrowserWindow} win the main window
     * @param {string} serverName the server to stop
     * @returns {{ success, serverName } | { error, message }}
     */
    stopServer: async (win, serverName) => {
        try {
            // Wait for any in-flight start to finish before stopping
            if (pendingStarts.has(serverName)) {
                try {
                    await pendingStarts.get(serverName);
                } catch (e) {
                    /* stopping anyway */
                }
            }

            const server = activeServers.get(serverName);
            if (!server) {
                return {
                    success: true,
                    serverName,
                    message: "Server was not running",
                };
            }

            console.log(`[mcpController] Stopping server: ${serverName}`);

            // Close the client connection
            if (server.client) {
                try {
                    await server.client.close();
                } catch (closeError) {
                    console.warn(
                        `[mcpController] Error closing client for ${serverName}:`,
                        closeError.message
                    );
                }
            }

            activeServers.delete(serverName);

            console.log(`[mcpController] Server stopped: ${serverName}`);

            return {
                success: true,
                serverName,
            };
        } catch (error) {
            console.error(
                `[mcpController] Error stopping server ${serverName}:`,
                error
            );
            // Clean up anyway
            activeServers.delete(serverName);
            return {
                error: true,
                message: error.message,
            };
        }
    },

    /**
     * callTool
     * Call a tool on a running MCP server
     *
     * @param {BrowserWindow} win the main window
     * @param {string} serverName the server to call the tool on
     * @param {string} toolName the tool to call
     * @param {object} args arguments for the tool
     * @param {Array<string>} allowedTools optional whitelist of allowed tool names
     * @returns {{ result } | { error, message }}
     */
    callTool: async (win, serverName, toolName, args, allowedTools = null) => {
        try {
            const server = activeServers.get(serverName);
            if (!server || !server.client) {
                throw new Error(`Server not connected: ${serverName}`);
            }

            // Enforce tool scoping if allowedTools is specified
            if (allowedTools && !allowedTools.includes(toolName)) {
                throw new Error(
                    `Tool "${toolName}" is not in the allowed tools list for this widget. Allowed: ${allowedTools.join(
                        ", "
                    )}`
                );
            }

            console.log(
                `[mcpController] Calling tool: ${serverName}/${toolName}`
            );

            const result = await server.client.callTool({
                name: toolName,
                arguments: args || {},
            });

            return {
                success: true,
                result,
            };
        } catch (error) {
            console.error(
                `[mcpController] Error calling tool ${serverName}/${toolName}:`,
                error
            );
            return {
                error: true,
                message: error.message,
            };
        }
    },

    /**
     * listTools
     * List available tools for a running MCP server
     *
     * @param {BrowserWindow} win the main window
     * @param {string} serverName the server name
     * @returns {{ tools } | { error, message }}
     */
    listTools: async (win, serverName) => {
        try {
            const server = activeServers.get(serverName);
            if (!server || !server.client) {
                throw new Error(`Server not connected: ${serverName}`);
            }

            // Refresh tool list from server
            const toolsResult = await server.client.listTools();
            const tools = toolsResult.tools || [];

            // Update cached tools
            server.tools = tools;

            return {
                success: true,
                tools,
            };
        } catch (error) {
            console.error(
                `[mcpController] Error listing tools for ${serverName}:`,
                error
            );
            return {
                error: true,
                message: error.message,
            };
        }
    },

    /**
     * listResources
     * List available resources for a running MCP server
     *
     * @param {BrowserWindow} win the main window
     * @param {string} serverName the server name
     * @returns {{ resources } | { error, message }}
     */
    listResources: async (win, serverName) => {
        try {
            const server = activeServers.get(serverName);
            if (!server || !server.client) {
                throw new Error(`Server not connected: ${serverName}`);
            }

            const resourcesResult = await server.client.listResources();
            const resources = resourcesResult.resources || [];

            // Update cached resources
            server.resources = resources;

            return {
                success: true,
                resources,
            };
        } catch (error) {
            console.error(
                `[mcpController] Error listing resources for ${serverName}:`,
                error
            );
            return {
                error: true,
                message: error.message,
            };
        }
    },

    /**
     * readResource
     * Read a specific resource from a running MCP server
     *
     * @param {BrowserWindow} win the main window
     * @param {string} serverName the server name
     * @param {string} uri the resource URI
     * @returns {{ resource } | { error, message }}
     */
    readResource: async (win, serverName, uri) => {
        try {
            const server = activeServers.get(serverName);
            if (!server || !server.client) {
                throw new Error(`Server not connected: ${serverName}`);
            }

            const result = await server.client.readResource({ uri });

            return {
                success: true,
                resource: result,
            };
        } catch (error) {
            console.error(
                `[mcpController] Error reading resource ${uri} from ${serverName}:`,
                error
            );
            return {
                error: true,
                message: error.message,
            };
        }
    },

    /**
     * getServerStatus
     * Get the connection status of a server
     *
     * @param {BrowserWindow} win the main window
     * @param {string} serverName the server name
     * @returns {{ status, tools, error }}
     */
    getServerStatus: (win, serverName) => {
        const server = activeServers.get(serverName);
        if (!server) {
            return {
                serverName,
                status: STATUS.DISCONNECTED,
                tools: [],
                resources: [],
            };
        }

        return {
            serverName,
            status: server.status,
            tools: server.tools || [],
            resources: server.resources || [],
            error: server.error || null,
        };
    },

    /**
     * getCatalog
     * Load the MCP server seed catalog
     *
     * @param {BrowserWindow} win the main window
     * @returns {{ catalog } | { error, message }}
     */
    getCatalog: (win) => {
        try {
            const catalogPath = path.join(
                __dirname,
                "..",
                "mcp",
                "mcpServerCatalog.json"
            );

            if (!fs.existsSync(catalogPath)) {
                return {
                    catalog: [],
                };
            }

            const catalogData = fs.readFileSync(catalogPath, "utf8");
            const catalog = JSON.parse(catalogData);

            return {
                success: true,
                catalog: catalog.servers || [],
            };
        } catch (error) {
            console.error("[mcpController] Error loading catalog:", error);
            return {
                error: true,
                message: error.message,
                catalog: [],
            };
        }
    },

    /**
     * stopAllServers
     * Stop all running MCP servers (called on app quit)
     */
    stopAllServers: async () => {
        // Wait for any in-flight starts to settle before stopping
        if (pendingStarts.size > 0) {
            await Promise.allSettled([...pendingStarts.values()]);
        }

        console.log(
            `[mcpController] Stopping all servers (${activeServers.size} active)`
        );
        const promises = [];
        for (const [serverName] of activeServers) {
            promises.push(mcpController.stopServer(null, serverName));
        }
        await Promise.allSettled(promises);
        console.log("[mcpController] All servers stopped");
    },
};

module.exports = mcpController;
