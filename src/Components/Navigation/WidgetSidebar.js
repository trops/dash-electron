import React, {
    useState,
    useMemo,
    useContext,
    useEffect,
    useCallback,
} from "react";
import { useDrag } from "react-dnd";
import {
    FontAwesomeIcon,
    SearchInput,
    Sidebar,
    ThemeContext,
} from "@trops/dash-react";
import { ComponentManager } from "../../ComponentManager";
import { SIDEBAR_WIDGET_TYPE } from "../../utils/dragTypes";
import { useRegistrySearch } from "../../hooks/useRegistrySearch";

const DraggableWidgetItem = ({ widgetKey, widget }) => {
    const [{ isDragging }, drag] = useDrag(
        () => ({
            type: SIDEBAR_WIDGET_TYPE,
            item: { widgetKey, widget },
            collect: (monitor) => ({ isDragging: monitor.isDragging() }),
        }),
        [widgetKey]
    );

    const providerTypes = (widget.providers || []).map((p) => p.type);
    const eventCount = (widget.events || []).length;
    const handlerCount = (widget.eventHandlers || []).length;
    const hasEventInfo = eventCount > 0 || handlerCount > 0;

    return (
        <div
            ref={drag}
            className={`flex flex-col gap-1 px-3 py-2 rounded-md text-sm cursor-grab
                bg-white/5 hover:bg-white/10 transition-colors select-none
                ${isDragging ? "opacity-30" : ""}`}
        >
            <div className="flex items-center gap-2">
                {widget.icon ? (
                    <FontAwesomeIcon
                        icon={widget.icon}
                        className="h-3 w-3 opacity-60 flex-shrink-0"
                    />
                ) : (
                    <FontAwesomeIcon
                        icon="puzzle-piece"
                        className="h-3 w-3 opacity-40 flex-shrink-0"
                    />
                )}
                <span className="truncate font-medium opacity-90">
                    {widget.name || widgetKey}
                </span>
            </div>
            {(providerTypes.length > 0 || hasEventInfo) && (
                <div className="flex flex-wrap items-center gap-1 pl-5">
                    {providerTypes.map((pType) => (
                        <span
                            key={pType}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300"
                        >
                            {pType}
                        </span>
                    ))}
                    {hasEventInfo && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                            {eventCount > 0 &&
                                `${eventCount} event${
                                    eventCount > 1 ? "s" : ""
                                }`}
                            {eventCount > 0 && handlerCount > 0 && ", "}
                            {handlerCount > 0 &&
                                `${handlerCount} handler${
                                    handlerCount > 1 ? "s" : ""
                                }`}
                        </span>
                    )}
                </div>
            )}
            {widget.package && (
                <span className="text-[10px] pl-5 opacity-40 truncate">
                    {widget.package}
                </span>
            )}
        </div>
    );
};

/* ─── Discover Tab Content ─────────────────────────────────────────── */

