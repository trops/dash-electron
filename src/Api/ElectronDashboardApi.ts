import IDashboardApi from "./IDashboardApi";
import * as apiEvents from "./events/index";

class ElectronDashboardApi implements IDashboardApi {
    api: any;

    /**
     * @param {String} appId the application identifier
     * Also this will be appended to the path where we store the configuration files
     */
    appId: String;

    /**
     * events
     * Events to be used for the api calls (call, success, error)
     */
    events: any;

    constructor(api: any, appId = null, events?: any) {
        this.api = api;
        this.appId = appId;

        if (events) {
            this.events = events;
        } else {
            this.events = apiEvents;
        }
    }

    chooseFile(allowFile = true, extensions = ["*"], onSuccess): Boolean {
        console.log("choose file electron api");
        try {
            // Handle the promise returned by the IPC call
            this.api.dialog
                .chooseFile(allowFile, extensions)
                .then((result) => {
                    onSuccess(this.events.CHOOSE_FILE_COMPLETE, result);
                })
                .catch((error) => {
                    console.error("Error choosing file:", error);
                });
            return true;
        } catch (e) {
            return false;
        }
    }

    listWorkspaces(appId, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                // Handle the promise returned by the IPC call
                this.api.workspace
                    .listWorkspacesForApplication(appId)
                    .then((result) => {
                        onSuccess(this.events.WORKSPACE_LIST_COMPLETE, result);
                    })
                    .catch((error) => {
                        onError(this.events.WORKSPACE_LIST_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.WORKSPACE_LIST_ERROR, e);
                return false;
            }
        } else {
            onError(
                this.events.WORKSPACE_LIST_ERROR,
                new Error("No Api found")
            );
            return false;
        }
    }

    listContexts(appId, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                // Note: context API not yet implemented in backend
                // This will fail until context API is added to mainApi
                if (!this.api.context) {
                    onError(
                        this.events.CONTEXT_LIST_ERROR,
                        new Error("Context API not implemented")
                    );
                    return false;
                }
                // Handle the promise returned by the IPC call
                this.api.context
                    .listContextForApplication(appId)
                    .then((result) => {
                        onSuccess(this.events.CONTEXT_LIST_COMPLETE, result);
                    })
                    .catch((error) => {
                        onError(this.events.CONTEXT_LIST_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.CONTEXT_LIST_ERROR, e);
                return false;
            }
        } else {
            onError(this.events.CONTEXT_LIST_ERROR, new Error("No Api found"));
            return false;
        }
    }

    listMenuItems(appId, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                // Handle the promise returned by the IPC call
                this.api.menuItems
                    .listMenuItems(appId)
                    .then((result) => {
                        onSuccess(this.events.MENU_ITEMS_LIST_COMPLETE, result);
                    })
                    .catch((error) => {
                        onError(this.events.MENU_ITEMS_LIST_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.MENU_ITEMS_LIST_ERROR, e);
                return false;
            }
        } else {
            onError(
                this.events.MENU_ITEMS_LIST_ERROR,
                new Error("No Api found")
            );
            return false;
        }
    }

    listThemes(appId, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                // Handle the promise returned by the IPC call
                this.api.themes
                    .listThemesForApplication(appId)
                    .then((result) => {
                        onSuccess(this.events.THEME_LIST_COMPLETE, result);
                    })
                    .catch((error) => {
                        onError(this.events.THEME_LIST_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.THEME_LIST_ERROR, e);
                return false;
            }
        } else {
            onError(this.events.THEME_LIST_ERROR, new Error("No Api found"));
            return false;
        }
    }

    listSettings(appId, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                // Handle the promise returned by the IPC call
                this.api.settings
                    .getSettingsForApplication()
                    .then((result) => {
                        onSuccess(this.events.SETTINGS_GET_COMPLETE, result);
                    })
                    .catch((error) => {
                        onError(this.events.SETTINGS_GET_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.SETTINGS_GET_ERROR, e);
                return false;
            }
        } else {
            onError(this.events.SETTINGS_GET_ERROR, new Error("No Api found"));
            return false;
        }
    }

