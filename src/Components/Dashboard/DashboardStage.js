import React, {
    useState,
    useEffect,
    useContext,
    useRef,
    Profiler,
} from "react";
import { LayoutContainer } from "../../Components/Layout";
import { LayoutBuilder } from "../../Components/Layout";
import {
    DashboardContext,
    DashboardWrapper,
    DashboardThemeProvider,
} from "../../Context";
import {
    deepCopy,
    FontAwesomeIcon,
    ThemeContext,
    EmptyState,
    ButtonIcon,
} from "@trops/dash-react";
import { LayoutModel } from "../../Models";
import { ThemeManagerModal } from "../../Components/Theme";
import { AppSettingsModal } from "../../Components/Settings";

import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { DashboardHeader } from "../../Components/Dashboard";
import { WorkspaceModel, MenuItemModel } from "../../Models";

import { DashboardLoaderModal } from "./Modal/DashboardLoaderModal";
import { LayoutManagerModal } from "../Layout/LayoutManager";

import { DashCommandPalette } from "../Navigation/DashCommandPalette";
import { DashTabBar } from "../Navigation/DashTabBar";
import { DashSidebar } from "../Navigation/DashSidebar";
import { WidgetSidebar } from "../Navigation/WidgetSidebar";

import { AppContext } from "../../Context/App/AppContext";

/**
 * DashboardStage - Main application wrapper component
 *
 * This component manages the overall dashboard application stage, including:
 * - Workspace (dashboard) selection and management
 * - Tab-based multi-dashboard navigation
 * - CommandPalette for quick access to all features
 * - Preview/edit mode toggling
 * - Menu items and navigation
 * - Modal management (settings, theme, loaders)
 *
 * Note: This is the application-level wrapper, not an individual user dashboard.
 * User dashboards are called "workspaces" in the backend API.
 */
export const DashboardStage = ({
    dashApi,
    credentials,
    workspace = null,
    preview = true,
    backgroundColor = null,
}) => {
    return (
        <Profiler id="myapp" onRender={() => {}}>
            <DashboardWrapper
                dashApi={dashApi}
                credentials={credentials}
                backgroundColor={backgroundColor}
            >
                <DashboardStageInner
                    dashApi={dashApi}
                    credentials={credentials}
                    workspace={workspace}
                    preview={preview}
                    backgroundColor={backgroundColor}
                />
            </DashboardWrapper>
        </Profiler>
    );
};

