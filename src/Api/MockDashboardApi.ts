/**
 * MockDashboardApi
 * A mock implementation of the IDashboardApi interface for testing purposes
 */

export class MockDashboardApi {
    api: any;
    appId: string;
    events: any;

    constructor(api?: any) {
        this.api = api || {};
        this.appId = "mock-app-id";
        this.events = {};
    }

    listWorkspaces(appId: string, onSuccess: any, onError: any): Boolean {
        try {
            onSuccess?.(null, {
                event: "listWorkspaces",
                workspaces: [],
            });
            return true;
        } catch (e) {
            onError?.(null, {
                event: "listWorkspaces",
                message: e instanceof Error ? e.message : "Unknown error",
            });
            return false;
        }
    }

    listThemes(appId: string, onSuccess: any, onError: any): Boolean {
        try {
            onSuccess?.(null, {
                event: "listThemes",
                themes: [],
            });
            return true;
        } catch (e) {
            onError?.(null, {
                event: "listThemes",
                message: e instanceof Error ? e.message : "Unknown error",
            });
            return false;
        }
    }

    listSettings(appId: string, onSuccess: any, onError: any): Boolean {
        try {
            onSuccess?.(null, {
                event: "listSettings",
                settings: {},
            });
            return true;
        } catch (e) {
            onError?.(null, {
                event: "listSettings",
                message: e instanceof Error ? e.message : "Unknown error",
            });
            return false;
        }
    }

    listMenuItems(appId: string, onSuccess: any, onError: any): Boolean {
        try {
            onSuccess?.(null, {
                event: "listMenuItems",
                menuItems: [],
            });
            return true;
        } catch (e) {
            onError?.(null, {
                event: "listMenuItems",
                message: e instanceof Error ? e.message : "Unknown error",
            });
            return false;
        }
    }

    saveWorkspace(
        appId: string,
        workspaceToSave: any,
        onSuccess: any,
        onError: any
    ): Boolean {
        try {
            onSuccess?.(null, {
                event: "saveWorkspace",
                m: "Workspace saved successfully",
            });
            return true;
        } catch (e) {
            onError?.(null, {
                event: "saveWorkspace",
                message: e instanceof Error ? e.message : "Unknown error",
            });
            return false;
        }
    }

    saveMenuItem(
        appId: string,
        menuItem: any,
        onSuccess: any,
        onError: any
    ): Boolean {
        try {
            onSuccess?.(null, {
                event: "saveMenuItem",
                m: "MenuItem saved successfully",
            });
            return true;
        } catch (e) {
            onError?.(null, {
                event: "saveMenuItem",
                message: e instanceof Error ? e.message : "Unknown error",
            });
            return false;
        }
    }

    saveTheme(
        appId: string,
        theme: any,
        onSuccess: any,
        onError: any
    ): Boolean {
        try {
            onSuccess?.(null, {
                event: "saveTheme",
                m: "Theme saved successfully",
            });
            return true;
        } catch (e) {
            onError?.(null, {
                event: "saveTheme",
                message: e instanceof Error ? e.message : "Unknown error",
            });
            return false;
        }
    }

    saveSetting(
        appId: string,
        setting: any,
        onSuccess: any,
        onError: any
    ): Boolean {
        try {
            onSuccess?.(null, {
                event: "saveSetting",
                m: "Setting saved successfully",
            });
            return true;
        } catch (e) {
            onError?.(null, {
                event: "saveSetting",
                message: e instanceof Error ? e.message : "Unknown error",
            });
            return false;
        }
    }
}
