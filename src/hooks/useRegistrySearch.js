import { useState, useEffect, useCallback } from "react";

/**
 * useRegistrySearch — shared hook for browsing and installing registry packages.
 *
 * Extracted from EnhancedWidgetDropdown so the same logic can power the
 * Discover tab inside AppSettingsModal (and anywhere else).
 *
 * Returns:
 *   packages      – raw package objects from the registry
 *   flatWidgets   – flattened widget entries with `isRegistry: true`
 *   isLoading     – true while a search request is in flight
 *   error         – error message string (or null)
 *   searchQuery / setSearchQuery – controlled search input
 *   isInstalling  – true during an install
 *   installError  – install error string (or null)
 *   search()      – manually trigger a search
 *   installPackage(widget) – install a specific registry widget
 */
export const useRegistrySearch = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [packages, setPackages] = useState([]);
    const [flatWidgets, setFlatWidgets] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isInstalling, setIsInstalling] = useState(false);
    const [installError, setInstallError] = useState(null);

    const search = useCallback(
        async (query) => {
            // Graceful fallback when running outside Electron
            if (!window.mainApi?.registry) {
                setPackages([]);
                setFlatWidgets([]);
                return;
            }

            setIsLoading(true);
            setError(null);
            try {
                const result = await window.mainApi.registry.search(
                    query ?? searchQuery,
                    {}
                );
                const pkgs = result.packages || [];
                setPackages(pkgs);

                // Flatten packages into widget entries
                const widgets = [];
                for (const pkg of pkgs) {
                    for (const widget of pkg.widgets || []) {
                        widgets.push({
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
                setFlatWidgets(widgets);
            } catch (err) {
                console.error("[useRegistrySearch] Registry error:", err);
                setError(err.message || "Failed to load registry");
                setPackages([]);
                setFlatWidgets([]);
            } finally {
                setIsLoading(false);
            }
        },
        [searchQuery]
    );

    // Debounce search on query changes (300ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            search(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery]);

    const installPackage = useCallback(async (widget) => {
        if (!widget || !widget.isRegistry) return;

        setIsInstalling(true);
        setInstallError(null);

        try {
            const { packageName, downloadUrl, packageVersion } = widget;

            // Resolve placeholders in the download URL
            const resolvedUrl = downloadUrl
                .replace(/\{version\}/g, packageVersion)
                .replace(/\{name\}/g, packageName);

            console.log(
                `[useRegistrySearch] Installing package: ${packageName} from ${resolvedUrl}`
            );

            await window.mainApi.widgets.install(packageName, resolvedUrl);

            console.log(
                `[useRegistrySearch] Package ${packageName} installed successfully`
            );
        } catch (err) {
            console.error("[useRegistrySearch] Install error:", err);
            setInstallError(err.message || "Failed to install package");
        } finally {
            setIsInstalling(false);
        }
    }, []);

    const retry = useCallback(() => {
        search(searchQuery);
    }, [search, searchQuery]);

    return {
        packages,
        flatWidgets,
        isLoading,
        error,
        searchQuery,
        setSearchQuery,
        isInstalling,
        installError,
        search,
        installPackage,
        retry,
    };
};