    saveMenuItem(appId, menuItem, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                // Handle the promise returned by the IPC call
                this.api.menuItems
                    .saveMenuItem(appId, menuItem)
                    .then((result) => {
                        onSuccess(this.events.MENU_ITEMS_SAVE_COMPLETE, result);
                    })
                    .catch((error) => {
                        onError(this.events.MENU_ITEMS_SAVE_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.MENU_ITEMS_SAVE_ERROR, e);
                return false;
            }
        } else {
            onError(
                this.events.MENU_ITEMS_SAVE_ERROR,
                new Error("No Api found")
            );
            return false;
        }
    }

    saveWorkspace(appId, workspaceToSave, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                // Handle the promise returned by the IPC call
                this.api.workspace
                    .saveWorkspaceForApplication(appId, workspaceToSave)
                    .then((result) => {
                        onSuccess(this.events.WORKSPACE_SAVE_COMPLETE, result);
                    })
                    .catch((error) => {
                        onError(this.events.WORKSPACE_SAVE_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.WORKSPACE_SAVE_ERROR, e);
                return false;
            }
        } else {
            onError(
                this.events.WORKSPACE_SAVE_ERROR,
                new Error("No Api found")
            );
            return false;
        }
    }

    saveContext(appId, contextToSave, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                // Note: context API not yet implemented in backend
                // This will fail until context API is added to mainApi
                if (!this.api.context) {
                    onError(
                        this.events.CONTEXT_SAVE_ERROR,
                        new Error("Context API not implemented")
                    );
                    return false;
                }
                // Handle the promise returned by the IPC call
                this.api.context
                    .saveContextForApplication(appId, contextToSave)
                    .then((result) => {
                        onSuccess(this.events.CONTEXT_SAVE_COMPLETE, result);
                    })
                    .catch((error) => {
                        onError(this.events.CONTEXT_SAVE_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.CONTEXT_SAVE_ERROR, e);
                return false;
            }
        } else {
            onError(this.events.CONTEXT_SAVE_ERROR, new Error("No Api found"));
            return false;
        }
    }

    saveSettings(appId, settings, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                // Handle the promise returned by the IPC call
                this.api.settings
                    .saveSettingsForApplication(settings)
                    .then((result) => {
                        onSuccess(this.events.SETTINGS_GET_COMPLETE, result);
                    })
                    .catch((error) => {
                        onError(this.events.SETTINGS_GET_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.SETTINGS_GET_ERROR, e);
                return false;
            }
        } else {
            onError(this.events.SETTINGS_GET_ERROR, new Error("No Api found"));
            return false;
        }
    }

    saveTheme(appId, themeKey, rawTheme, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                // Handle the promise returned by the IPC call
                this.api.themes
                    .saveThemeForApplication(appId, themeKey, rawTheme)
                    .then((result) => {
                        onSuccess(this.events.THEME_SAVE_COMPLETE, result);
                    })
                    .catch((error) => {
                        onError(this.events.THEME_SAVE_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.THEME_SAVE_ERROR, e);
                return false;
            }
        } else {
            onError(this.events.THEME_SAVE_ERROR, new Error("No Api found"));
            return false;
        }
    }

    listProviders(appId, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                // Handle the promise returned by the IPC call
                this.api.providers
                    .listProviders(appId)
                    .then((result) => {
                        onSuccess(this.events.PROVIDER_LIST_COMPLETE, result);
                    })
                    .catch((error) => {
                        onError(this.events.PROVIDER_LIST_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.PROVIDER_LIST_ERROR, e);
                return false;
            }
        } else {
            onError(this.events.PROVIDER_LIST_ERROR, new Error("No Api found"));
            return false;
        }
    }

    getProvider(appId, providerName, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                // Handle the promise returned by the IPC call
                this.api.providers
                    .getProvider(appId, providerName)
                    .then((result) => {
                        onSuccess(this.events.PROVIDER_GET_COMPLETE, result);
                    })
                    .catch((error) => {
                        onError(this.events.PROVIDER_GET_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.PROVIDER_GET_ERROR, e);
                return false;
            }
        } else {
            onError(this.events.PROVIDER_GET_ERROR, new Error("No Api found"));
            return false;
        }
    }

