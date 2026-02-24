/**
 * EnhancedWidgetDropdown
 *
 * Mac Finder-style widget selector with three-column navigation.
 * Features:
 * - Three-column layout: Source | Widget List | Details
 * - Advanced filtering: Search, Author, Provider
 * - Large modal interface (80vw x 90vh)
 * - Theme-aware using dash-react components
 * - Registry integration with two-level browsing (packages + widgets)
 */

import React, { useState, useContext, useEffect, useCallback } from "react";
import {
    ThemeContext,
    Modal,
    Panel,
    Panel3,
    Button,
    Heading,
    Heading3,
    SubHeading3,
    Paragraph,
    Menu3,
    MenuItem3,
} from "@trops/dash-react";
import { ComponentManager } from "../../../../ComponentManager";
import { WidgetIcon } from "./WidgetIcon";
import { AppContext } from "../../../../Context/App/AppContext";
import { ProviderForm } from "../../../Provider/ProviderForm";

export const EnhancedWidgetDropdown = ({
    isOpen,
    onClose,
    onSelectWidget,
    workspaceType = null,
}) => {
    const { currentTheme } = useContext(ThemeContext);
    const {
        providers: availableProviders = {},
        dashApi,
        credentials,
        refreshProviders,
    } = useContext(AppContext);

    // State management
    const [selectedSource, setSelectedSource] = useState("Installed"); // "Installed" | "Discover"
    const [selectedWidget, setSelectedWidget] = useState(null);
    const [widgets, setWidgets] = useState([]);

    // Filter state
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedAuthor, setSelectedAuthor] = useState("all");
    const [selectedProvider, setSelectedProvider] = useState("all");

    // Phase 2: Provider and userConfig state
    const [selectedProviders, setSelectedProviders] = useState({});
    const [userConfigValues, setUserConfigValues] = useState({});

    // Phase 3: Recent widgets state
    const [recentWidgets, setRecentWidgets] = useState([]);

    // Inline provider creation state
    const [inlineCreateType, setInlineCreateType] = useState(null);
    const [inlineCreateSchema, setInlineCreateSchema] = useState({});
    const [inlineCreateError, setInlineCreateError] = useState(null);
    const [isCreatingProvider, setIsCreatingProvider] = useState(false);

    // Registry state
    const [isLoadingRegistry, setIsLoadingRegistry] = useState(false);
    const [registryError, setRegistryError] = useState(null);
    const [registryPackages, setRegistryPackages] = useState([]);
    const [registryViewMode, setRegistryViewMode] = useState("packages"); // "packages" | "widgets"
    const [expandedPackages, setExpandedPackages] = useState(new Set());
    const [selectedPackage, setSelectedPackage] = useState(null);
    const [isInstalling, setIsInstalling] = useState(false);
    const [installError, setInstallError] = useState(null);

    // Phase 3: Recent Widgets - localStorage functions
    const loadRecentWidgets = () => {
        try {
            const stored = localStorage.getItem("recentWidgets");
            const recentData = stored ? JSON.parse(stored) : [];

            // Get widget details from ComponentManager
            const allWidgets = ComponentManager.map();
            const enrichedRecent = recentData
                .slice(0, 5) // Show top 5
                .map((entry) => {
                    const widget = allWidgets[entry.widgetKey];
                    if (!widget) return null; // Widget no longer exists
                    return {
                        key: entry.widgetKey,
                        ...widget,
                        savedProviders: entry.providers || {},
                        savedUserConfig: entry.userConfig || {},
                        timestamp: entry.timestamp,
                    };
                })
                .filter(Boolean); // Remove null entries

            setRecentWidgets(enrichedRecent);
            console.log(
                "[EnhancedWidgetDropdown] Loaded recent widgets:",
                enrichedRecent
            );
        } catch (error) {
            console.error(
                "[EnhancedWidgetDropdown] Error loading recent widgets:",
                error
            );
            setRecentWidgets([]);
        }
    };

    const saveToRecent = (widget, providers, userConfig) => {
        try {
            const stored = localStorage.getItem("recentWidgets");
            const recent = stored ? JSON.parse(stored) : [];

            // Create new entry
            const newEntry = {
                widgetKey: widget.key,
                timestamp: Date.now(),
                providers: providers || {},
                userConfig: userConfig || {},
            };

            // Remove existing entry for this widget (if any) and add new one at front
            const updated = [
                newEntry,
                ...recent.filter((r) => r.widgetKey !== widget.key),
            ].slice(0, 10); // Keep max 10

            localStorage.setItem("recentWidgets", JSON.stringify(updated));
            console.log("[EnhancedWidgetDropdown] Saved to recent:", newEntry);

            // Reload recent widgets to update UI
            loadRecentWidgets();
        } catch (error) {
            console.error(
                "[EnhancedWidgetDropdown] Error saving to recent:",
                error
            );
        }
    };

    const handleRecentClick = (recentWidget) => {
        console.log(
            "[EnhancedWidgetDropdown] Recent widget clicked:",
            recentWidget
        );
        setSelectedWidget(recentWidget);
        setSelectedProviders(recentWidget.savedProviders || {});
        setUserConfigValues(recentWidget.savedUserConfig || {});
        // Reset inline provider creation form
        setInlineCreateType(null);
        setInlineCreateSchema({});
        setInlineCreateError(null);
    };

    // Fetch widgets when modal opens
    useEffect(() => {
        if (isOpen) {
            loadWidgets();
            loadRecentWidgets(); // Phase 3: Load recent widgets
            // Reset filters when modal opens
            setSearchQuery("");
            setSelectedAuthor("all");
            setSelectedProvider("all");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const loadRegistryWidgets = useCallback(async () => {
        setIsLoadingRegistry(true);
        setRegistryError(null);
        try {
            const result = await window.mainApi.registry.search(
                searchQuery,
                {}
            );
            setRegistryPackages(result.packages || []);

            // Flatten all widgets from all packages for the widget list
            const flatWidgets = [];
            for (const pkg of result.packages || []) {
                for (const widget of pkg.widgets || []) {
                    flatWidgets.push({
                        key: `${pkg.name}/${widget.name}`,
                        name: widget.displayName || widget.name,
                        description: widget.description || "",
                        icon: widget.icon || null,
                        providers: widget.providers || [],
                        isRegistry: true,
                        packageName: pkg.name,
                        packageDisplayName: pkg.displayName || pkg.name,
                        packageVersion: pkg.version,
                        packageAuthor: pkg.author || "",
                        packageDescription: pkg.description || "",
                        packageTags: pkg.tags || [],
                        packageCategory: pkg.category || "",
                        downloadUrl: pkg.downloadUrl || "",
                        repository: pkg.repository || "",
                        publishedAt: pkg.publishedAt || "",
                        packageWidgets: pkg.widgets || [],
                    });
                }
            }
            setWidgets(flatWidgets);
        } catch (error) {
            console.error("[EnhancedWidgetDropdown] Registry error:", error);
            setRegistryError(error.message || "Failed to load registry");
            setWidgets([]);
            setRegistryPackages([]);
        } finally {
            setIsLoadingRegistry(false);
        }
    }, [searchQuery]);

    const loadWidgets = useCallback(() => {
        if (selectedSource === "Installed") {
            // Get widgets from ComponentManager
            const allWidgets = ComponentManager.map();
            const widgetList = Object.keys(allWidgets)
                .map((key) => ({
                    key,
                    ...allWidgets[key],
                }))
                .filter((widget) => widget.type === "widget");

            setWidgets(widgetList);
            setRegistryPackages([]);
            console.log("[EnhancedWidgetDropdown] Loaded widgets:", widgetList);
        } else {
            loadRegistryWidgets();
        }
    }, [selectedSource, loadRegistryWidgets]);

    // Get unique authors from widgets
    const getUniqueAuthors = () => {
        const authors = new Set();
        widgets.forEach((widget) => {
            const author =
                widget.packageAuthor ||
                widget.author ||
                widget.workspace ||
                "Unknown";
            authors.add(author);
        });
        return Array.from(authors).sort();
    };

    // Get unique providers from widgets
    const getUniqueProviders = () => {
        const providers = new Set();
        providers.add("none"); // For widgets without providers
        widgets.forEach((widget) => {
            if (widget.providers && widget.providers.length > 0) {
                widget.providers.forEach((provider) => {
                    providers.add(provider.type);
                });
            }
        });
        return Array.from(providers).sort();
    };

    // Filter widgets based on search, author, and provider
    const getFilteredWidgets = () => {
        const filtered = widgets.filter((widget) => {
            // Search filter
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch =
                !searchQuery ||
                (widget.name || "").toLowerCase().includes(searchLower) ||
                (widget.description || "")
                    .toLowerCase()
                    .includes(searchLower) ||
                (widget.key || "").toLowerCase().includes(searchLower) ||
                (widget.packageName || "")
                    .toLowerCase()
                    .includes(searchLower) ||
                (widget.packageTags || []).some((t) =>
                    t.toLowerCase().includes(searchLower)
                );

            // Author filter
            const widgetAuthor =
                widget.packageAuthor ||
                widget.author ||
                widget.workspace ||
                "Unknown";
            const matchesAuthor =
                selectedAuthor === "all" || widgetAuthor === selectedAuthor;

            // Provider filter
            let matchesProvider = true;
            if (selectedProvider !== "all") {
                if (selectedProvider === "none") {
                    matchesProvider =
                        !widget.providers || widget.providers.length === 0;
                } else {
                    matchesProvider =
                        widget.providers &&
                        widget.providers.some(
                            (p) => p.type === selectedProvider
                        );
                }
            }

            return matchesSearch && matchesAuthor && matchesProvider;
        });

        // Sort alphabetically by name
        return filtered.sort((a, b) =>
            (a.name || "").localeCompare(b.name || "")
        );
    };

    const filteredWidgets = getFilteredWidgets();

    // Group filtered widgets by package (for package view in Discover)
    const getGroupedByPackage = () => {
        const groups = {};
        filteredWidgets.forEach((widget) => {
            const pkgName = widget.packageName || "unknown";
            if (!groups[pkgName]) {
                groups[pkgName] = {
                    name: pkgName,
                    displayName: widget.packageDisplayName || pkgName,
                    author: widget.packageAuthor || "",
                    version: widget.packageVersion || "",
                    description: widget.packageDescription || "",
                    widgets: [],
                };
            }
            groups[pkgName].widgets.push(widget);
        });
        return Object.values(groups);
    };

    // Refresh widget list when installed widgets change
    useEffect(() => {
        const handleWidgetsUpdated = () => {
            if (isOpen && selectedSource === "Installed") {
                loadWidgets();
            }
        };
        window.addEventListener("dash:widgets-updated", handleWidgetsUpdated);
        return () =>
            window.removeEventListener(
                "dash:widgets-updated",
                handleWidgetsUpdated
            );
    }, [isOpen, selectedSource, loadWidgets]);

    // Load widgets when source changes
    useEffect(() => {
        if (isOpen) {
            loadWidgets();
            setSelectedWidget(null);
            setSelectedPackage(null);
            // Clear filters when switching sources
            setSearchQuery("");
            setSelectedAuthor("all");
            setSelectedProvider("all");
            setRegistryError(null);
            setInstallError(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSource]);

    // Reload registry when search changes (debounced)
    useEffect(() => {
        if (selectedSource === "Discover" && isOpen) {
            const timer = setTimeout(() => {
                loadRegistryWidgets();
            }, 300);
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery]);

    const handleWidgetSelect = (widget) => {
        setSelectedWidget(widget);
        setSelectedPackage(widget.isRegistry ? widget.packageName : null);
        // Reset provider and config state when selecting a new widget
        setSelectedProviders({});
        setUserConfigValues({});
        // Reset inline provider creation form
        setInlineCreateType(null);
        setInlineCreateSchema({});
        setInlineCreateError(null);
        setInstallError(null);
    };

    const handlePackageSelect = (pkg) => {
        // Select the first widget of the package to show detail
        if (pkg.widgets && pkg.widgets.length > 0) {
            handleWidgetSelect(pkg.widgets[0]);
        }
        setSelectedPackage(pkg.name);
    };

    const togglePackageExpand = (pkgName) => {
        setExpandedPackages((prev) => {
            const next = new Set(prev);
            if (next.has(pkgName)) {
                next.delete(pkgName);
            } else {
                next.add(pkgName);
            }
            return next;
        });
    };

    const handleProviderSelect = (providerType, providerName) => {
        if (providerName === "__create_new__") {
            // Find credential schema for this provider type
            const providerReq = selectedWidget.providers.find(
                (p) => p.type === providerType
            );

            // Show inline creation form
            setInlineCreateType(providerType);
            setInlineCreateSchema(providerReq?.credentialSchema || {});
            setInlineCreateError(null);
        } else {
            // Normal provider selection - also close any open inline form
            setInlineCreateType(null);
            setInlineCreateSchema({});
            setInlineCreateError(null);
            setSelectedProviders({
                ...selectedProviders,
                [providerType]: providerName,
            });
        }
    };

    const handleInlineProviderSubmit = (formData) => {
        const providerType = inlineCreateType;
        const providerName = formData.name;
        const providerCredentials = formData.credentials;

        console.log(
            `[EnhancedWidgetDropdown] Creating provider inline: ${providerName} (${providerType})`
        );

        setIsCreatingProvider(true);
        setInlineCreateError(null);

        dashApi.saveProvider(
            credentials.appId,
            providerName,
            {
                providerType: providerType,
                credentials: providerCredentials,
            },
            (event, result) => {
                console.log(
                    "[EnhancedWidgetDropdown] Provider saved successfully:",
                    result
                );

                // Refresh AppContext providers so the new provider appears everywhere
                if (refreshProviders) {
                    refreshProviders();
                }

                // Auto-select the newly created provider
                setSelectedProviders((prev) => ({
                    ...prev,
                    [providerType]: providerName,
                }));

                // Collapse the inline form
                setInlineCreateType(null);
                setInlineCreateSchema({});
                setIsCreatingProvider(false);
            },
            (event, error) => {
                console.error(
                    "[EnhancedWidgetDropdown] Failed to save provider:",
                    error
                );
                setInlineCreateError(
                    `Failed to create provider: ${
                        error?.message || "Unknown error"
                    }`
                );
                setIsCreatingProvider(false);
            }
        );
    };

    const handleInlineProviderCancel = () => {
        setInlineCreateType(null);
        setInlineCreateSchema({});
        setInlineCreateError(null);
    };

    const handleConfigChange = (key, value) => {
        setUserConfigValues({ ...userConfigValues, [key]: value });
    };

    // Install a package from the registry
    const handleInstallPackage = async () => {
        if (!selectedWidget || !selectedWidget.isRegistry) return;

        setIsInstalling(true);
        setInstallError(null);

        try {
            const { packageName, downloadUrl, packageVersion } = selectedWidget;

            // Resolve version placeholder in download URL
            const resolvedUrl = downloadUrl
                .replace(/\{version\}/g, packageVersion)
                .replace(/\{name\}/g, packageName);

            console.log(
                `[EnhancedWidgetDropdown] Installing package: ${packageName} from ${resolvedUrl}`
            );

            await window.mainApi.widgets.install(packageName, resolvedUrl);

            console.log(
                `[EnhancedWidgetDropdown] Package ${packageName} installed successfully`
            );

            // Switch to Installed tab after successful install
            setSelectedSource("Installed");
            setSelectedWidget(null);
            setSelectedPackage(null);
        } catch (error) {
            console.error("[EnhancedWidgetDropdown] Install error:", error);
            setInstallError(error.message || "Failed to install package");
        } finally {
            setIsInstalling(false);
        }
    };

    // CRITICAL: Button State Validation
    const isAddButtonEnabled = () => {
        if (!selectedWidget) return false;

        // For registry widgets, always enabled (install action)
        if (selectedWidget.isRegistry) return true;

        // Check providers: all required providers must be selected
        const hasRequiredProviders = selectedWidget.providers
            ? selectedWidget.providers
                  .filter((p) => p.required === true)
                  .every(
                      (p) =>
                          selectedProviders[p.type] &&
                          selectedProviders[p.type] !== ""
                  )
            : true; // If no providers, this check passes

        // Check userConfig: all required fields must be filled
        const hasRequiredConfig = selectedWidget.userConfig
            ? Object.entries(selectedWidget.userConfig)
                  .filter(([key, config]) => config.required === true)
                  .every(
                      ([key, config]) =>
                          userConfigValues[key] && userConfigValues[key] !== ""
                  )
            : true; // If no userConfig, this check passes

        return hasRequiredProviders && hasRequiredConfig;
    };

    const handleAddWidget = () => {
        if (selectedWidget && isAddButtonEnabled()) {
            if (selectedWidget.isRegistry) {
                handleInstallPackage();
                return;
            }

            // Phase 3: Save to recent widgets
            saveToRecent(selectedWidget, selectedProviders, userConfigValues);

            onSelectWidget({
                ...selectedWidget,
                selectedProviders, // Pass to parent
                userConfigValues, // Pass to parent
            });
            onClose();
        }
    };

    if (!isOpen) return null;

    // Render the widget list for Discover mode
    const renderDiscoverList = () => {
        if (isLoadingRegistry) {
            return (
                <div className="flex items-center justify-center h-full p-8">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
                        <Paragraph className="text-gray-400">
                            Loading registry...
                        </Paragraph>
                    </div>
                </div>
            );
        }

        if (registryError) {
            return (
                <div className="p-6 text-center">
                    <Paragraph className="text-red-400 mb-3">
                        {registryError}
                    </Paragraph>
                    <Button
                        title="Retry"
                        bgColor="bg-gray-700"
                        hoverBackgroundColor="hover:bg-gray-600"
                        textSize="text-sm"
                        padding="py-1 px-3"
                        onClick={loadRegistryWidgets}
                    />
                </div>
            );
        }

        if (registryPackages.length === 0) {
            return (
                <div className="p-8 text-center">
                    <Heading3>No packages found</Heading3>
                    <Paragraph className="mt-2 text-gray-500">
                        {searchQuery
                            ? "Try a different search term."
                            : "The registry is empty."}
                    </Paragraph>
                </div>
            );
        }

        if (registryViewMode === "packages") {
            // Package view: show packages as expandable groups
            const groups = getGroupedByPackage();
            return (
                <Menu3 scrollable={true} padding={true} height="h-full">
                    {groups.map((group) => (
                        <div key={group.name} className="mb-1">
                            <MenuItem3
                                onClick={() => {
                                    handlePackageSelect(group);
                                    togglePackageExpand(group.name);
                                }}
                                selected={selectedPackage === group.name}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                                        <span className="text-xs text-gray-500">
                                            {expandedPackages.has(group.name)
                                                ? "\u25BC"
                                                : "\u25B6"}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-base font-medium truncate">
                                                {group.displayName}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {group.widgets.length} widget
                                                {group.widgets.length !== 1
                                                    ? "s"
                                                    : ""}{" "}
                                                &middot; v{group.version}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </MenuItem3>
                            {expandedPackages.has(group.name) &&
                                group.widgets.map((widget) => (
                                    <MenuItem3
                                        key={widget.key}
                                        onClick={() =>
                                            handleWidgetSelect(widget)
                                        }
                                        selected={
                                            selectedWidget?.key === widget.key
                                        }
                                    >
                                        <div className="pl-6 text-sm">
                                            {widget.name}
                                        </div>
                                    </MenuItem3>
                                ))}
                        </div>
                    ))}
                </Menu3>
            );
        }

        // Flat widget view
        return (
            <Menu3 scrollable={true} padding={true} height="h-full">
                {filteredWidgets.map((widget) => (
                    <MenuItem3
                        key={widget.key}
                        onClick={() => handleWidgetSelect(widget)}
                        selected={selectedWidget?.key === widget.key}
                    >
                        <div className="flex items-center justify-between w-full">
                            <div className="text-base font-medium">
                                {widget.name}
                            </div>
                            <span className="text-xs text-gray-500">
                                {widget.packageDisplayName}
                            </span>
                        </div>
                    </MenuItem3>
                ))}
            </Menu3>
        );
    };

    // Render the detail panel for a registry widget
    const renderRegistryDetail = () => {
        if (!selectedWidget || !selectedWidget.isRegistry) return null;

        return (
            <div className="flex-1 overflow-y-auto min-h-0 p-4 w-full">
                {/* Package Header */}
                <div className="mb-3">
                    <div className="flex items-center space-x-2 mb-1">
                        <WidgetIcon
                            icon={selectedWidget.icon}
                            className="h-6 w-6 text-white/70"
                        />
                        <h3 className="text-xl font-bold text-white">
                            {selectedWidget.packageDisplayName}
                        </h3>
                    </div>
                    <div className="flex items-center space-x-3 pl-10">
                        <span className="text-sm text-gray-400">
                            by {selectedWidget.packageAuthor || "Unknown"}
                        </span>
                        <span
                            className={`text-xs px-2 py-0.5 rounded ${currentTheme["bg-primary-medium"]} text-gray-300`}
                        >
                            v{selectedWidget.packageVersion}
                        </span>
                    </div>
                </div>

                <hr
                    className={`my-3 ${currentTheme["border-primary-medium"]}`}
                />

                {/* Description */}
                {selectedWidget.packageDescription && (
                    <div className="mb-3">
                        <Paragraph className="text-sm">
                            {selectedWidget.packageDescription}
                        </Paragraph>
                    </div>
                )}

                {/* Tags */}
                {selectedWidget.packageTags &&
                    selectedWidget.packageTags.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1">
                            {selectedWidget.packageTags.map((tag) => (
                                <span
                                    key={tag}
                                    className={`text-xs px-2 py-0.5 rounded ${currentTheme["bg-primary-medium"]} text-gray-400`}
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                {/* Included Widgets */}
                <div className="mb-3">
                    <Paragraph className="text-xs font-semibold text-gray-400 mb-2">
                        INCLUDED WIDGETS
                    </Paragraph>
                    <div className="space-y-2">
                        {(selectedWidget.packageWidgets || []).map((w, idx) => (
                            <div
                                key={idx}
                                className={`p-2 rounded ${currentTheme["bg-primary-medium"]}`}
                            >
                                <div className="text-sm font-medium text-white">
                                    {w.displayName || w.name}
                                </div>
                                {w.description && (
                                    <div className="text-xs text-gray-400 mt-0.5">
                                        {w.description}
                                    </div>
                                )}
                                {w.providers && w.providers.length > 0 && (
                                    <div className="flex gap-1 mt-1">
                                        {w.providers.map((p, pidx) => (
                                            <span
                                                key={pidx}
                                                className="text-xs px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400"
                                            >
                                                {p.type}
                                                {p.required ? " *" : ""}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Repository Link */}
                {selectedWidget.repository && (
                    <div className="mb-3">
                        <Paragraph className="text-xs font-semibold text-gray-400 mb-1">
                            REPOSITORY
                        </Paragraph>
                        <Paragraph className="text-sm text-blue-400 break-all">
                            {selectedWidget.repository}
                        </Paragraph>
                    </div>
                )}

                {/* Install Error */}
                {installError && (
                    <div className="mt-3 p-2 rounded bg-red-900/30 border border-red-700">
                        <p className="text-xs text-red-400">{installError}</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            setIsOpen={onClose}
            width={"w-11/12 xl:w-5/6"}
            height="h-5/6"
        >
            <Panel direction="col" padding={false}>
                <div className={`flex flex-col w-full h-full overflow-clip`}>
                    <div className="flex flex-col w-full h-full overflow-clip">
                        {/* Main Content Area */}
                        <div className="flex flex-row w-full h-full space-x-4 overflow-clip p-6">
                            {/* Left Side: Title and Description (1/3) - Hidden on small screens */}
                            <div className="hidden lg:flex flex-col flex-shrink h-full rounded font-medium text-gray-400 w-1/3">
                                <div className="flex flex-col rounded p-6 py-10 space-y-4">
                                    <Heading
                                        title={"Add Widget to Dashboard"}
                                        padding={false}
                                    />
                                    <SubHeading3
                                        title={
                                            selectedSource === "Discover"
                                                ? "Browse the widget registry to discover and install community-contributed widget packages."
                                                : "Browse and select widgets to add to your dashboard. Widgets provide specialized functionality like analytics, notifications, and integrations."
                                        }
                                        padding={false}
                                    />
                                </div>
                            </div>

                            {/* Right Side: Two-Column Widget Selector - Full width on small screens, 2/3 on large */}
                            <div className="flex flex-col w-full lg:w-2/3 h-full overflow-hidden">
                                {/* Filters - Horizontal Layout */}
                                <div className="flex flex-row items-center space-x-3 mb-4 px-2">
                                    {/* Search Filter - Fills available space */}
                                    <input
                                        type="text"
                                        placeholder={
                                            selectedSource === "Discover"
                                                ? "Search packages and widgets..."
                                                : "Search widgets..."
                                        }
                                        value={searchQuery}
                                        onChange={(e) =>
                                            setSearchQuery(e.target.value)
                                        }
                                        className={`flex-1 px-3 py-2 rounded text-sm ${currentTheme["bg-primary-medium"]} ${currentTheme["text-primary-light"]} ${currentTheme["border-primary-medium"]} border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                    />

                                    {/* Author Filter */}
                                    <select
                                        value={selectedAuthor}
                                        onChange={(e) =>
                                            setSelectedAuthor(e.target.value)
                                        }
                                        className={`px-3 py-2 rounded text-sm ${currentTheme["bg-primary-medium"]} ${currentTheme["text-primary-light"]} ${currentTheme["border-primary-medium"]} border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                    >
                                        <option value="all">All Authors</option>
                                        {getUniqueAuthors().map((author) => (
                                            <option key={author} value={author}>
                                                {author}
                                            </option>
                                        ))}
                                    </select>

                                    {/* Provider Filter - Only show for Installed */}
                                    {selectedSource === "Installed" && (
                                        <select
                                            value={selectedProvider}
                                            onChange={(e) =>
                                                setSelectedProvider(
                                                    e.target.value
                                                )
                                            }
                                            className={`px-3 py-2 rounded text-sm ${currentTheme["bg-primary-medium"]} ${currentTheme["text-primary-light"]} ${currentTheme["border-primary-medium"]} border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                        >
                                            <option value="all">
                                                All Providers
                                            </option>
                                            {getUniqueProviders().map(
                                                (provider) => (
                                                    <option
                                                        key={provider}
                                                        value={provider}
                                                    >
                                                        {provider === "none"
                                                            ? "No Providers"
                                                            : provider}
                                                    </option>
                                                )
                                            )}
                                        </select>
                                    )}

                                    {/* View Mode Toggle - Only for Discover */}
                                    {selectedSource === "Discover" && (
                                        <select
                                            value={registryViewMode}
                                            onChange={(e) =>
                                                setRegistryViewMode(
                                                    e.target.value
                                                )
                                            }
                                            className={`px-3 py-2 rounded text-sm ${currentTheme["bg-primary-medium"]} ${currentTheme["text-primary-light"]} ${currentTheme["border-primary-medium"]} border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                        >
                                            <option value="packages">
                                                Packages
                                            </option>
                                            <option value="widgets">
                                                Widgets
                                            </option>
                                        </select>
                                    )}

                                    {/* Source Filter */}
                                    <select
                                        value={selectedSource}
                                        onChange={(e) =>
                                            setSelectedSource(e.target.value)
                                        }
                                        className={`px-3 py-2 rounded text-sm ${currentTheme["bg-primary-medium"]} ${currentTheme["text-primary-light"]} ${currentTheme["border-primary-medium"]} border focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                    >
                                        <option value="Installed">
                                            Installed
                                        </option>
                                        <option value="Discover">
                                            Discover
                                        </option>
                                    </select>
                                </div>

                                <div className="flex flex-row h-full overflow-hidden">
                                    {/* Column 1: Widget List (50%) */}
                                    <div
                                        className={`w-1/2 border-r ${currentTheme["border-primary-medium"]} flex flex-col overflow-hidden p-2`}
                                    >
                                        {/* Widget List - Scrollable */}
                                        <div className="flex-1 overflow-y-auto w-full h-full">
                                            {selectedSource === "Discover" ? (
                                                renderDiscoverList()
                                            ) : filteredWidgets.length === 0 ? (
                                                // No Widgets Found
                                                <div className="p-8 text-center h-full w-full">
                                                    <Paragraph className="text-gray-500">
                                                        {widgets.length === 0
                                                            ? "No widgets found"
                                                            : "No widgets match the current filters"}
                                                    </Paragraph>
                                                </div>
                                            ) : (
                                                // Widget List using Menu3/MenuItem3
                                                <Menu3
                                                    scrollable={true}
                                                    padding={true}
                                                    height="h-full"
                                                >
                                                    {/* Phase 3: Recent Widgets Section */}
                                                    {recentWidgets.length > 0 &&
                                                        selectedSource ===
                                                            "Installed" && (
                                                            <div className="mb-3">
                                                                <div
                                                                    className={`px-2 py-1 mb-2 border-b ${currentTheme["border-primary-medium"]}`}
                                                                >
                                                                    <Paragraph className="text-xs font-semibold text-gray-400">
                                                                        RECENT
                                                                        WIDGETS
                                                                    </Paragraph>
                                                                </div>
                                                                {recentWidgets.map(
                                                                    (
                                                                        widget
                                                                    ) => (
                                                                        <MenuItem3
                                                                            key={`recent-${widget.key}`}
                                                                            onClick={() =>
                                                                                handleRecentClick(
                                                                                    widget
                                                                                )
                                                                            }
                                                                            selected={
                                                                                selectedWidget?.key ===
                                                                                widget.key
                                                                            }
                                                                        >
                                                                            <div className="flex items-center space-x-2 w-full">
                                                                                <span className="text-xs">
                                                                                    🕒
                                                                                </span>
                                                                                <div className="text-base font-medium flex-1">
                                                                                    {
                                                                                        widget.name
                                                                                    }
                                                                                </div>
                                                                            </div>
                                                                        </MenuItem3>
                                                                    )
                                                                )}
                                                            </div>
                                                        )}

                                                    {/* Regular Widget List */}
                                                    {filteredWidgets.map(
                                                        (widget) => (
                                                            <MenuItem3
                                                                key={widget.key}
                                                                onClick={() =>
                                                                    handleWidgetSelect(
                                                                        widget
                                                                    )
                                                                }
                                                                selected={
                                                                    selectedWidget?.key ===
                                                                    widget.key
                                                                }
                                                            >
                                                                <div className="text-base font-medium">
                                                                    {
                                                                        widget.name
                                                                    }
                                                                </div>
                                                            </MenuItem3>
                                                        )
                                                    )}
                                                </Menu3>
                                            )}
                                        </div>

                                        {/* Widget Count Indicator */}
                                        <div
                                            className={`px-4 py-2 border-t ${currentTheme["border-primary-medium"]} ${currentTheme["bg-primary-medium"]}`}
                                        >
                                            <Paragraph className="text-sm text-gray-400">
                                                {selectedSource === "Discover"
                                                    ? `${
                                                          registryPackages.length
                                                      } package${
                                                          registryPackages.length !==
                                                          1
                                                              ? "s"
                                                              : ""
                                                      } \u00B7 ${
                                                          filteredWidgets.length
                                                      } widget${
                                                          filteredWidgets.length !==
                                                          1
                                                              ? "s"
                                                              : ""
                                                      }`
                                                    : `${
                                                          filteredWidgets.length
                                                      } of ${
                                                          widgets.length
                                                      } widget${
                                                          widgets.length !== 1
                                                              ? "s"
                                                              : ""
                                                      }`}
                                            </Paragraph>
                                        </div>
                                    </div>

                                    {/* Column 2: Widget Details / Configure & Add (50%) */}
                                    <div className="h-full w-1/2 flex flex-col overflow-hidden min-h-0 p-2">
                                        <Panel3
                                            padding={true}
                                            className="w-full flex flex-col overflow-auto min-h-0"
                                        >
                                            {selectedWidget ? (
                                                selectedWidget.isRegistry ? (
                                                    // Registry Widget Details
                                                    renderRegistryDetail()
                                                ) : (
                                                    // Installed Widget Details
                                                    <div className="flex-1 overflow-y-auto min-h-0 p-4 w-full">
                                                        {/* Widget Header */}
                                                        <div className="mb-3">
                                                            <div className="flex items-center space-x-2 mb-1">
                                                                <WidgetIcon
                                                                    icon={
                                                                        selectedWidget.icon
                                                                    }
                                                                    className="h-6 w-6 text-white/70"
                                                                />
                                                                <h3 className="text-xl font-bold text-white">
                                                                    {
                                                                        selectedWidget.name
                                                                    }
                                                                </h3>
                                                            </div>
                                                            <div className="text-sm text-gray-400 pl-10">
                                                                by{" "}
                                                                {selectedWidget.author ||
                                                                    selectedWidget.workspace ||
                                                                    "Unknown"}
                                                            </div>
                                                        </div>

                                                        <hr
                                                            className={`my-3 ${currentTheme["border-primary-medium"]}`}
                                                        />

                                                        {/* Description */}
                                                        {selectedWidget.description && (
                                                            <div className="mb-3">
                                                                <Paragraph className="text-sm">
                                                                    {
                                                                        selectedWidget.description
                                                                    }
                                                                </Paragraph>
                                                            </div>
                                                        )}

                                                        {/* Required Providers - PHASE 2: Interactive Selection */}
                                                        {selectedWidget.providers &&
                                                            selectedWidget
                                                                .providers
                                                                .length > 0 && (
                                                                <div className="mb-3">
                                                                    <Paragraph className="text-xs font-semibold text-gray-400 mb-2">
                                                                        REQUIRED
                                                                        PROVIDERS
                                                                    </Paragraph>
                                                                    <div className="space-y-2">
                                                                        {selectedWidget.providers.map(
                                                                            (
                                                                                providerReq,
                                                                                idx
                                                                            ) => {
                                                                                // Get available providers of this type
                                                                                const providersOfType =
                                                                                    Object.values(
                                                                                        availableProviders
                                                                                    ).filter(
                                                                                        (
                                                                                            p
                                                                                        ) =>
                                                                                            p.type ===
                                                                                            providerReq.type
                                                                                    );

                                                                                return (
                                                                                    <div
                                                                                        key={
                                                                                            idx
                                                                                        }
                                                                                        className="space-y-1"
                                                                                    >
                                                                                        <label className="text-sm font-medium">
                                                                                            {
                                                                                                providerReq.type
                                                                                            }
                                                                                            {providerReq.required && (
                                                                                                <span className="text-red-400 ml-1">
                                                                                                    *
                                                                                                </span>
                                                                                            )}
                                                                                        </label>
                                                                                        <select
                                                                                            value={
                                                                                                selectedProviders[
                                                                                                    providerReq
                                                                                                        .type
                                                                                                ] ||
                                                                                                ""
                                                                                            }
                                                                                            onChange={(
                                                                                                e
                                                                                            ) =>
                                                                                                handleProviderSelect(
                                                                                                    providerReq.type,
                                                                                                    e
                                                                                                        .target
                                                                                                        .value
                                                                                                )
                                                                                            }
                                                                                            className={`w-full px-3 py-2 rounded text-sm ${currentTheme["bg-primary-medium"]} ${currentTheme["text-primary-light"]} ${currentTheme["border-primary-medium"]} border`}
                                                                                        >
                                                                                            <option value="">
                                                                                                --
                                                                                                Select
                                                                                                Provider
                                                                                                --
                                                                                            </option>
                                                                                            {providersOfType.map(
                                                                                                (
                                                                                                    p
                                                                                                ) => (
                                                                                                    <option
                                                                                                        key={
                                                                                                            p.name
                                                                                                        }
                                                                                                        value={
                                                                                                            p.name
                                                                                                        }
                                                                                                    >
                                                                                                        {
                                                                                                            p.name
                                                                                                        }
                                                                                                    </option>
                                                                                                )
                                                                                            )}
                                                                                            <option value="__create_new__">
                                                                                                +
                                                                                                Create
                                                                                                New{" "}
                                                                                                {
                                                                                                    providerReq.type
                                                                                                }
                                                                                            </option>
                                                                                        </select>
                                                                                        {providerReq.required &&
                                                                                            !selectedProviders[
                                                                                                providerReq
                                                                                                    .type
                                                                                            ] &&
                                                                                            inlineCreateType !==
                                                                                                providerReq.type && (
                                                                                                <p className="text-xs text-red-400">
                                                                                                    Required
                                                                                                </p>
                                                                                            )}

                                                                                        {/* Inline Provider Creation Form */}
                                                                                        {inlineCreateType ===
                                                                                            providerReq.type && (
                                                                                            <div
                                                                                                className={`mt-3 p-3 rounded border ${currentTheme["border-primary-medium"]} ${currentTheme["bg-primary-dark"]}`}
                                                                                            >
                                                                                                <p className="text-xs font-semibold text-gray-400 mb-2">
                                                                                                    CREATE
                                                                                                    NEW{" "}
                                                                                                    {providerReq.type.toUpperCase()}{" "}
                                                                                                    PROVIDER
                                                                                                </p>

                                                                                                {inlineCreateError && (
                                                                                                    <div className="mb-3 p-2 rounded bg-red-900/30 border border-red-700">
                                                                                                        <p className="text-xs text-red-400">
                                                                                                            {
                                                                                                                inlineCreateError
                                                                                                            }
                                                                                                        </p>
                                                                                                    </div>
                                                                                                )}

                                                                                                <ProviderForm
                                                                                                    credentialSchema={
                                                                                                        inlineCreateSchema
                                                                                                    }
                                                                                                    onSubmit={
                                                                                                        handleInlineProviderSubmit
                                                                                                    }
                                                                                                    onCancel={
                                                                                                        handleInlineProviderCancel
                                                                                                    }
                                                                                                    submitLabel={
                                                                                                        isCreatingProvider
                                                                                                            ? "Creating..."
                                                                                                            : "Create Provider"
                                                                                                    }
                                                                                                    providerType={
                                                                                                        providerReq.type
                                                                                                    }
                                                                                                />
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            }
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}

                                                        {/* Configuration Options - PHASE 2: Interactive Inputs */}
                                                        {selectedWidget.userConfig &&
                                                            Object.keys(
                                                                selectedWidget.userConfig
                                                            ).length > 0 && (
                                                                <div className="mb-3">
                                                                    <Paragraph className="text-xs font-semibold text-gray-400 mb-2">
                                                                        CONFIGURATION
                                                                    </Paragraph>
                                                                    <div className="space-y-2">
                                                                        {Object.entries(
                                                                            selectedWidget.userConfig
                                                                        ).map(
                                                                            ([
                                                                                key,
                                                                                config,
                                                                            ]) => (
                                                                                <div
                                                                                    key={
                                                                                        key
                                                                                    }
                                                                                    className="space-y-1"
                                                                                >
                                                                                    <label className="text-sm font-medium">
                                                                                        {config.displayName ||
                                                                                            key}
                                                                                        {config.required && (
                                                                                            <span className="text-red-400 ml-1">
                                                                                                *
                                                                                            </span>
                                                                                        )}
                                                                                    </label>

                                                                                    {config.type ===
                                                                                        "text" && (
                                                                                        <input
                                                                                            type="text"
                                                                                            placeholder={
                                                                                                config.defaultValue ||
                                                                                                ""
                                                                                            }
                                                                                            value={
                                                                                                userConfigValues[
                                                                                                    key
                                                                                                ] ||
                                                                                                ""
                                                                                            }
                                                                                            onChange={(
                                                                                                e
                                                                                            ) =>
                                                                                                handleConfigChange(
                                                                                                    key,
                                                                                                    e
                                                                                                        .target
                                                                                                        .value
                                                                                                )
                                                                                            }
                                                                                            className={`w-full px-3 py-2 rounded text-sm ${currentTheme["bg-primary-medium"]} ${currentTheme["text-primary-light"]} ${currentTheme["border-primary-medium"]} border`}
                                                                                        />
                                                                                    )}

                                                                                    {config.type ===
                                                                                        "select" && (
                                                                                        <select
                                                                                            value={
                                                                                                userConfigValues[
                                                                                                    key
                                                                                                ] ||
                                                                                                config.defaultValue ||
                                                                                                ""
                                                                                            }
                                                                                            onChange={(
                                                                                                e
                                                                                            ) =>
                                                                                                handleConfigChange(
                                                                                                    key,
                                                                                                    e
                                                                                                        .target
                                                                                                        .value
                                                                                                )
                                                                                            }
                                                                                            className={`w-full px-3 py-2 rounded text-sm ${currentTheme["bg-primary-medium"]} ${currentTheme["text-primary-light"]} ${currentTheme["border-primary-medium"]} border`}
                                                                                        >
                                                                                            {config.options &&
                                                                                                config.options.map(
                                                                                                    (
                                                                                                        opt
                                                                                                    ) => (
                                                                                                        <option
                                                                                                            key={
                                                                                                                opt
                                                                                                            }
                                                                                                            value={
                                                                                                                opt
                                                                                                            }
                                                                                                        >
                                                                                                            {
                                                                                                                opt
                                                                                                            }
                                                                                                        </option>
                                                                                                    )
                                                                                                )}
                                                                                        </select>
                                                                                    )}

                                                                                    {config.instructions && (
                                                                                        <p className="text-xs text-gray-400">
                                                                                            {
                                                                                                config.instructions
                                                                                            }
                                                                                        </p>
                                                                                    )}

                                                                                    {config.required &&
                                                                                        !userConfigValues[
                                                                                            key
                                                                                        ] && (
                                                                                            <p className="text-xs text-red-400">
                                                                                                Required
                                                                                            </p>
                                                                                        )}
                                                                                </div>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                    </div>
                                                )
                                            ) : (
                                                // Empty State
                                                <div className="flex-1 flex items-center justify-center">
                                                    <Panel3 padding={true}>
                                                        <Paragraph className="text-gray-500 text-center">
                                                            {selectedSource ===
                                                            "Discover"
                                                                ? "Select a package to view details"
                                                                : "Select a widget to view details"}
                                                        </Paragraph>
                                                    </Panel3>
                                                </div>
                                            )}
                                        </Panel3>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex flex-row justify-between bg-gray-900 p-4 rounded-br rounded-bl border-t border-gray-800">
                            <div className="flex flex-row text-lg text-gray-600 items-center font-bold px-4">
                                {selectedSource === "Discover"
                                    ? "Browse and install widget packages from the registry."
                                    : "Select a widget from the list to view details and add it to your dashboard."}
                            </div>
                            <div className="flex flex-row space-x-2">
                                <Button
                                    title={"Cancel"}
                                    bgColor={"bg-gray-800"}
                                    textSize={"text-lg"}
                                    padding={"py-2 px-4"}
                                    onClick={onClose}
                                />
                                <Button
                                    title={
                                        selectedWidget?.isRegistry
                                            ? isInstalling
                                                ? "Installing..."
                                                : "Install Package"
                                            : "Add to Dashboard"
                                    }
                                    bgColor={"bg-gray-800"}
                                    hoverBackgroundColor={
                                        isAddButtonEnabled() && !isInstalling
                                            ? selectedWidget?.isRegistry
                                                ? "hover:bg-blue-700"
                                                : "hover:bg-green-700"
                                            : ""
                                    }
                                    textSize={"text-lg"}
                                    padding={"py-2 px-4"}
                                    onClick={handleAddWidget}
                                    disabled={
                                        !isAddButtonEnabled() || isInstalling
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </Panel>
        </Modal>
    );
};
