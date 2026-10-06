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
import { useState, useEffect, useCallback, useRef, useContext } from "react";
import {
    Panel,
    SubHeading2,
    SubHeading3,
    Button,
    AlertBanner,
    Caption2,
    InputText,
    SelectInput,
    StatusBadge,
    ProgressBar2,
    ThemeContext,
} from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useProviderClient,
    useWidgetEvents,
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
    const { currentTheme } = useContext(ThemeContext);

    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);
    const { listen, listeners } = useWidgetEvents();

    // Listen for indexSelected events from IndexSelector widget
    useEffect(() => {
        if (!listeners || !listen) return;
        const hasListeners =
            typeof listeners === "object" && Object.keys(listeners).length > 0;
        if (hasListeners) {
            listen(listeners, {
                indexSelected: (data) => {
                    const payload = data.message || data;
                    if (payload.name) setSelectedIndex(payload.name);
                },
            });
        }
    }, [listeners, listen]);

    // Load index list on mount
    useEffect(() => {
        if (!pc?.providerHash) return;
        let cancelled = false;
        setLoadingIndices(true);

        window.mainApi.algolia
            .listIndices({ ...pc })
            .then((data) => {
                if (!cancelled) {
                    setIndices(Array.isArray(data) ? data : []);
                    setLoadingIndices(false);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err?.message || "Failed to load indices");
                    setLoadingIndices(false);
                }
            });

        return () => {
            cancelled = true;
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
                <AlertBanner
                    variant="warning"
                    size="compact"
                    message="Algolia credential provider not configured. Add an Algolia provider with your App ID and API Key."
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} padding={false} />

            {/* Index Selector */}
            <div className="space-y-1">
                <SubHeading3 title="Index" padding={false} />
                <SelectInput
                    value={selectedIndex}
                    onChange={(value) => {
                        setSelectedIndex(value);
                        setExportComplete(false);
                    }}
                    disabled={
                        loadingIndices || indices.length === 0 || exporting
                    }
                    placeholder={
                        loadingIndices
                            ? "Loading indices..."
                            : indices.length === 0
                            ? "No indices available"
                            : "Select an index"
                    }
                    options={indices.map((idx) => ({
                        value: idx.name,
                        label: `${idx.name} (${(
                            idx.entries || 0
                        ).toLocaleString()} records)`,
                    }))}
                    inputClassName="text-xs"
                />
            </div>

            {/* Selected Index Info */}
            {selectedIndexInfo && (
                <div
                    className={`rounded p-2 text-xs ${
                        currentTheme?.["bg-primary-dark"] || ""
                    }`}
                >
                    <span
                        className={`font-mono ${
                            currentTheme?.["text-primary-medium"] || ""
                        }`}
                    >
                        {selectedIndexInfo.name}
                    </span>
                    <Caption2 className="ml-2">
                        {(selectedIndexInfo.entries || 0).toLocaleString()}{" "}
                        records
                    </Caption2>
                </div>
            )}

            {/* Filter Query */}
            <div className="space-y-1">
                <SubHeading3 title="Filter (optional)" padding={false} />
                <InputText
                    type="text"
                    value={filterQuery}
                    onChange={(value) => setFilterQuery(value)}
                    placeholder="Filter query (leave empty for all records)"
                    disabled={exporting}
                    height="h-7"
                    padding="px-2 py-1"
                    inputClassName="text-xs"
                />
            </div>

            {/* Export Button */}
            <Button
                onClick={chooseFileAndExport}
                disabled={!selectedIndex || exporting}
                size="sm"
                block
            >
                {exporting ? "Exporting..." : "Choose Folder & Export"}
            </Button>

            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
            )}

            {/* Progress */}
            {exporting && (
                <div className="space-y-2">
                    <StatusBadge
                        state="pending"
                        label={`Exported ${exportedCount.toLocaleString()} records...`}
                        compact
                    />
                    <ProgressBar2
                        size="sm"
                        value={
                            selectedIndexInfo?.entries
                                ? Math.min(
                                      100,
                                      (exportedCount /
                                          selectedIndexInfo.entries) *
                                          100
                                  )
                                : 50
                        }
                    />
                </div>
            )}

            {/* Complete */}
            {exportComplete && (
                <AlertBanner
                    variant="success"
                    size="compact"
                    message={`Export complete: ${exportedCount.toLocaleString()} records`}
                >
                    <div className="font-mono break-all opacity-75">
                        {exportFilePath}
                    </div>
                </AlertBanner>
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
