/**
 * AlgoliaIndexDashboardWidget
 *
 * Lists all indices with names, record counts, and metadata.
 * Uses the direct Algolia IPC API (window.mainApi.algolia.listIndices).
 * Requires an Algolia credential provider (appId + apiKey).
 *
 * @package Algolia
 */
import { useState, useEffect, useCallback, useContext } from "react";
import {
    Panel,
    SubHeading2,
    Button2,
    AlertBanner,
    Caption2,
    EmptyState,
    ThemeContext,
} from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useProviderClient,
} from "@trops/dash-core";

function AlgoliaIndexDashboardContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const { currentTheme } = useContext(ThemeContext);
    const [indices, setIndices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [sortField, setSortField] = useState("entries");
    const [sortAsc, setSortAsc] = useState(false);

    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);
    const algoliaAppId = provider?.credentials?.appId || "";

    const loadIndices = useCallback(
        (forceRefresh = false) => {
            if (!pc?.providerHash) return;
            setLoading(true);
            setError(null);

            window.mainApi.algolia
                .listIndices({
                    ...pc,
                    cache: true,
                    forceRefresh,
                })
                .then((data) => {
                    setIndices(Array.isArray(data) ? data : []);
                    setLoading(false);
                })
                .catch((err) => {
                    setError(err?.message || "Failed to load indices");
                    setLoading(false);
                });
        },
        [pc?.providerHash] // eslint-disable-line react-hooks/exhaustive-deps
    );

    useEffect(() => {
        loadIndices();
    }, [loadIndices]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(field === "name");
        }
    };

    const sorted = [...indices].sort((a, b) => {
        let aVal, bVal;
        if (sortField === "name") {
            aVal = a.name?.toLowerCase() || "";
            bVal = b.name?.toLowerCase() || "";
        } else if (sortField === "entries") {
            aVal = a.entries || 0;
            bVal = b.entries || 0;
        } else if (sortField === "dataSize") {
            aVal = a.dataSize || 0;
            bVal = b.dataSize || 0;
        } else if (sortField === "updatedAt") {
            aVal = a.updatedAt || "";
            bVal = b.updatedAt || "";
        }
        if (aVal < bVal) return sortAsc ? -1 : 1;
        if (aVal > bVal) return sortAsc ? 1 : -1;
        return 0;
    });

    const totalRecords = indices.reduce(
        (sum, idx) => sum + (idx.entries || 0),
        0
    );
    const totalSize = indices.reduce(
        (sum, idx) => sum + (idx.dataSize || 0),
        0
    );

    const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024)
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "-";
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    if (!hasCredentials) {
        return (
            <div className="flex flex-col gap-3 h-full text-sm">
                <SubHeading2 title={title} padding={false} />
                <AlertBanner
                    variant="warning"
                    size="compact"
                    message="Algolia credential provider not configured. Add an Algolia provider with your App ID and API Key."
                />
            </div>
        );
    }

    // Theme tokens: tiles and rows sit one step above the Panel surface;
    // headline numbers use the secondary/tertiary accent channels.
    const surfaceClass = `${currentTheme?.["bg-primary-dark"] || ""} ${
        currentTheme?.["text-primary-medium"] || ""
    }`;
    const rowHover = currentTheme?.["hover-bg-primary-dark"] || "";
    const accentText = currentTheme?.["text-secondary-medium"] || "";
    const accentText2 = currentTheme?.["text-tertiary-medium"] || "";

    const summaryTiles = [
        { label: "Indices", value: indices.length, className: accentText },
        {
            label: "Total Records",
            value: totalRecords.toLocaleString(),
            className: accentText,
        },
        {
            label: "Total Size",
            value: formatSize(totalSize),
            className: accentText2,
        },
    ];

    const sortArrow = (field) =>
        sortField === field ? (sortAsc ? "^" : "v") : "";

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <div className="flex items-center justify-between">
                <SubHeading2 title={title} padding={false} />
                <Button2
                    onClick={() => loadIndices(true)}
                    disabled={loading}
                    size="sm"
                >
                    {loading ? "Loading..." : "Refresh"}
                </Button2>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-2">
                {summaryTiles.map((tile) => (
                    <div
                        key={tile.label}
                        className={`rounded p-2 text-center ${surfaceClass}`}
                    >
                        <div className={`text-lg font-bold ${tile.className}`}>
                            {tile.value}
                        </div>
                        <Caption2 block className="uppercase tracking-wider">
                            {tile.label}
                        </Caption2>
                    </div>
                ))}
            </div>

            {/* App ID */}
            <Caption2 block className="font-mono">
                App: {algoliaAppId}
            </Caption2>

            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
            )}

            {/* Index Table */}
            {indices.length > 0 && (
                <div className="space-y-0.5">
                    {/* Header */}
                    <Caption2
                        block
                        className="grid grid-cols-12 gap-1 uppercase tracking-wider px-2 py-1"
                    >
                        <button
                            onClick={() => handleSort("name")}
                            className="col-span-5 text-left hover:underline"
                        >
                            Name {sortArrow("name")}
                        </button>
                        <button
                            onClick={() => handleSort("entries")}
                            className="col-span-3 text-right hover:underline"
                        >
                            Records {sortArrow("entries")}
                        </button>
                        <button
                            onClick={() => handleSort("dataSize")}
                            className="col-span-2 text-right hover:underline"
                        >
                            Size {sortArrow("dataSize")}
                        </button>
                        <button
                            onClick={() => handleSort("updatedAt")}
                            className="col-span-2 text-right hover:underline"
                        >
                            Updated {sortArrow("updatedAt")}
                        </button>
                    </Caption2>

                    {/* Rows */}
                    <div className="overflow-y-auto space-y-0.5">
                        {sorted.map((idx, i) => (
                            <div
                                key={idx.name + i}
                                className={`grid grid-cols-12 gap-1 px-2 py-1.5 rounded text-xs transition-colors ${surfaceClass} ${rowHover}`}
                            >
                                <div className="col-span-5 truncate font-mono">
                                    {idx.name}
                                </div>
                                <div className="col-span-3 text-right">
                                    {(idx.entries || 0).toLocaleString()}
                                </div>
                                <Caption2 className="col-span-2 text-right">
                                    {formatSize(idx.dataSize || 0)}
                                </Caption2>
                                <Caption2 className="col-span-2 text-right">
                                    {formatDate(idx.updatedAt)}
                                </Caption2>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!loading && indices.length === 0 && !error && (
                <EmptyState description="No indices found." className="p-2" />
            )}
        </div>
    );
}

export const AlgoliaIndexDashboardWidget = ({
    title = "Algolia Indices",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaIndexDashboardContent title={title} />
            </Panel>
        </Widget>
    );
};
