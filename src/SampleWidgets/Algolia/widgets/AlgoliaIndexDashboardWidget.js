/**
 * AlgoliaIndexDashboardWidget
 *
 * Lists all indices with names, record counts, and metadata.
 * Uses the direct Algolia IPC API (window.mainApi.algolia.listIndices).
 * Requires an Algolia credential provider (appId + apiKey).
 *
 * @package Algolia
 */
import { useState, useEffect, useCallback } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useProviderClient,
} from "@trops/dash-core";

function AlgoliaIndexDashboardContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
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
                <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-300 text-xs">
                    Algolia credential provider not configured. Add an Algolia
                    provider with your App ID and API Key.
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <div className="flex items-center justify-between">
                <SubHeading2 title={title} padding={false} />
                <button
                    onClick={() => loadIndices(true)}
                    disabled={loading}
                    className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white"
                >
                    {loading ? "Loading..." : "Refresh"}
                </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/5 rounded p-2 text-center">
                    <div className="text-lg font-bold text-blue-400">
                        {indices.length}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                        Indices
                    </div>
                </div>
                <div className="bg-white/5 rounded p-2 text-center">
                    <div className="text-lg font-bold text-green-400">
                        {totalRecords.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                        Total Records
                    </div>
                </div>
                <div className="bg-white/5 rounded p-2 text-center">
                    <div className="text-lg font-bold text-purple-400">
                        {formatSize(totalSize)}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                        Total Size
                    </div>
                </div>
            </div>

            {/* App ID */}
            <div className="text-[10px] text-gray-500 font-mono">
                App: {algoliaAppId}
            </div>

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {/* Index Table */}
            {indices.length > 0 && (
                <div className="space-y-0.5">
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-1 text-[10px] text-gray-500 uppercase tracking-wider px-2 py-1">
                        <button
                            onClick={() => handleSort("name")}
                            className="col-span-5 text-left hover:text-gray-300"
                        >
                            Name{" "}
                            {sortField === "name" ? (sortAsc ? "^" : "v") : ""}
                        </button>
                        <button
                            onClick={() => handleSort("entries")}
                            className="col-span-3 text-right hover:text-gray-300"
                        >
                            Records{" "}
                            {sortField === "entries"
                                ? sortAsc
                                    ? "^"
                                    : "v"
                                : ""}
                        </button>
                        <button
                            onClick={() => handleSort("dataSize")}
                            className="col-span-2 text-right hover:text-gray-300"
                        >
                            Size{" "}
                            {sortField === "dataSize"
                                ? sortAsc
                                    ? "^"
                                    : "v"
                                : ""}
                        </button>
                        <button
                            onClick={() => handleSort("updatedAt")}
                            className="col-span-2 text-right hover:text-gray-300"
                        >
                            Updated{" "}
                            {sortField === "updatedAt"
                                ? sortAsc
                                    ? "^"
                                    : "v"
                                : ""}
                        </button>
                    </div>

                    {/* Rows */}
                    <div className="max-h-[60vh] overflow-y-auto space-y-0.5">
                        {sorted.map((idx, i) => (
                            <div
                                key={idx.name + i}
                                className="grid grid-cols-12 gap-1 px-2 py-1.5 bg-white/5 rounded text-xs hover:bg-white/10 transition-colors"
                            >
                                <div className="col-span-5 text-gray-200 truncate font-mono text-[11px]">
                                    {idx.name}
                                </div>
                                <div className="col-span-3 text-right text-gray-300">
                                    {(idx.entries || 0).toLocaleString()}
                                </div>
                                <div className="col-span-2 text-right text-gray-400">
                                    {formatSize(idx.dataSize || 0)}
                                </div>
                                <div className="col-span-2 text-right text-gray-500 text-[10px]">
                                    {formatDate(idx.updatedAt)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!loading && indices.length === 0 && !error && (
                <div className="text-xs text-gray-600 italic p-2">
                    No indices found.
                </div>
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