    saveProvider(
        appId,
        providerName,
        providerData,
        onSuccess,
        onError
    ): Boolean {
        if (this.api !== null) {
            try {
                // Handle the promise returned by the IPC call
                // Note: providerData should contain providerType, credentials, and optionally providerClass/mcpConfig
                const { providerType, credentials, providerClass, mcpConfig } =
                    providerData;
                this.api.providers
                    .saveProvider(
                        appId,
                        providerName,
                        providerType,
                        credentials,
                        providerClass,
                        mcpConfig
                    )
                    .then((result) => {
                        onSuccess(this.events.PROVIDER_SAVE_COMPLETE, result);
                    })
                    .catch((error) => {
                        onError(this.events.PROVIDER_SAVE_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.PROVIDER_SAVE_ERROR, e);
                return false;
            }
        } else {
            onError(this.events.PROVIDER_SAVE_ERROR, new Error("No Api found"));
            return false;
        }
    }

    deleteWorkspace(appId, workspaceId, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                this.api.workspace
                    .deleteWorkspaceForApplication(appId, workspaceId)
                    .then((result) => {
                        onSuccess(
                            this.events.WORKSPACE_DELETE_COMPLETE,
                            result
                        );
                    })
                    .catch((error) => {
                        onError(this.events.WORKSPACE_DELETE_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.WORKSPACE_DELETE_ERROR, e);
                return false;
            }
        } else {
            onError(
                this.events.WORKSPACE_DELETE_ERROR,
                new Error("No Api found")
            );
            return false;
        }
    }

    deleteMenuItem(appId, menuItemId, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                this.api.menuItems
                    .deleteMenuItem(appId, menuItemId)
                    .then((result) => {
                        onSuccess(
                            this.events.MENU_ITEMS_DELETE_COMPLETE,
                            result
                        );
                    })
                    .catch((error) => {
                        onError(this.events.MENU_ITEMS_DELETE_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.MENU_ITEMS_DELETE_ERROR, e);
                return false;
            }
        } else {
            onError(
                this.events.MENU_ITEMS_DELETE_ERROR,
                new Error("No Api found")
            );
            return false;
        }
    }

    deleteTheme(appId, themeKey, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                this.api.themes
                    .deleteThemeForApplication(appId, themeKey)
                    .then((result) => {
                        onSuccess(this.events.THEME_DELETE_COMPLETE, result);
                    })
                    .catch((error) => {
                        onError(this.events.THEME_DELETE_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.THEME_DELETE_ERROR, e);
                return false;
            }
        } else {
            onError(this.events.THEME_DELETE_ERROR, new Error("No Api found"));
            return false;
        }
    }

    getDataDirectory(onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                this.api.settings
                    .getDataDirectory()
                    .then((result) => {
                        onSuccess(null, result);
                    })
                    .catch((error) => {
                        onError(null, error);
                    });
                return true;
            } catch (e) {
                onError(null, e);
                return false;
            }
        } else {
            onError(null, new Error("No Api found"));
            return false;
        }
    }