const SidebarDiscoverContent = ({ registry, onInstallSuccess }) => {
    const [selectedPackageName, setSelectedPackageName] = useState(null);

    const selectedPackage = useMemo(() => {
        if (!selectedPackageName) return null;
        return registry.packages.find(
            (pkg) => pkg.name === selectedPackageName
        );
    }, [selectedPackageName, registry.packages]);

    const handleInstall = useCallback(
        async (pkg) => {
            // Build a widget-like object that useRegistrySearch.installPackage expects
            const firstWidget = pkg.widgets?.[0];
            if (!firstWidget) return;

            const installable = {
                isRegistry: true,
                packageName: pkg.name,
                downloadUrl: pkg.downloadUrl || "",
                packageVersion: pkg.version || "",
            };

            await registry.installPackage(installable);

            // If no install error, signal success
            if (!registry.installError) {
                onInstallSuccess(pkg.displayName || pkg.name);
                setSelectedPackageName(null);
            }
        },
        [registry, onInstallSuccess]
    );

    // Detail view for a selected package
    if (selectedPackage) {
        const pkg = selectedPackage;
        return (
            <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto px-3 py-2">
                    {/* Back button */}
                    <button
                        type="button"
                        onClick={() => setSelectedPackageName(null)}
                        className="flex items-center gap-1.5 text-[11px] opacity-60 hover:opacity-100 transition-opacity mb-3"
                    >
                        <FontAwesomeIcon
                            icon="arrow-left"
                            className="h-2.5 w-2.5"
                        />
                        Back
                    </button>

                    {/* Package header */}
                    <div className="flex items-start gap-2 mb-3">
                        <FontAwesomeIcon
                            icon="cube"
                            className="h-4 w-4 opacity-60 mt-0.5 flex-shrink-0"
                        />
                        <div className="min-w-0">
                            <div className="font-medium text-sm truncate">
                                {pkg.displayName || pkg.name}
                            </div>
                            <div className="text-[10px] opacity-50">
                                {pkg.author && (
                                    <span>{pkg.author} &middot; </span>
                                )}
                                v{pkg.version || "0.0.0"}
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    {pkg.description && (
                        <p className="text-xs opacity-70 mb-3 line-clamp-3">
                            {pkg.description}
                        </p>
                    )}

                    {/* Tags */}
                    {pkg.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                            {pkg.tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 opacity-60"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Included widgets */}
                    {pkg.widgets?.length > 0 && (
                        <div className="mb-3">
                            <div className="text-[10px] font-medium opacity-50 uppercase tracking-wider mb-1.5">
                                Included Widgets
                            </div>
                            <div className="flex flex-col gap-1">
                                {pkg.widgets.map((w) => (
                                    <div
                                        key={w.name}
                                        className="flex flex-col gap-0.5 px-2 py-1.5 rounded bg-white/5 text-xs"
                                    >
                                        <span className="font-medium opacity-90">
                                            {w.displayName || w.name}
                                        </span>
                                        {w.providers?.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {w.providers.map((p) => (
                                                    <span
                                                        key={p.type}
                                                        className="text-[10px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-300"
                                                    >
                                                        {p.type}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Install error */}
                    {registry.installError && (
                        <div className="text-xs text-red-400 bg-red-500/10 rounded px-2 py-1.5 mb-3">
                            {registry.installError}
                        </div>
                    )}
                </div>

                {/* Install button pinned to bottom */}
                <div className="px-3 py-2 flex-shrink-0">
                    <button
                        type="button"
                        onClick={() => handleInstall(pkg)}
                        disabled={registry.isInstalling}
                        className="w-full py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {registry.isInstalling
                            ? "Installing..."
                            : "Install Package"}
                    </button>
                </div>
            </div>
        );
    }

    // Loading state
    if (registry.isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-8 opacity-50">
                <FontAwesomeIcon icon="spinner" spin className="h-4 w-4 mb-2" />
                <span className="text-xs">Loading registry...</span>
            </div>
        );
    }

    // Error state
    if (registry.error) {
        return (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <span className="text-xs text-red-400 mb-2">
                    {registry.error}
                </span>
                <button
                    type="button"
                    onClick={registry.retry}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    // Empty state
    if (registry.packages.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center opacity-50">
                <FontAwesomeIcon
                    icon="compass"
                    className="h-5 w-5 mb-2 opacity-40"
                />
                <span className="text-sm">No packages found</span>
                {registry.searchQuery && (
                    <span className="text-xs mt-1">
                        Try a different search term
                    </span>
                )}
            </div>
        );
    }

    // Package list
    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col gap-1 px-3 py-1">
                    {registry.packages.map((pkg) => (
                        <button
                            key={pkg.name}
                            type="button"
                            onClick={() => setSelectedPackageName(pkg.name)}
                            className="flex items-center gap-2 px-3 py-2 rounded-md text-left
                                bg-white/5 hover:bg-white/10 transition-colors w-full"
                        >
                            <FontAwesomeIcon
                                icon="cube"
                                className="h-3 w-3 opacity-40 flex-shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium opacity-90 truncate">
                                    {pkg.displayName || pkg.name}
                                </div>
                                <div className="flex items-center gap-1 text-[10px] opacity-50">
                                    {pkg.author && (
                                        <span className="truncate">
                                            {pkg.author}
                                        </span>
                                    )}
                                    {pkg.author && pkg.widgets?.length > 0 && (
                                        <span>&middot;</span>
                                    )}
                                    {pkg.widgets?.length > 0 && (
                                        <span>
                                            {pkg.widgets.length} widget
                                            {pkg.widgets.length !== 1
                                                ? "s"
                                                : ""}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
            {/* Package count footer */}
            <div className="px-3 py-1.5 flex-shrink-0">
                <span className="text-[10px] opacity-40">
                    {registry.packages.length} package
                    {registry.packages.length !== 1 ? "s" : ""}
                </span>
            </div>
        </div>
    );
};

/* ─── Main Sidebar ─────────────────────────────────────────────────── */

export const WidgetSidebar = ({ collapsed, onCollapsedChange }) => {
    const { currentTheme } = useContext(ThemeContext);

    // Tab state
    const [activeTab, setActiveTab] = useState("installed"); // "installed" | "discover"
    const [installSuccess, setInstallSuccess] = useState(null);

    // Registry hook (only active when discover tab is shown)
    const registry = useRegistrySearch();

    // Filter state
    const [searchQuery, setSearchQuery] = useState("");
    const [filterAuthor, setFilterAuthor] = useState("all");
    const [filterProvider, setFilterProvider] = useState("all");
    const [filterHasEvents, setFilterHasEvents] = useState("all");
    const [filterHasHandlers, setFilterHasHandlers] = useState("all");

    // Counter to trigger re-computation when installed widgets change
    const [widgetVersion, setWidgetVersion] = useState(0);

    useEffect(() => {
        const handleWidgetsUpdated = () => setWidgetVersion((v) => v + 1);
        window.addEventListener("dash:widgets-updated", handleWidgetsUpdated);
        return () =>
            window.removeEventListener(
                "dash:widgets-updated",
                handleWidgetsUpdated
            );
    }, []);

    // Flat list of all widgets
    const allWidgets = useMemo(() => {
        const componentMap = ComponentManager.map();
        return Object.keys(componentMap)
            .sort()
            .filter((key) => componentMap[key].type === "widget")
            .map((key) => ({ key, widget: componentMap[key] }));
    }, [widgetVersion]);

    // Derive unique groups for dropdown (package > author > "Other")
    const uniqueAuthors = useMemo(
        () =>
            [
                ...new Set(
                    allWidgets.map(
                        ({ widget }) =>
                            widget.package || widget.author || "Other"
                    )
                ),
            ].sort(),
        [allWidgets]
    );

    // Derive unique provider types for dropdown
    const uniqueProviders = useMemo(() => {
        const types = new Set();
        allWidgets.forEach(({ widget }) =>
            (widget.providers || []).forEach((p) => types.add(p.type))
        );
        return [...types].sort();
    }, [allWidgets]);

    // Filtered + grouped widgets
    const filteredGrouped = useMemo(() => {
        const filtered = allWidgets.filter(({ key, widget }) => {
            // Search: match name, key, or description
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchesSearch =
                    (widget.name || "").toLowerCase().includes(q) ||
                    key.toLowerCase().includes(q) ||
                    (widget.description || "").toLowerCase().includes(q);
                if (!matchesSearch) return false;
            }
            // Group filter (package > author > "Other")
            if (filterAuthor !== "all") {
                if (
                    (widget.package || widget.author || "Other") !==
                    filterAuthor
                )
                    return false;
            }
            // Provider filter
            if (filterProvider !== "all") {
                if (filterProvider === "none") {
                    if (widget.providers && widget.providers.length > 0)
                        return false;
                } else {
                    if (
                        !widget.providers ||
                        !widget.providers.some((p) => p.type === filterProvider)
                    )
                        return false;
                }
            }
            // Events filter
            if (filterHasEvents !== "all") {
                const has = widget.events?.length > 0;
                if (filterHasEvents === "yes" && !has) return false;
                if (filterHasEvents === "no" && has) return false;
            }
            // Handlers filter
            if (filterHasHandlers !== "all") {
                const has = widget.eventHandlers?.length > 0;
                if (filterHasHandlers === "yes" && !has) return false;
                if (filterHasHandlers === "no" && has) return false;
            }
            return true;
        });

        // Group by package > author > "Other"
        const groups = {};
        filtered.forEach(({ key, widget }) => {
            const group = widget.package || widget.author || "Other";
            if (!groups[group]) groups[group] = [];
            groups[group].push({ key, widget });
        });
        return groups;
    }, [
        allWidgets,
        searchQuery,
        filterAuthor,
        filterProvider,
        filterHasEvents,
        filterHasHandlers,
    ]);

    const filteredCount = Object.values(filteredGrouped).reduce(
        (sum, arr) => sum + arr.length,
        0
    );
    const totalCount = allWidgets.length;
    const hasActiveFilters =
        searchQuery ||
        filterAuthor !== "all" ||
        filterProvider !== "all" ||
        filterHasEvents !== "all" ||
        filterHasHandlers !== "all";

    const clearFilters = () => {
        setSearchQuery("");
        setFilterAuthor("all");
        setFilterProvider("all");
        setFilterHasEvents("all");
        setFilterHasHandlers("all");
    };

    const authorNames = Object.keys(filteredGrouped).sort();

    const selectClassName = `w-full px-2 py-1 rounded text-xs bg-transparent border ${
        currentTheme["border-primary-medium"] || "border-gray-700"
    } ${
        currentTheme["text-primary-light"] || "text-gray-300"
    } focus:outline-none appearance-none cursor-pointer`;

    // Install success handler — switch to installed tab + show flash
    const handleInstallSuccess = useCallback((packageName) => {
        setInstallSuccess(`${packageName} installed`);
        setActiveTab("installed");
        const timer = setTimeout(() => setInstallSuccess(null), 3000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <Sidebar
            collapsed={collapsed}
            onCollapsedChange={onCollapsedChange}
            side="right"
            width="w-64"
            collapsedWidth="w-12"
        >
            <Sidebar.Header>
                <div className="flex items-center justify-between">
                    <Sidebar.Trigger />
                    {!collapsed && (
                        <div className="flex bg-white/5 rounded-md p-0.5">
                            <button
                                type="button"
                                onClick={() => setActiveTab("installed")}
                                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                                    activeTab === "installed"
                                        ? "bg-white/10 font-medium opacity-90"
                                        : "opacity-50 hover:opacity-70"
                                }`}
                            >
                                Installed
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("discover")}
                                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                                    activeTab === "discover"
                                        ? "bg-white/10 font-medium opacity-90"
                                        : "opacity-50 hover:opacity-70"
                                }`}
                            >
                                Discover
                            </button>
                        </div>
                    )}
                </div>
            </Sidebar.Header>

            {/* Search & Filter section — only when expanded */}
            {!collapsed && activeTab === "installed" && (
                <div className="flex flex-col gap-2 px-3 pb-2 flex-shrink-0">
                    <SearchInput
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="Search widgets..."
                        inputClassName="py-1.5 text-xs"
                    />

                    <div className="grid grid-cols-2 gap-1.5">
                        <select
                            value={filterAuthor}
                            onChange={(e) => setFilterAuthor(e.target.value)}
                            className={selectClassName}
                        >
                            <option value="all">All Authors</option>
                            {uniqueAuthors.map((a) => (
                                <option key={a} value={a}>
                                    {a}
                                </option>
                            ))}
                        </select>

                        <select
                            value={filterProvider}
                            onChange={(e) => setFilterProvider(e.target.value)}
                            className={selectClassName}
                        >
                            <option value="all">All Providers</option>
                            <option value="none">No Providers</option>
                            {uniqueProviders.map((p) => (
                                <option key={p} value={p}>
                                    {p}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                        <select
                            value={filterHasEvents}
                            onChange={(e) => setFilterHasEvents(e.target.value)}
                            className={selectClassName}
                        >
                            <option value="all">Events: Any</option>
                            <option value="yes">Has Events</option>
                            <option value="no">No Events</option>
                        </select>

                        <select
                            value={filterHasHandlers}
                            onChange={(e) =>
                                setFilterHasHandlers(e.target.value)
                            }
                            className={selectClassName}
                        >
                            <option value="all">Handlers: Any</option>
                            <option value="yes">Has Handlers</option>
                            <option value="no">No Handlers</option>
                        </select>
                    </div>

                    {/* Result count + clear */}
                    <div className="flex items-center justify-between text-[10px] px-0.5">
                        <span className="opacity-50">
                            {hasActiveFilters
                                ? `${filteredCount} of ${totalCount} widgets`
                                : `${totalCount} widgets`}
                        </span>
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="opacity-60 hover:opacity-100 transition-opacity text-gray-300 hover:bg-white/10 px-1.5 py-0.5 rounded"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Discover search bar */}
            {!collapsed && activeTab === "discover" && (
                <div className="flex flex-col gap-2 px-3 pb-2 flex-shrink-0">
                    <SearchInput
                        value={registry.searchQuery}
                        onChange={registry.setSearchQuery}
                        placeholder="Search registry..."
                        inputClassName="py-1.5 text-xs"
                    />
                </div>
            )}

            <Sidebar.Content>
                {collapsed ? (
                    <>
                        <Sidebar.Item
                            icon={
                                <FontAwesomeIcon
                                    icon="puzzle-piece"
                                    className="h-3.5 w-3.5"
                                />
                            }
                            onClick={() => {
                                setActiveTab("installed");
                                onCollapsedChange && onCollapsedChange(false);
                            }}
                        >
                            Widgets
                        </Sidebar.Item>
                        <Sidebar.Item
                            icon={
                                <FontAwesomeIcon
                                    icon="compass"
                                    className="h-3.5 w-3.5"
                                />
                            }
                            onClick={() => {
                                setActiveTab("discover");
                                onCollapsedChange && onCollapsedChange(false);
                            }}
                        >
                            Discover
                        </Sidebar.Item>
                    </>
                ) : activeTab === "installed" ? (
                    authorNames.length > 0 ? (
                        authorNames.map((author) => (
                            <Sidebar.Group key={author} label={author}>
                                <div className="flex flex-col gap-1">
                                    {filteredGrouped[author].map(
                                        ({ key, widget }) => (
                                            <DraggableWidgetItem
                                                key={key}
                                                widgetKey={key}
                                                widget={widget}
                                            />
                                        )
                                    )}
                                </div>
                            </Sidebar.Group>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 px-4 text-center opacity-50">
                            <span className="text-sm">No widgets match</span>
                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="text-xs mt-2 text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    )
                ) : (
                    <SidebarDiscoverContent
                        registry={registry}
                        onInstallSuccess={handleInstallSuccess}
                    />
                )}
            </Sidebar.Content>

            {/* Footer — only on installed tab, shows install success flash */}
            {!collapsed && activeTab === "installed" && installSuccess && (
                <Sidebar.Footer>
                    <div className="flex items-center gap-2 text-xs text-emerald-400 px-1 py-1">
                        <FontAwesomeIcon
                            icon="circle-check"
                            className="h-3 w-3"
                        />
                        {installSuccess}
                    </div>
                </Sidebar.Footer>
            )}
        </Sidebar>
    );
};
