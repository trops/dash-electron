/**
 * AlgoliaExportWidget
 *
 * Select an index and export/browse all records to a JSON file.
 * Shows progress during export via IPC events.
 * Uses window.mainApi.algolia.browseObjectsToFile().
 * Requires an Algolia credential provider (appId + apiKey).
 *
 * @package Algolia
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useProviderClient,
} from "@trops/dash-core";

function AlgoliaExportContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const [indices, setIndices] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState("");
    const [filterQuery, setFilterQuery] = useState("");
    const [exporting, setExporting] = useState(false);
    const [loadingIndices, setLoadingIndices] = useState(false);
    const [error, setError] = useState(null);
    const [exportedCount, setExportedCount] = useState(0);
    const [exportComplete, setExportComplete] = useState(false);
    const [exportFilePath, setExportFilePath] = useState("");
    const cleanupRef = useRef(null);

    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);

    // Load index list on mount
    useEffect(() => {
        if (!pc?.providerHash) return;
        setLoadingIndices(true);

        const handleComplete = (_event, data) => {
            setIndices(data || []);
            setLoadingIndices(false);
        };
        const handleError = (_event, data) => {
            setError(data?.error || "Failed to load indices");
            setLoadingIndices(false);
        };

        window.mainApi.on("algolia-list-indices-complete", handleComplete);
        window.mainApi.on("algolia-list-indices-error", handleError);
        window.mainApi.algolia.listIndices({ ...pc });

        return () => {
            window.mainApi.removeListener(
                "algolia-list-indices-complete",
                handleComplete
            );
            window.mainApi.removeListener(
                "algolia-list-indices-error",
                handleError
            );
        };
    }, [pc?.providerHash]); // eslint-disable-line react-hooks/exhaustive-deps

    // Cleanup export listeners on unmount
    useEffect(() => {
        return () => {
            if (cleanupRef.current) cleanupRef.current();
        };
    }, []);

    const chooseFileAndExport = useCallback(async () => {
        if (!selectedIndex || !pc?.providerHash) return;

        try {
            // Let user pick save location
            const result = await window.mainApi.dialog.showDialog(
                { allowFile: false },
                false,
                []
            );
            if (!result || result.canceled || !result.filePaths?.[0]) return;

            const dir = result.filePaths[0];
            const filename = `${dir}/${selectedIndex}_export.json`;

            setExporting(true);
            setExportedCount(0);
            setExportComplete(false);
            setExportFilePath(filename);
            setError(null);

            const handleUpdate = (_event, hits) => {
                setExportedCount((prev) => prev + (hits?.length || 0));
            };
            const handleComplete = () => {
                setExporting(false);
                setExportComplete(true);
            };
            const handleError = (_event, err) => {
                setExporting(false);
                setError(err?.message || err?.error || "Export failed");
            };

            window.mainApi.on("algolia-browse-objects-update", handleUpdate);
            window.mainApi.on(
                "algolia-browse-objects-complete",
                handleComplete
            );
            window.mainApi.on("algolia-browse-objects-error", handleError);

            cleanupRef.current = () => {
                window.mainApi.removeListener(
                    "algolia-browse-objects-update",
                    handleUpdate
                );
                window.mainApi.removeListener(
                    "algolia-browse-objects-complete",
                    handleComplete
                );
                window.mainApi.removeListener(
                    "algolia-browse-objects-error",
                    handleError
                );
            };

            window.mainApi.algolia.browseObjectsToFile({
                ...pc,
                indexName: selectedIndex,
                toFilename: filename,
                query: filterQuery,
            });
        } catch (err) {
            setExporting(false);
            setError(err.message || "Failed to start export");
        }
    }, [selectedIndex, pc?.providerHash, filterQuery]); // eslint-disable-line react-hooks/exhaustive-deps

    const selectedIndexInfo = indices.find((idx) => idx.name === selectedIndex);

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
            <SubHeading2 title={title} padding={false} />

            {/* Index Selector */}
            <div className="space-y-1">
                <SubHeading3 title="Index" padding={false} />
                <select
                    value={selectedIndex}
                    onChange={(e) => {
                        setSelectedIndex(e.target.value);
                        setExportComplete(false);
                    }}
                    disabled={
                        loadingIndices || indices.length === 0 || exporting
                    }
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                >
                    <option value="">
                        {loadingIndices
                            ? "Loading indices..."
                            : indices.length === 0
                            ? "No indices available"
                            : "Select an index"}
                    </option>
                    {indices.map((idx, i) => (
                        <option key={idx.name + i} value={idx.name}>
                            {idx.name} ({(idx.entries || 0).toLocaleString()}{" "}
                            records)
                        </option>
                    ))}
                </select>
            </div>

            {/* Selected Index Info */}
            {selectedIndexInfo && (
                <div className="bg-white/5 rounded p-2 text-xs text-gray-400">
                    <span className="text-gray-200 font-mono">
                        {selectedIndexInfo.name}
                    </span>
                    <span className="ml-2">
                        {(selectedIndexInfo.entries || 0).toLocaleString()}{" "}
                        records
                    </span>
                </div>
            )}

            {/* Filter Query */}
            <div className="space-y-1">
                <SubHeading3 title="Filter (optional)" padding={false} />
                <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Filter query (leave empty for all records)"
                    disabled={exporting}
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                />
            </div>

            {/* Export Button */}
            <button
                onClick={chooseFileAndExport}
                disabled={!selectedIndex || exporting}
                className="w-full px-3 py-2 text-xs rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium"
            >
                {exporting ? "Exporting..." : "Choose Folder & Export"}
            </button>

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {/* Progress */}
            {exporting && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-xs text-gray-300">
                            Exported {exportedCount.toLocaleString()} records...
                        </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                        <div
                            className="bg-amber-500 h-1.5 rounded-full transition-all"
                            style={{
                                width: selectedIndexInfo?.entries
                                    ? `${Math.min(
                                          100,
                                          (exportedCount /
                                              selectedIndexInfo.entries) *
                                              100
                                      )}%`
                                    : "50%",
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Complete */}
            {exportComplete && (
                <div className="p-2 bg-green-900/30 border border-green-700 rounded text-green-300 text-xs space-y-1">
                    <div>
                        Export complete: {exportedCount.toLocaleString()}{" "}
                        records
                    </div>
                    <div className="text-[10px] text-green-400/70 font-mono break-all">
                        {exportFilePath}
                    </div>
                </div>
            )}
        </div>
    );
}

export const AlgoliaExportWidget = ({ title = "Algolia Export", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaExportContent title={title} />
            </Panel>
        </Widget>
    );
};
