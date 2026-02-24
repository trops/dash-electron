import IDashboardApi from "./IDashboardApi";
import * as apiEvents from "./events";

class WebDashboardApi implements IDashboardApi {
    /**
     * api
     * The api to be utilized for the requests (electron, react, custom ...)
     */
    api: any;

    /**
     * appId
     * The application identifier
     */
    appId: String;

    /**
     * events
     * Events to be used for the api calls (call, success, error)
     */
    events: apiEvents;

    constructor(api: any) {
        this.api = api;
    }

    listWorkspaces(appId, onSuccess, onError): Boolean {
        return true;
    }

    listThemes(appId, onSuccess, onError): Boolean {
        return true;
    }

    listMenuItems(appId, onSuccess, onError): Boolean {
        return true;
    }

    listSettings(appId, onSuccess, onError): Boolean {
        return true;
    }

    listProviders: (
        appId: string,
        onSuccess: { event: string; providers: [] },
        onError: { event: string; e: Error }
    ) => Boolean;
    getProvider: (
        appId: string,
        providerName: string,
        onSuccess: { event: string; provider: any },
        onError: { event: string; e: Error }
    ) => Boolean;
    saveProvider: (
        appId: string,
        providerName: string,
        providerData: any,
        onSuccess: { event: string; message: string },
        onError: { event: string; e: Error }
    ) => Boolean;
    deleteProvider: (
        appId: string,
        providerName: string,
        onSuccess: { event: string; message: string },
        onError: { event: string; e: Error }
    ) => Boolean;

    deleteWorkspace(appId, workspaceId, onSuccess, onError): Boolean {
        return false;
    }

    deleteMenuItem(appId, menuItemId, onSuccess, onError): Boolean {
        return false;
    }

    deleteTheme(appId, themeKey, onSuccess, onError): Boolean {
        return false;
    }

    saveMenu(appId, menu, onSuccess, onError): Boolean {
        return true;
    }
    saveMenuItem(appId, menuItem): Boolean {
        return true;
    }

    saveWorkspace(appId, workspaceToSave, onSuccess, onError): Boolean {
        return true;
    }

    saveSettings: (
        appId: string,
        settings: any,
        onSuccess: { event: string; message: any },
        onError: { event: string; e: Error }
    ) => Boolean;

    saveTheme(
        appId: any,
        themeKey: string,
        rawTheme: {},
        onSuccess: any,
        onError: any
    ): Boolean {
        return false;
    }

    chooseFile(
        allowFile: Boolean,
        extensions: Array<String>,
        onSuccess: any
    ): Boolean {
        return false;
    }

    // MCP methods - no-op in web context (Electron only)
    mcpStartServer(
        serverName,
        mcpConfig,
        credentials,
        onSuccess,
        onError
    ): Boolean {
        onError?.(
            "mcp:start-server:error",
            new Error("MCP not available in web mode")
        );
        return false;
    }
    mcpStopServer(serverName, onSuccess, onError): Boolean {
        onError?.(
            "mcp:stop-server:error",
            new Error("MCP not available in web mode")
        );
        return false;
    }
    mcpCallTool(
        serverName,
        toolName,
        args,
        allowedTools,
        onSuccess,
        onError
    ): Boolean {
        onError?.(
            "mcp:call-tool:error",
            new Error("MCP not available in web mode")
        );
        return false;
    }
    mcpListTools(serverName, onSuccess, onError): Boolean {
        onError?.(
            "mcp:list-tools:error",
            new Error("MCP not available in web mode")
        );
        return false;
    }
    mcpListResources(serverName, onSuccess, onError): Boolean {
        onError?.(
            "mcp:list-resources:error",
            new Error("MCP not available in web mode")
        );
        return false;
    }
    mcpReadResource(serverName, uri, onSuccess, onError): Boolean {
        onError?.(
            "mcp:read-resource:error",
            new Error("MCP not available in web mode")
        );
        return false;
    }
    mcpGetServerStatus(serverName, onSuccess, onError): Boolean {
        onError?.(
            "mcp:server-status:error",
            new Error("MCP not available in web mode")
        );
        return false;
    }
    mcpGetCatalog(onSuccess, onError): Boolean {
        onError?.(
            "mcp:get-catalog:error",
            new Error("MCP not available in web mode")
        );
        return false;
    }
}

export { WebDashboardApi };
