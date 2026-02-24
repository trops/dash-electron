import React, { useContext } from "react";
import { FontAwesomeIcon, Sidebar, ThemeContext } from "@trops/dash-react";

export const DashSidebar = ({
    collapsed,
    onCollapsedChange,
    workspaces = [],
    menuItems = [],
    activeTabId = null,
    onOpenWorkspace,
    onNewDashboard,
    onGoHome,
    onOpenProviders,
    onOpenThemeManager,
    onOpenFolders,
    onOpenSettings,
    onOpenCommandPalette,
}) => {
    const { themeVariant, changeThemeVariant } = useContext(ThemeContext);
    const workspacesForFolder = (folderId) =>
        workspaces.filter((ws) => ws.menuId === folderId);

    const orphanedWorkspaces = workspaces.filter(
        (ws) => !menuItems.some((mi) => mi.id === ws.menuId)
    );

    return (
        <Sidebar
            collapsed={collapsed}
            onCollapsedChange={onCollapsedChange}
            width="w-56"
            collapsedWidth="w-12"
        >
            <Sidebar.Header>
                <div className="flex items-center justify-between">
                    {!collapsed && (
                        <span className="font-bold text-lg tracking-tight opacity-80">
                            Dash.
                        </span>
                    )}
                    <Sidebar.Trigger />
                </div>
            </Sidebar.Header>

            <Sidebar.Content>
                {/* Home */}
                <Sidebar.Item
                    icon={
                        <FontAwesomeIcon icon="home" className="h-3.5 w-3.5" />
                    }
                    active={activeTabId === null}
                    onClick={onGoHome}
                >
                    Home
                </Sidebar.Item>

                {/* Search */}
                <Sidebar.Item
                    icon={
                        <FontAwesomeIcon
                            icon="magnifying-glass"
                            className="h-3.5 w-3.5"
                        />
                    }
                    onClick={onOpenCommandPalette}
                >
                    Search
                </Sidebar.Item>

                <Sidebar.Item
                    icon={
                        <FontAwesomeIcon icon="plug" className="h-3.5 w-3.5" />
                    }
                    onClick={onOpenProviders}
                >
                    Providers
                </Sidebar.Item>
                <Sidebar.Item
                    icon={
                        <FontAwesomeIcon
                            icon="palette"
                            className="h-3.5 w-3.5"
                        />
                    }
                    onClick={onOpenThemeManager}
                >
                    Themes
                </Sidebar.Item>
                <Sidebar.Item
                    icon={
                        <FontAwesomeIcon
                            icon="folder"
                            className="h-3.5 w-3.5"
                        />
                    }
                    onClick={onOpenFolders}
                >
                    Folders
                </Sidebar.Item>
                <Sidebar.Item
                    icon={
                        <FontAwesomeIcon icon="cog" className="h-3.5 w-3.5" />
                    }
                    onClick={onOpenSettings}
                >
                    Settings
                </Sidebar.Item>
                <Sidebar.Item
                    icon={
                        <FontAwesomeIcon
                            icon={themeVariant === "dark" ? "sun" : "moon"}
                            className="h-3.5 w-3.5"
                        />
                    }
                    onClick={() =>
                        changeThemeVariant(
                            themeVariant === "dark" ? "light" : "dark"
                        )
                    }
                >
                    {themeVariant === "dark" ? "Light Mode" : "Dark Mode"}
                </Sidebar.Item>

                {/* Dashboards */}
                <Sidebar.Group label="Dashboards">
                    <Sidebar.Item
                        icon={
                            <FontAwesomeIcon
                                icon="plus"
                                className="h-3.5 w-3.5"
                            />
                        }
                        onClick={onNewDashboard}
                    >
                        New Dashboard
                    </Sidebar.Item>
                </Sidebar.Group>

                {/* Dashboard folders (only when expanded) */}
                {!collapsed && (
                    <>
                        {menuItems.map((menuItem) => {
                            const folderWorkspaces = workspacesForFolder(
                                menuItem.id
                            );
                            const folderIcon =
                                menuItem.icon || menuItem.folder || "folder";
                            if (folderWorkspaces.length === 0) return null;
                            return (
                                <Sidebar.Group
                                    key={menuItem.id}
                                    label={menuItem.name}
                                >
                                    {folderWorkspaces.map((ws) => (
                                        <Sidebar.Item
                                            key={ws.id}
                                            icon={
                                                <FontAwesomeIcon
                                                    icon={folderIcon}
                                                    className="h-3.5 w-3.5"
                                                />
                                            }
                                            active={ws.id === activeTabId}
                                            onClick={() => onOpenWorkspace(ws)}
                                        >
                                            {(ws.name || "Untitled").replace(
                                                /^./,
                                                (c) => c.toUpperCase()
                                            )}
                                        </Sidebar.Item>
                                    ))}
                                </Sidebar.Group>
                            );
                        })}
                        {orphanedWorkspaces.length > 0 && (
                            <Sidebar.Group label="Uncategorized">
                                {orphanedWorkspaces.map((ws) => (
                                    <Sidebar.Item
                                        key={ws.id}
                                        icon={
                                            <FontAwesomeIcon
                                                icon="clone"
                                                className="h-3.5 w-3.5"
                                            />
                                        }
                                        active={ws.id === activeTabId}
                                        onClick={() => onOpenWorkspace(ws)}
                                    >
                                        {(ws.name || "Untitled").replace(
                                            /^./,
                                            (c) => c.toUpperCase()
                                        )}
                                    </Sidebar.Item>
                                ))}
                            </Sidebar.Group>
                        )}
                    </>
                )}
            </Sidebar.Content>
        </Sidebar>
    );
};
