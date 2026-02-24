import React, { useState, useCallback } from "react";
import { CommandPalette, FontAwesomeIcon } from "@trops/dash-react";

export const DashCommandPalette = ({
    isOpen,
    setIsOpen,
    // Dashboard data
    workspaces = [],
    openTabs = [],
    menuItems = [],
    // Provider data
    providers = {},
    // Theme data
    themes = {},
    currentThemeKey = null,
    themeVariant = "dark",
    // Dashboard actions
    onOpenWorkspace = null,
    onCreateNewWorkspace = null,
    onCreateNewFolder = null,
    onLoadDashboard = null,
    // Theme actions
    onChangeTheme = null,
    onOpenThemeManager = null,
    onToggleThemeVariant = null,
    // Provider actions
    onCreateNewProvider = null,
    // Settings actions
    onOpenSettings = null,
    onToggleDebugMode = null,
    debugMode = false,
    // Discover
    onOpenDiscover = null,
}) => {
    const [query, setQuery] = useState("");

    const handleSelect = useCallback(
        (action) => {
            if (action) action();
            setIsOpen(false);
        },
        [setIsOpen]
    );

    const matchesQuery = useCallback(
        (text) => {
            if (!query) return true;
            return text.toLowerCase().includes(query.toLowerCase());
        },
        [query]
    );

    // Build dashboard items
    const openTabIds = openTabs.map((t) => t.id);

    const dashboardItems = workspaces
        .filter((ws) => matchesQuery(ws.name || "Untitled"))
        .map((ws) => {
            const widgetCount = (ws.layout || []).length;
            const versionDate =
                ws.version && ws.version > 1
                    ? new Date(ws.version).toLocaleDateString()
                    : null;

            return {
                key: `ws-${ws.id}`,
                label: ws.name || "Untitled",
                detail: versionDate
                    ? `${widgetCount} widget${
                          widgetCount !== 1 ? "s" : ""
                      } · ${versionDate}`
                    : `${widgetCount} widget${widgetCount !== 1 ? "s" : ""}`,
                isOpen: openTabIds.includes(ws.id),
                action: () => onOpenWorkspace && onOpenWorkspace(ws),
            };
        });

    const dashboardActions = [
        matchesQuery("New Dashboard") && {
            key: "new-dashboard",
            label: "New Dashboard",
            icon: "plus",
            shortcut: "⌘N",
            action: () => onCreateNewWorkspace && onCreateNewWorkspace(),
        },
        matchesQuery("Load Dashboard") && {
            key: "load-dashboard",
            label: "Load Dashboard...",
            icon: "database",
            action: () => onLoadDashboard && onLoadDashboard(),
        },
        matchesQuery("New Folder") && {
            key: "new-folder",
            label: "New Folder",
            icon: "folder-plus",
            action: () => onCreateNewFolder && onCreateNewFolder(),
        },
    ].filter(Boolean);

    const showDashboards =
        dashboardItems.length > 0 || dashboardActions.length > 0;

    // Build provider items
    const providerList = Object.entries(providers)
        .filter(([name]) => matchesQuery(name))
        .map(([name, provider]) => ({
            key: `prov-${name}`,
            label: name,
            type: provider.type || "",
        }));

    const providerActions = [
        matchesQuery("Create New Provider") && {
            key: "create-provider",
            label: "Create New Provider",
            icon: "plus",
            action: () => onCreateNewProvider && onCreateNewProvider(),
        },
        matchesQuery("Manage Providers") && {
            key: "manage-providers",
            label: "Manage Providers...",
            icon: "cog",
            action: () => onOpenSettings && onOpenSettings(),
        },
    ].filter(Boolean);

    const showProviders = providerList.length > 0 || providerActions.length > 0;

    // Build theme items
    const themeList = Object.entries(themes)
        .filter(([, theme]) => matchesQuery(theme.name || ""))
        .map(([key, theme]) => ({
            key: `theme-${key}`,
            label: theme.name || key,
            isActive: key === currentThemeKey,
            action: () => onChangeTheme && onChangeTheme(key),
        }));

    const themeActions = [
        matchesQuery("Toggle Light Dark Mode") && {
            key: "toggle-variant",
            label: `Toggle ${themeVariant === "dark" ? "Light" : "Dark"} Mode`,
            icon: themeVariant === "dark" ? "sun" : "moon",
            action: () => onToggleThemeVariant && onToggleThemeVariant(),
        },
        matchesQuery("Open Theme Editor") && {
            key: "theme-editor",
            label: "Open Theme Editor...",
            icon: "palette",
            action: () => onOpenThemeManager && onOpenThemeManager(),
        },
    ].filter(Boolean);

    const showThemes = themeList.length > 0 || themeActions.length > 0;

    // Build settings items
    const settingsItems = [
        matchesQuery("Discover Widgets") && {
            key: "discover-widgets",
            label: "Discover Widgets",
            icon: "compass",
            action: () => onOpenDiscover && onOpenDiscover(),
        },
        matchesQuery("Application Settings") && {
            key: "settings",
            label: "Application Settings",
            icon: "cog",
            shortcut: "⌘,",
            action: () => onOpenSettings && onOpenSettings(),
        },
        matchesQuery("Toggle Debug Mode") && {
            key: "debug",
            label: `Toggle Debug Mode ${debugMode ? "(On)" : "(Off)"}`,
            icon: "hammer",
            action: () => onToggleDebugMode && onToggleDebugMode(),
        },
    ].filter(Boolean);

    const showSettings = settingsItems.length > 0;

    return (
        <CommandPalette
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            placeholder="Search commands..."
            onQueryChange={setQuery}
        >
            {/* Dashboards Group */}
            {showDashboards && (
                <CommandPalette.Group label="Dashboards">
                    {dashboardItems.map((item) => (
                        <CommandPalette.Item
                            key={item.key}
                            icon={
                                <FontAwesomeIcon
                                    icon="clone"
                                    className="h-3.5 w-3.5"
                                />
                            }
                            onSelect={() => handleSelect(item.action)}
                        >
                            {item.label}
                            {item.isOpen && (
                                <span className="text-xs opacity-40 ml-2">
                                    open
                                </span>
                            )}
                            <span className="text-xs opacity-30 ml-2">
                                {item.detail}
                            </span>
                        </CommandPalette.Item>
                    ))}
                    {dashboardActions.map((item) => (
                        <CommandPalette.Item
                            key={item.key}
                            icon={
                                <FontAwesomeIcon
                                    icon={item.icon}
                                    className="h-3.5 w-3.5"
                                />
                            }
                            shortcut={item.shortcut || null}
                            onSelect={() => handleSelect(item.action)}
                        >
                            {item.label}
                        </CommandPalette.Item>
                    ))}
                </CommandPalette.Group>
            )}

            {/* Providers Group */}
            {showProviders && (
                <CommandPalette.Group label="Providers">
                    {providerList.length === 0 && !query && (
                        <CommandPalette.Item
                            icon={
                                <FontAwesomeIcon
                                    icon="plug"
                                    className="h-3.5 w-3.5 opacity-40"
                                />
                            }
                        >
                            <span className="opacity-40">
                                No providers configured
                            </span>
                        </CommandPalette.Item>
                    )}
                    {providerList.map((item) => (
                        <CommandPalette.Item
                            key={item.key}
                            icon={
                                <FontAwesomeIcon
                                    icon="plug"
                                    className="h-3.5 w-3.5"
                                />
                            }
                        >
                            {item.label}
                            {item.type && (
                                <span className="text-xs opacity-40 ml-2">
                                    {item.type}
                                </span>
                            )}
                        </CommandPalette.Item>
                    ))}
                    {providerActions.map((item) => (
                        <CommandPalette.Item
                            key={item.key}
                            icon={
                                <FontAwesomeIcon
                                    icon={item.icon}
                                    className="h-3.5 w-3.5"
                                />
                            }
                            onSelect={() => handleSelect(item.action)}
                        >
                            {item.label}
                        </CommandPalette.Item>
                    ))}
                </CommandPalette.Group>
            )}

            {/* Themes Group */}
            {showThemes && (
                <CommandPalette.Group label="Themes">
                    {themeList.map((item) => (
                        <CommandPalette.Item
                            key={item.key}
                            icon={
                                <FontAwesomeIcon
                                    icon="palette"
                                    className="h-3.5 w-3.5"
                                />
                            }
                            active={item.isActive}
                            onSelect={() => handleSelect(item.action)}
                        >
                            {item.label}
                            {item.isActive && (
                                <span className="text-xs opacity-40 ml-2">
                                    active
                                </span>
                            )}
                        </CommandPalette.Item>
                    ))}
                    {themeActions.map((item) => (
                        <CommandPalette.Item
                            key={item.key}
                            icon={
                                <FontAwesomeIcon
                                    icon={item.icon}
                                    className="h-3.5 w-3.5"
                                />
                            }
                            onSelect={() => handleSelect(item.action)}
                        >
                            {item.label}
                        </CommandPalette.Item>
                    ))}
                </CommandPalette.Group>
            )}

            {/* Settings Group */}
            {showSettings && (
                <CommandPalette.Group label="Settings">
                    {settingsItems.map((item) => (
                        <CommandPalette.Item
                            key={item.key}
                            icon={
                                <FontAwesomeIcon
                                    icon={item.icon}
                                    className="h-3.5 w-3.5"
                                />
                            }
                            shortcut={item.shortcut || null}
                            onSelect={() => handleSelect(item.action)}
                        >
                            {item.label}
                        </CommandPalette.Item>
                    ))}
                </CommandPalette.Group>
            )}
        </CommandPalette>
    );
};
