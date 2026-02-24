/**
 * mcpApi.js
 *
 * Preload bridge for MCP (Model Context Protocol) server operations.
 * Communicates with main process via IPC to manage MCP server lifecycle.
 */
const { ipcRenderer } = require("electron");
const {
    MCP_START_SERVER,
    MCP_STOP_SERVER,
    MCP_LIST_TOOLS,
    MCP_CALL_TOOL,
    MCP_LIST_RESOURCES,
    MCP_READ_RESOURCE,
    MCP_SERVER_STATUS,
    MCP_GET_CATALOG,
} = require("../events");

const mcpApi = {
    /**
     * startServer
     * Start an MCP server with the given config and credentials
     *
     * @param {string} serverName unique name for this server instance
     * @param {object} mcpConfig { transport, command, args, envMapping }
     * @param {object} credentials decrypted credentials object
     * @returns {Promise<{ success, serverName, tools, status } | { error, message }>}
     */
    startServer: (serverName, mcpConfig, credentials) =>
        ipcRenderer.invoke(MCP_START_SERVER, {
            serverName,
            mcpConfig,
            credentials,
        }),

    /**
     * stopServer
     * Stop a running MCP server
     *
     * @param {string} serverName the server to stop
     * @returns {Promise<{ success, serverName } | { error, message }>}
     */
    stopServer: (serverName) =>
        ipcRenderer.invoke(MCP_STOP_SERVER, { serverName }),

    /**
     * listTools
     * List available tools for a running MCP server
     *
     * @param {string} serverName the server name
     * @returns {Promise<{ tools } | { error, message }>}
     */
    listTools: (serverName) =>
        ipcRenderer.invoke(MCP_LIST_TOOLS, { serverName }),

    /**
     * callTool
     * Call a tool on a running MCP server
     *
     * @param {string} serverName the server name
     * @param {string} toolName the tool to call
     * @param {object} args tool arguments
     * @param {Array<string>} allowedTools optional whitelist of allowed tool names
     * @returns {Promise<{ result } | { error, message }>}
     */
    callTool: (serverName, toolName, args, allowedTools = null) =>
        ipcRenderer.invoke(MCP_CALL_TOOL, {
            serverName,
            toolName,
            args,
            allowedTools,
        }),

    /**
     * listResources
     * List available resources for a running MCP server
     *
     * @param {string} serverName the server name
     * @returns {Promise<{ resources } | { error, message }>}
     */
    listResources: (serverName) =>
        ipcRenderer.invoke(MCP_LIST_RESOURCES, { serverName }),

    /**
     * readResource
     * Read a specific resource from a running MCP server
     *
     * @param {string} serverName the server name
     * @param {string} uri the resource URI
     * @returns {Promise<{ resource } | { error, message }>}
     */
    readResource: (serverName, uri) =>
        ipcRenderer.invoke(MCP_READ_RESOURCE, { serverName, uri }),

    /**
     * getServerStatus
     * Get the connection status of a server
     *
     * @param {string} serverName the server name
     * @returns {Promise<{ status, tools, error }>}
     */
    getServerStatus: (serverName) =>
        ipcRenderer.invoke(MCP_SERVER_STATUS, { serverName }),

    /**
     * getCatalog
     * Load the MCP server seed catalog
     *
     * @returns {Promise<{ catalog } | { error, message }>}
     */
    getCatalog: () => ipcRenderer.invoke(MCP_GET_CATALOG),
};

module.exports = mcpApi;
