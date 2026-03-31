/**
 * IndexSelector
 *
 * Compact index picker that publishes an indexSelected event.
 * Other widgets in the dashboard can optionally listen for this
 * event to set their active index without each loading indices
 * independently.
 *
 * Shows index name, record count, data size, and last updated.
 *
 * @package AlgoliaSETools
 */
import { useState, useEffect, useCallback } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useProviderClient,
    useWidgetEvents,
} from "@trops/dash-core";

function formatBytes(bytes) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr) {
    if (!dateStr) return "";
    try {
        return new Date(dateStr).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    } catch {
        return dateStr;
    }
}

function IndexSelectorContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const { publishEvent } = useWidgetEvents();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);

    const [indices, setIndices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState("");
    const [error, setError] = useState(null);

    // Load index list via invoke
    useEffect(() => {
        if (!pc?.providerHash) return;
        let cancelled = false;
        setLoading(true);

        window.mainApi.algolia
            .listIndices({ ...pc, cache: true })
            .then((data) => {
                if (!cancelled) {
                    setIndices(Array.isArray(data) ? data : []);
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err?.message || "Failed to load indices");
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [pc?.providerHash]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSelect = useCallback(
        (indexName) => {
            setSelectedIndex(indexName);
            const idx = indices.find((i) => i.name === indexName);
            const payload = {
                name: indexName,
                entries: idx?.entries || 0,
                dataSize: idx?.dataSize || 0,
                lastBuildTimeS: idx?.lastBuildTimeS || null,
                updatedAt: idx?.updatedAt || null,
            };
            try {
                publishEvent("indexSelected", payload);
            } catch (err) {
                console.error(
                    "[IndexSelector] Failed to publish indexSelected:",
                    err
                );
            }
        },
        [indices, publishEvent]
    );

    const selectedMeta = indices.find((i) => i.name === selectedIndex);

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

            {!hasCredentials && (
                <div className="p-2 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-300 text-xs">
                    Algolia provider not configured. Add an Algolia credential
                    provider in Settings &gt; Providers.
                </div>
            )}

            {hasCredentials && (
                <select
                    value={selectedIndex}
                    onChange={(e) => handleSelect(e.target.value)}
                    className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                >
                    <option value="">
                        {loading
                            ? "Loading indices..."
                            : "Select an index to broadcast"}
                    </option>
                    {indices.map((idx) => (
                        <option key={idx.name} value={idx.name}>
                            {idx.name} ({(idx.entries || 0).toLocaleString()}{" "}
                            records)
                        </option>
                    ))}
                </select>
            )}

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {/* Selected index metadata */}
            {selectedMeta && (
                <div className="p-2 bg-gray-800/50 rounded space-y-1 text-xs">
                    <div className="text-gray-300 font-medium">
                        {selectedMeta.name}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-gray-500">
                        <span>
                            Records:{" "}
                            <span className="text-gray-300">
                                {(selectedMeta.entries || 0).toLocaleString()}
                            </span>
                        </span>
                        <span>
                            Size:{" "}
                            <span className="text-gray-300">
                                {formatBytes(selectedMeta.dataSize)}
                            </span>
                        </span>
                        {selectedMeta.updatedAt && (
                            <span>
                                Updated:{" "}
                                <span className="text-gray-300">
                                    {formatDate(selectedMeta.updatedAt)}
                                </span>
                            </span>
                        )}
                        {selectedMeta.lastBuildTimeS != null && (
                            <span>
                                Build:{" "}
                                <span className="text-gray-300">
                                    {selectedMeta.lastBuildTimeS}s
                                </span>
                            </span>
                        )}
                    </div>
                    <div className="text-[10px] text-green-400 mt-1">
                        indexSelected event published
                    </div>
                </div>
            )}

            {!selectedIndex && !loading && !error && hasCredentials && (
                <div className="text-xs text-gray-600 italic">
                    Select an index to broadcast the selection to other widgets
                    in this dashboard.
                </div>
            )}
        </div>
    );
}

export const IndexSelector = ({ title = "Index Selector", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <IndexSelectorContent title={title} />
            </Panel>
        </Widget>
    );
};