const DashboardStageInner = ({
    dashApi,
    credentials,
    workspace = null,
    preview = true,
    backgroundColor = null,
}) => {
    const { pub } = useContext(DashboardContext);
    const appContext = useContext(AppContext);

    /**
     * ThemeContext — consumed here, inside DashboardWrapper/ThemeWrapper
     */
    const {
        changeCurrentTheme,
        themeVariant,
        changeThemeVariant,
        themes,
        themeKey,
    } = useContext(ThemeContext);

    // ─── Tab State ────────────────────────────────────────────────────
    const [openTabs, setOpenTabs] = useState([]);
    const [activeTabId, setActiveTabId] = useState(null);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [widgetSidebarCollapsed, setWidgetSidebarCollapsed] = useState(true);

    // Derive workspaceSelected from active tab
    const workspaceSelected = activeTabId
        ? openTabs.find((tab) => tab.id === activeTabId)?.workspace ?? null
        : null;

    /**
     * @param {Boolean} previewMode this is a toggle telling the dash we are editing
     */
    const [previewMode, setPreviewMode] = useState(preview);

    /**
     * @param {String["layout", "workspace", "widget"]} editMode this is the actual mode we are in
     */
    const [editMode] = useState("all"); // for the time being use "all" as our "old" way

    // Workspace Management (loading)
    const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
    const [isLoadingMenuItems, setIsLoadingMenuItems] = useState(false);
    const [menuItems, setMenuItems] = useState([]);
    const [workspaceConfig, setWorkspaceConfig] = useState([]);

    // Modal state
    const [isThemeManagerOpen, setIsThemeManagerOpen] = useState(false);
    const [isDashboardLoaderOpen, setIsDashboardLoaderOpen] = useState(false);
    const [isLayoutPickerOpen, setIsLayoutPickerOpen] = useState(false);

    // Unified App Settings Modal
    const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false);
    const [appSettingsInitialSection, setAppSettingsInitialSection] =
        useState("dashboards");

    function openAppSettings(section = "dashboards") {
        setAppSettingsInitialSection(section);
        setIsAppSettingsOpen(true);
    }

    // Ref to access LayoutBuilder's current workspace without re-render cascades
    const currentWorkspaceRef = useRef(null);

    // Snapshot of the workspace before editing — used to restore on Cancel
    const originalWorkspaceRef = useRef(null);

    useEffect(() => {
        console.log(
            "DASHBOARD ",
            menuItems,
            dashApi,
            pub,
            // settings,
            workspaceConfig,
            workspaceSelected,
            workspace
        );
        console.log("dashboard use effect", workspaceSelected, workspace);
        isLoadingWorkspaces === false && loadWorkspaces();
        isLoadingMenuItems === false && loadMenuItems();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspace]);

    // ─── Tab Handlers ─────────────────────────────────────────────────

    function handleOpenTab(workspaceItem) {
        if (!workspaceItem) return;

        const existingTab = openTabs.find((tab) => tab.id === workspaceItem.id);
        if (existingTab) {
            // Tab already open — just switch to it
            setActiveTabId(existingTab.id);
        } else {
            // Open new tab
            const newTab = {
                id: workspaceItem.id,
                name: workspaceItem.name || "Untitled",
                workspace: workspaceItem,
            };
            setOpenTabs((prev) => [...prev, newTab]);
            setActiveTabId(workspaceItem.id);
        }
        setPreviewMode(true);
        setSidebarCollapsed(true);
    }

    function handleCloseTab(tabId) {
        setOpenTabs((prev) => {
            const remaining = prev.filter((tab) => tab.id !== tabId);
            if (activeTabId === tabId) {
                // Switch to last remaining tab, or null
                const newActive =
                    remaining.length > 0
                        ? remaining[remaining.length - 1].id
                        : null;
                setActiveTabId(newActive);
            }
            return remaining;
        });
    }

    function handleSwitchTab(tabId) {
        setActiveTabId(tabId);
        setPreviewMode(true);
    }

    // Update tab workspace reference when workspace changes
    function updateTabWorkspace(ws) {
        if (!ws) return;
        setOpenTabs((prev) =>
            prev.map((tab) =>
                tab.id === ws.id
                    ? { ...tab, name: ws.name || "Untitled", workspace: ws }
                    : tab
            )
        );
    }

    // ─── New Workspace from Empty State ───────────────────────────────

    function handleClickNewFromEmpty() {
        setIsLayoutPickerOpen(true);
    }

    function handleCreateFromTemplate(layoutObj, themeKey = null, name = null) {
        try {
            const newWorkspace = WorkspaceModel({
                layout: [layoutObj],
                themeKey,
                menuId: layoutObj.menuId,
                name: name || undefined,
            });
            handleOpenTab(newWorkspace);
            setSidebarCollapsed(true);
            setPreviewMode(false);
        } catch (e) {
            console.log(e);
        }
    }

    // ─── Workspace Loading ────────────────────────────────────────────

    function loadWorkspaces() {
        try {
            console.log("1. Loading Workspaces =========================");
            setIsLoadingWorkspaces(() => true);

            if (dashApi && credentials) {
                dashApi.listWorkspaces(
                    credentials.appId,
                    handleLoadWorkspacesComplete,
                    handleLoadWorkspacesError
                );
            }
        } catch (e) {
            console.log("failed loadWorkspaces ", e.message);
        }
    }

    function handleLoadWorkspacesComplete(e, message) {
        try {
            console.log("handleLoadWorkspacesComplete called", e, message);
            console.log(
                "workspaces array length:",
                message["workspaces"]?.length
            );
            const workspaces = deepCopy(message["workspaces"]);
            const workspacesTemp = workspaces.map((ws) => {
                const tempLayout = ws["layout"].map((layoutOG) => {
                    return LayoutModel(layoutOG, workspaces, ws["id"]);
                });
                ws["layout"] = tempLayout;
                return WorkspaceModel(ws);
            });

            console.log(
                "Setting workspaceConfig with",
                workspacesTemp.length,
                "workspaces:",
                workspacesTemp
            );
            setWorkspaceConfig(() => workspacesTemp);
            setIsLoadingWorkspaces(false);
        } catch (e) {
            console.log("handle load workspaces complete ERROR", e.message);
        }
    }

    function handleLoadWorkspacesError(e, message) {
        console.log("handleLoadWorkspacesError called", e, message);
        setWorkspaceConfig([]);
    }

    function handleWorkspaceChange(ws) {
        console.log(" dashboard workspace change", ws);
        if (ws) {
            const wsModel = WorkspaceModel(ws);
            setPreviewMode(() => false);

            // Update the tab's workspace reference
            if (activeTabId) {
                setOpenTabs((prev) =>
                    prev.map((tab) =>
                        tab.id === activeTabId
                            ? {
                                  ...tab,
                                  name: wsModel.name || "Untitled",
                                  workspace: wsModel,
                              }
                            : tab
                    )
                );
            }
        }
    }

    function handleProviderSelect(event) {
        /**
         * Callback from ProviderErrorBoundary when user selects a provider
         * event: { widgetId, selectedProviders: { "algolia": "Provider Name", ... } }
         *
         * Updates workspace.selectedProviders[widgetId] with the provider selections
         * and persists to dashboard config.
         *
         * Note: Credentials are stored separately in providers.json (encrypted)
         * This only stores the selected provider NAMES, not credentials.
         */
        console.log("Provider selected:", event);
        const { widgetId, selectedProviders: updatedProviders } = event;

        if (workspaceSelected && widgetId) {
            // Build widget-specific provider selections
            const currentSelections = workspaceSelected.selectedProviders || {};
            const updatedWorkspace = {
                ...workspaceSelected,
                selectedProviders: {
                    ...currentSelections,
                    [widgetId]: updatedProviders, // Store provider selections keyed by widgetId
                },
            };

            // Update the tab's workspace reference
            updateTabWorkspace(updatedWorkspace);

            // Persist to main app via IPC
            try {
                dashApi.saveWorkspace(
                    credentials.appId,
                    updatedWorkspace,
                    (e, result) => {
                        console.log(
                            "Workspace saved with provider selections:",
                            result
                        );
                    },
                    (e, error) => {
                        console.error(
                            "Failed to save workspace with provider selections:",
                            error
                        );
                    }
                );
            } catch (e) {
                console.error("Error saving workspace:", e);
            }
        }
    }

    function renderComponent(workspaceItem) {
        try {
            return workspaceItem !== undefined ? (
                <LayoutBuilder
                    dashboardId={workspaceItem["id"]}
                    preview={previewMode}
                    workspace={workspaceItem}
                    onWorkspaceChange={handleWorkspaceChange}
                    onProviderSelect={handleProviderSelect}
                    onTogglePreview={handleToggleEditMode}
                    key={`LayoutBuilder-${workspaceItem["id"]}`}
                    editMode={editMode}
                    workspaceRef={currentWorkspaceRef}
                />
            ) : null;
        } catch (e) {
            console.log(e);
            return null;
        }
    }

    function loadMenuItems() {
        try {
            console.log("loading menu items", credentials);
            setIsLoadingMenuItems(() => true);
            // we have to remove the widgetConfig which contains the component
            // sanitize the workspace layout remove widgetConfig items
            if (dashApi && credentials) {
                dashApi.listMenuItems(
                    credentials.appId,
                    handleListMenuItemComplete,
                    handleListMenuItemError
                );
            }
        } catch (e) {
            console.log("Error loading menu items", e.message);
        }
    }

    function handleListMenuItemComplete(e, message) {
        try {
            console.log("list menu items complete ", e, message);
            setMenuItems(() => message.menuItems);
            setIsLoadingMenuItems(() => false);
            if (message.menuItems.length === 0) openAppSettings("folders");
        } catch (error) {
            console.log("handle list menu items error ", error);
        }
    }

    function handleListMenuItemError(e, message) {
        setMenuItems(() => []);
        setIsLoadingMenuItems(() => false);
    }

    function handleSaveNewMenuItem(menuItem) {
        // we have to remove the widgetConfig which contains the component
        // sanitize the workspace layout remove widgetConfig items

        if (dashApi && credentials) {
            dashApi.saveMenuItem(
                credentials.appId,
                MenuItemModel(menuItem),
                handleSaveMenuItemComplete,
                handleSaveMenuItemError
            );
        }
    }

    function handleSaveMenuItemComplete(e, message) {
        loadMenuItems();
    }

    function handleSaveMenuItemError(e, message) {
        console.log(e, message);
    }

    function handleToggleEditMode() {
        if (previewMode) {
            // Entering edit mode — snapshot the current workspace
            originalWorkspaceRef.current = deepCopy(workspaceSelected);
            setPreviewMode(false);
        } else {
            // Canceling edit mode — restore original workspace
            if (originalWorkspaceRef.current) {
                updateTabWorkspace(originalWorkspaceRef.current);
            }
            currentWorkspaceRef.current = null;
            originalWorkspaceRef.current = null;
            setPreviewMode(true);
        }
    }

    function handleWorkspaceNameChange(name) {
        console.log("workspace name change ", name);
        if (!workspaceSelected) return;
        const tempWorkspace = deepCopy(
            currentWorkspaceRef.current || workspaceSelected
        );
        tempWorkspace["name"] = name;

        // Update the tab name and workspace reference
        updateTabWorkspace(tempWorkspace);
    }

    function handleWorkspaceFolderChange(menuId) {
        if (!workspaceSelected) return;
        const tempWorkspace = deepCopy(
            currentWorkspaceRef.current || workspaceSelected
        );
        tempWorkspace["menuId"] = Number(menuId);
        updateTabWorkspace(tempWorkspace);
    }

    function handleWorkspaceThemeChange(themeKey) {
        if (!workspaceSelected) return;
        const tempWorkspace = deepCopy(
            currentWorkspaceRef.current || workspaceSelected
        );
        tempWorkspace["themeKey"] = themeKey || null;
        updateTabWorkspace(tempWorkspace);
    }

    function handleScrollableChange(enabled) {
        if (!workspaceSelected) return;
        const tempWorkspace = deepCopy(
            currentWorkspaceRef.current || workspaceSelected
        );
        // Find the root grid container layout item
        const rootItem = tempWorkspace.layout?.find(
            (item) => item.parent === 0
        );
        if (rootItem) {
            rootItem.scrollable = enabled;
        }
        // Update ref immediately so getRootScrollable() reads the new value
        // before LayoutBuilder's async useEffect syncs it
        currentWorkspaceRef.current = tempWorkspace;
        updateTabWorkspace(tempWorkspace);
    }

    // Derive scrollable state from root layout item
    function getRootScrollable() {
        const ws = currentWorkspaceRef.current || workspaceSelected;
        if (!ws?.layout) return false;
        const rootItem = ws.layout.find((item) => item.parent === 0);
        return rootItem?.scrollable || false;
    }

    function handleClickSaveWorkspace() {
        try {
            console.log("dashboard clicked save workspace ", workspaceSelected);
            // we have to remove the widgetConfig which contains the component
            // sanitize the workspace layout remove widgetConfig items
            const workspaceToSave = deepCopy(
                currentWorkspaceRef.current || workspaceSelected
            );
            const layout = workspaceToSave["layout"].map((layoutItem) => {
                delete layoutItem["widgetConfig"];
                // delete layoutItem["api"];
                return layoutItem;
            });
            workspaceToSave["layout"] = layout;

            // lets set a version so that we can compare...
            workspaceToSave["version"] = Date.now();

            if (dashApi && credentials) {
                dashApi.saveWorkspace(
                    credentials.appId,
                    workspaceToSave,
                    handleSaveWorkspaceComplete,
                    handleSaveWorkspaceError
                );
            }
        } catch (e) {
            console.log(e.message);
        }
    }

    function handleSaveWorkspaceComplete(e, message) {
        console.log("handle save complete ", e, message);

        // Reconstruct workspaces through LayoutModel (same as load path)
        const workspaces = deepCopy(message["workspaces"]);
        const workspacesTemp = workspaces.map((ws) => {
            const tempLayout = ws["layout"].map((layoutOG) => {
                return LayoutModel(layoutOG, workspaces, ws["id"]);
            });
            ws["layout"] = tempLayout;
            return WorkspaceModel(ws);
        });

        pub.pub("dashboard.workspaceChange", {
            workspaces: workspacesTemp,
        });
        setWorkspaceConfig(() => workspacesTemp);
        setIsLoadingWorkspaces(false);

        // Update the active tab with the fresh saved workspace (not stale closure)
        if (workspaceSelected && activeTabId) {
            const savedWs = workspacesTemp.find(
                (ws) => ws.id === workspaceSelected.id
            );
            if (savedWs) {
                setOpenTabs((prev) =>
                    prev.map((tab) =>
                        tab.id === activeTabId
                            ? {
                                  ...tab,
                                  name: savedWs.name || "Untitled",
                                  workspace: savedWs,
                              }
                            : tab
                    )
                );
            }
        }

        // Clear edit-mode refs — edits are now persisted
        currentWorkspaceRef.current = null;
        originalWorkspaceRef.current = null;

        setPreviewMode(() => true);
    }

    function handleSaveWorkspaceError(e, message) {
        console.log(e, message);
    }

    function handleOpenThemeManager() {
        setIsThemeManagerOpen(true);
    }

    function handleSelectLoadDashboard(dashboardSelected) {
        try {
            const newLayout = dashboardSelected.layout;
            const workspaceItem = WorkspaceModel({ layout: newLayout });

            console.log("clicked load workspace item", workspaceItem);
            setPreviewMode(() => false);
            handleOpenTab(workspaceItem);
            setIsDashboardLoaderOpen(false);
        } catch (e) {
            console.log(e);
        }
    }

    function handleCloseDashboardLoader() {
        setIsDashboardLoaderOpen(false);
    }

    function handleToggleThemeVariant() {
        changeThemeVariant(themeVariant === "dark" ? "light" : "dark");
    }

    return (
        <LayoutContainer
            padding={false}
            space={false}
            height="h-full"
            width="w-full"
            direction="col"
            scrollable={false}
            grow={true}
        >
            {/* ─── Main Content Area ──────────────────────── */}
            <DndProvider backend={HTML5Backend}>
                <div className="flex flex-row flex-1 overflow-hidden">
                    <DashSidebar
                        collapsed={sidebarCollapsed}
                        onCollapsedChange={setSidebarCollapsed}
                        workspaces={workspaceConfig}
                        menuItems={menuItems}
                        activeTabId={activeTabId}
                        onOpenWorkspace={handleOpenTab}
                        onNewDashboard={() => setIsLayoutPickerOpen(true)}
                        onGoHome={() =>
                            activeTabId && handleCloseTab(activeTabId)
                        }
                        onOpenProviders={() => openAppSettings("providers")}
                        onOpenThemeManager={handleOpenThemeManager}
                        onOpenFolders={() => openAppSettings("folders")}
                        onOpenSettings={() => openAppSettings("general")}
                        onOpenCommandPalette={() =>
                            setIsCommandPaletteOpen(true)
                        }
                    />
                    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                        {workspaceSelected !== null ? (
                            <>
                                <DashboardHeader
                                    workspace={workspaceSelected}
                                    preview={previewMode}
                                    onNameChange={handleWorkspaceNameChange}
                                    onClickEdit={handleToggleEditMode}
                                    onSaveChanges={handleClickSaveWorkspace}
                                    menuItems={menuItems}
                                    themes={themes || {}}
                                    onFolderChange={handleWorkspaceFolderChange}
                                    onThemeChange={handleWorkspaceThemeChange}
                                    scrollableEnabled={getRootScrollable()}
                                    onScrollableChange={handleScrollableChange}
                                />
                                <DashboardThemeProvider
                                    themeKey={workspaceSelected?.themeKey}
                                >
                                    <div
                                        className={`flex flex-col w-full flex-1 ${
                                            previewMode === true
                                                ? "overflow-y-auto"
                                                : "overflow-clip"
                                        }`}
                                    >
                                        {renderComponent(workspaceSelected)}
                                    </div>
                                </DashboardThemeProvider>
                                <DashTabBar
                                    tabs={openTabs}
                                    activeTabId={activeTabId}
                                    onSwitchTab={handleSwitchTab}
                                    onCloseTab={handleCloseTab}
                                />
                            </>
                        ) : (
                            <div className="flex flex-1 items-center justify-center">
                                <EmptyState
                                    icon={
                                        <FontAwesomeIcon
                                            icon="clone"
                                            className="h-12 w-12"
                                        />
                                    }
                                    title="No dashboards open"
                                    description="Press ⌘K to search dashboards, or create a new one."
                                >
                                    <div className="flex flex-row gap-2">
                                        <ButtonIcon
                                            icon="magnifying-glass"
                                            text="Search"
                                            onClick={() =>
                                                setIsCommandPaletteOpen(true)
                                            }
                                            size="sm"
                                        />
                                        <ButtonIcon
                                            icon="plus"
                                            text="New Dashboard"
                                            onClick={handleClickNewFromEmpty}
                                            size="sm"
                                        />
                                    </div>
                                </EmptyState>
                            </div>
                        )}
                    </div>
                    {!previewMode && workspaceSelected && (
                        <WidgetSidebar
                            collapsed={widgetSidebarCollapsed}
                            onCollapsedChange={setWidgetSidebarCollapsed}
                        />
                    )}
                </div>

                {/* ─── Modals ────────────────────────────── */}
                <AppSettingsModal
                    isOpen={isAppSettingsOpen}
                    setIsOpen={setIsAppSettingsOpen}
                    initialSection={appSettingsInitialSection}
                    workspaces={workspaceConfig}
                    menuItems={menuItems}
                    dashApi={dashApi}
                    credentials={credentials}
                    onReloadWorkspaces={loadWorkspaces}
                    onReloadMenuItems={loadMenuItems}
                    onOpenThemeEditor={() => {
                        setIsAppSettingsOpen(false);
                        setIsThemeManagerOpen(true);
                    }}
                />

                <ThemeManagerModal
                    open={isThemeManagerOpen}
                    setIsOpen={() => setIsThemeManagerOpen(!isThemeManagerOpen)}
                    onSave={(themeKey) => {
                        changeCurrentTheme(themeKey);
                        setIsThemeManagerOpen(() => false);
                    }}
                />

                <DashboardLoaderModal
                    open={isDashboardLoaderOpen}
                    setIsOpen={setIsDashboardLoaderOpen}
                    workspaces={workspaceConfig}
                    onSelecDashboard={handleSelectLoadDashboard}
                    onClose={() => handleCloseDashboardLoader()}
                />

                <LayoutManagerModal
                    open={isLayoutPickerOpen}
                    setIsOpen={setIsLayoutPickerOpen}
                    onCreateWorkspace={handleCreateFromTemplate}
                    menuItems={menuItems}
                    onSaveMenuItem={handleSaveNewMenuItem}
                />
            </DndProvider>

            {/* ─── CommandPalette Overlay ──────────────────── */}
            <DashCommandPalette
                isOpen={isCommandPaletteOpen}
                setIsOpen={setIsCommandPaletteOpen}
                workspaces={workspaceConfig}
                openTabs={openTabs}
                menuItems={menuItems}
                onOpenWorkspace={handleOpenTab}
                onCreateNewWorkspace={handleClickNewFromEmpty}
                onCreateNewFolder={() => openAppSettings("folders")}
                onLoadDashboard={() => setIsDashboardLoaderOpen(true)}
                providers={appContext?.providers || {}}
                onCreateNewProvider={() => openAppSettings("providers")}
                themes={themes || {}}
                currentThemeKey={themeKey}
                themeVariant={themeVariant}
                onChangeTheme={changeCurrentTheme}
                onOpenThemeManager={handleOpenThemeManager}
                onToggleThemeVariant={handleToggleThemeVariant}
                onOpenSettings={() => openAppSettings("general")}
                debugMode={appContext?.debugMode || false}
                onToggleDebugMode={() =>
                    appContext?.changeDebugMode &&
                    appContext.changeDebugMode(!appContext.debugMode)
                }
                onOpenDiscover={() => openAppSettings("widgets")}
            />
        </LayoutContainer>
    );
};