    openDataDirectory(onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                this.api.settings
                    .getDataDirectory()
                    .then((result) => {
                        const dir = result?.dataDirectory || result;
                        if (dir && this.api.shell) {
                            this.api.shell.openPath(dir);
                        }
                        onSuccess(null, result);
                    })
                    .catch((error) => {
                        onError(null, error);
                    });
                return true;
            } catch (e) {
                onError(null, e);
                return false;
            }
        } else {
            onError(null, new Error("No Api found"));
            return false;
        }
    }

    deleteProvider(appId, providerName, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                // Handle the promise returned by the IPC call
                this.api.providers
                    .deleteProvider(appId, providerName)
                    .then((result) => {
                        onSuccess(this.events.PROVIDER_DELETE_COMPLETE, result);
                    })
                    .catch((error) => {
                        onError(this.events.PROVIDER_DELETE_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.PROVIDER_DELETE_ERROR, e);
                return false;
            }
        } else {
            onError(
                this.events.PROVIDER_DELETE_ERROR,
                new Error("No Api found")
            );
            return false;
        }
    }

    // =========================================================================
    // MCP (Model Context Protocol) Server Operations
    // =========================================================================

    mcpStartServer(
        serverName,
        mcpConfig,
        credentials,
        onSuccess,
        onError
    ): Boolean {
        if (this.api !== null) {
            try {
                this.api.mcp
                    .startServer(serverName, mcpConfig, credentials)
                    .then((result) => {
                        onSuccess(
                            this.events.MCP_START_SERVER_COMPLETE,
                            result
                        );
                    })
                    .catch((error) => {
                        onError(this.events.MCP_START_SERVER_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.MCP_START_SERVER_ERROR, e);
                return false;
            }
        } else {
            onError(
                this.events.MCP_START_SERVER_ERROR,
                new Error("No Api found")
            );
            return false;
        }
    }

    mcpStopServer(serverName, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                this.api.mcp
                    .stopServer(serverName)
                    .then((result) => {
                        onSuccess(this.events.MCP_STOP_SERVER_COMPLETE, result);
                    })
                    .catch((error) => {
                        onError(this.events.MCP_STOP_SERVER_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.MCP_STOP_SERVER_ERROR, e);
                return false;
            }
        } else {
            onError(
                this.events.MCP_STOP_SERVER_ERROR,
                new Error("No Api found")
            );
            return false;
        }
    }

    mcpCallTool(
        serverName,
        toolName,
        args,
        allowedTools,
        onSuccess,
        onError
    ): Boolean {
        if (this.api !== null) {
            try {
                this.api.mcp
                    .callTool(serverName, toolName, args, allowedTools)
                    .then((result) => {
                        onSuccess(this.events.MCP_CALL_TOOL_COMPLETE, result);
                    })
                    .catch((error) => {
                        onError(this.events.MCP_CALL_TOOL_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.MCP_CALL_TOOL_ERROR, e);
                return false;
            }
        } else {
            onError(this.events.MCP_CALL_TOOL_ERROR, new Error("No Api found"));
            return false;
        }
    }

    mcpListTools(serverName, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                this.api.mcp
                    .listTools(serverName)
                    .then((result) => {
                        onSuccess(this.events.MCP_LIST_TOOLS_COMPLETE, result);
                    })
                    .catch((error) => {
                        onError(this.events.MCP_LIST_TOOLS_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.MCP_LIST_TOOLS_ERROR, e);
                return false;
            }
        } else {
            onError(
                this.events.MCP_LIST_TOOLS_ERROR,
                new Error("No Api found")
            );
            return false;
        }
    }

    mcpListResources(serverName, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                this.api.mcp
                    .listResources(serverName)
                    .then((result) => {
                        onSuccess(
                            this.events.MCP_LIST_RESOURCES_COMPLETE,
                            result
                        );
                    })
                    .catch((error) => {
                        onError(this.events.MCP_LIST_RESOURCES_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.MCP_LIST_RESOURCES_ERROR, e);
                return false;
            }
        } else {
            onError(
                this.events.MCP_LIST_RESOURCES_ERROR,
                new Error("No Api found")
            );
            return false;
        }
    }

    mcpReadResource(serverName, uri, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                this.api.mcp
                    .readResource(serverName, uri)
                    .then((result) => {
                        onSuccess(
                            this.events.MCP_READ_RESOURCE_COMPLETE,
                            result
                        );
                    })
                    .catch((error) => {
                        onError(this.events.MCP_READ_RESOURCE_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.MCP_READ_RESOURCE_ERROR, e);
                return false;
            }
        } else {
            onError(
                this.events.MCP_READ_RESOURCE_ERROR,
                new Error("No Api found")
            );
            return false;
        }
    }

    mcpGetServerStatus(serverName, onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                this.api.mcp
                    .getServerStatus(serverName)
                    .then((result) => {
                        onSuccess(
                            this.events.MCP_SERVER_STATUS_COMPLETE,
                            result
                        );
                    })
                    .catch((error) => {
                        onError(this.events.MCP_SERVER_STATUS_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.MCP_SERVER_STATUS_ERROR, e);
                return false;
            }
        } else {
            onError(
                this.events.MCP_SERVER_STATUS_ERROR,
                new Error("No Api found")
            );
            return false;
        }
    }

    mcpGetCatalog(onSuccess, onError): Boolean {
        if (this.api !== null) {
            try {
                this.api.mcp
                    .getCatalog()
                    .then((result) => {
                        onSuccess(this.events.MCP_GET_CATALOG_COMPLETE, result);
                    })
                    .catch((error) => {
                        onError(this.events.MCP_GET_CATALOG_ERROR, error);
                    });
                return true;
            } catch (e) {
                onError(this.events.MCP_GET_CATALOG_ERROR, e);
                return false;
            }
        } else {
            onError(
                this.events.MCP_GET_CATALOG_ERROR,
                new Error("No Api found")
            );
            return false;
        }
    }
}

export { ElectronDashboardApi };
