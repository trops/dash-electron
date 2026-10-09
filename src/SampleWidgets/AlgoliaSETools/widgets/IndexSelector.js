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
import { useState, useEffect, useCallback, useContext } from "react";
import {
    Panel,
    SubHeading2,
    AlertBanner,
    Caption2,
    SelectInput,
    ThemeContext,
    useStatusTokens,
    readableError,
} from "@trops/dash-react";
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
    const { currentTheme } = useContext(ThemeContext);
    const status = useStatusTokens();

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
                    setError(readableError(err, "Failed to load indices"));
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
    const valueText = currentTheme?.["text-primary-medium"] || "";

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

            {!hasCredentials && (
                <AlertBanner
                    variant="warning"
                    size="compact"
                    message="Algolia provider not configured. Add an Algolia credential provider in Settings > Providers."
                />
            )}

            {hasCredentials && (
                <SelectInput
                    value={selectedIndex}
                    onChange={(value) => handleSelect(value)}
                    placeholder={
                        loading
                            ? "Loading indices..."
                            : "Select an index to broadcast"
                    }
                    options={indices.map((idx) => ({
                        value: idx.name,
                        label: `${idx.name} (${(
                            idx.entries || 0
                        ).toLocaleString()} records)`,
                    }))}
                    className="w-full"
                    inputClassName="text-xs"
                />
            )}

            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
            )}

            {/* Selected index metadata */}
            {selectedMeta && (
                <div
                    className={`p-2 rounded space-y-1 text-xs ${
                        currentTheme?.["bg-primary-dark"] || ""
                    }`}
                >
                    <div className={`font-medium ${valueText}`}>
                        {selectedMeta.name}
                    </div>
                    <Caption2
                        block
                        className="grid grid-cols-2 gap-x-4 gap-y-0.5"
                    >
                        <span>
                            Records:{" "}
                            <span className={valueText}>
                                {(selectedMeta.entries || 0).toLocaleString()}
                            </span>
                        </span>
                        <span>
                            Size:{" "}
                            <span className={valueText}>
                                {formatBytes(selectedMeta.dataSize)}
                            </span>
                        </span>
                        {selectedMeta.updatedAt && (
                            <span>
                                Updated:{" "}
                                <span className={valueText}>
                                    {formatDate(selectedMeta.updatedAt)}
                                </span>
                            </span>
                        )}
                        {selectedMeta.lastBuildTimeS != null && (
                            <span>
                                Build:{" "}
                                <span className={valueText}>
                                    {selectedMeta.lastBuildTimeS}s
                                </span>
                            </span>
                        )}
                    </Caption2>
                    <div className={`text-xs mt-1 ${status.success.icon}`}>
                        indexSelected event published
                    </div>
                </div>
            )}

            {!selectedIndex && !loading && !error && hasCredentials && (
                <Caption2 block className="italic">
                    Select an index to broadcast the selection to other widgets
                    in this dashboard.
                </Caption2>
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
