/**
 * AttributeExplorer
 *
 * Scan records from an Algolia index to discover all attributes,
 * their types, cardinality, fill rates, and sample values.
 * Helps SEs understand a customer's data structure before configuring.
 *
 * @package AlgoliaSETools
 */
import { useState, useEffect, useCallback, useRef, useContext } from "react";
import {
    Panel,
    SubHeading2,
    Button,
    AlertBanner,
    Caption2,
    SelectInput,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useWidgetEvents,
    useProviderClient,
} from "@trops/dash-core";
import { analyzeRecords } from "../utils/attributeAnalyzer";

// Per-type text color, built from theme + status tokens so it follows
// light/dark themes.
function getTypeColors(currentTheme, status) {
    return {
        string: status.success.icon,
        number: status.info.icon,
        boolean: status.warning.icon,
        array: currentTheme?.["text-secondary-medium"] || "",
        object: currentTheme?.["text-tertiary-medium"] || "",
        null: "opacity-60",
    };
}

function AttributeExplorerContent({ title, sampleSize = "100" }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const { listen, listeners } = useWidgetEvents();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);
    const { currentTheme } = useContext(ThemeContext);
    const status = useStatusTokens();

    const [indices, setIndices] = useState([]);
    const [loadingIndices, setLoadingIndices] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState("");
    const [scanning, setScanning] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState(null);
    const [expandedAttr, setExpandedAttr] = useState(null);
    const fromEventRef = useRef(false);

    // Load index list via invoke (returns data directly)
    useEffect(() => {
        if (!pc?.providerHash) return;
        let cancelled = false;
        setLoadingIndices(true);

        window.mainApi.algolia
            .listIndices({ ...pc, cache: true })
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

    // Listen for indexSelected events from IndexSelector widget
    useEffect(() => {
        if (!listeners || !listen) return;
        const hasListeners =
            typeof listeners === "object" && Object.keys(listeners).length > 0;
        if (hasListeners) {
            listen(listeners, {
                indexSelected: (data) => {
                    const payload = data.message || data;
                    if (payload.name) {
                        fromEventRef.current = true;
                        setSelectedIndex(payload.name);
                    }
                },
            });
        }
    }, [listeners, listen]);

    const handleScan = useCallback(async () => {
        if (!pc?.providerHash || !selectedIndex) return;
        setScanning(true);
        setError(null);
        setAnalysis(null);
        setExpandedAttr(null);

        try {
            const size = Math.min(parseInt(sampleSize) || 100, 1000);
            const allHits = [];
            const pages = Math.ceil(size / 100);

            for (let page = 0; page < pages; page++) {
                const hitsPerPage = Math.min(100, size - allHits.length);
                const result = await window.mainApi.algolia.search({
                    ...pc,
                    indexName: selectedIndex,
                    query: "",
                    page,
                    hitsPerPage,
                });
                if (result?.error) {
                    setError(result.message || "Search failed");
                    return;
                }
                if (result?.hits) {
                    allHits.push(...result.hits);
                }
                if (!result?.hits || result.hits.length < hitsPerPage) break;
            }

            const result = analyzeRecords(allHits);
            setAnalysis(result);
        } catch (err) {
            setError(err.message || "Scan failed");
        } finally {
            setScanning(false);
        }
    }, [pc, selectedIndex, sampleSize]);

    // Auto-trigger scan when index is set via indexSelected event
    useEffect(() => {
        if (fromEventRef.current && selectedIndex) {
            fromEventRef.current = false;
            handleScan();
        }
    }, [selectedIndex, handleScan]);

    const typeColors = getTypeColors(currentTheme, status);
    const bodyText = currentTheme?.["text-primary-medium"] || "";
    const borderColor = currentTheme?.["border-primary-dark"] || "";
    const surface = currentTheme?.["bg-primary-dark"] || "";
    const thClass = `px-2 py-1.5 font-medium border-b ${borderColor}`;

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
                <div className="flex flex-wrap items-center gap-2">
                    <SelectInput
                        value={selectedIndex}
                        onChange={(value) => setSelectedIndex(value)}
                        placeholder={
                            loadingIndices
                                ? "Loading indices..."
                                : "Select an index"
                        }
                        options={indices.map((idx) => ({
                            value: idx.name,
                            label: `${idx.name} (${(
                                idx.entries || 0
                            ).toLocaleString()})`,
                        }))}
                        className="flex-1 min-w-0"
                        inputClassName="text-xs"
                    />
                    <Button
                        size="sm"
                        onClick={handleScan}
                        disabled={!selectedIndex || scanning}
                    >
                        {scanning ? "Scanning..." : "Scan"}
                    </Button>
                </div>
            )}

            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
            )}

            {analysis && (
                <div className="space-y-1">
                    <Caption2 block>
                        {analysis.attributes.length} attributes found from{" "}
                        {analysis.totalRecords} sampled records
                    </Caption2>

                    <div
                        className={`border rounded overflow-hidden ${borderColor}`}
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className={surface}>
                                        <th className={`${thClass} text-left`}>
                                            <Caption2 className="font-medium">
                                                Attribute
                                            </Caption2>
                                        </th>
                                        <th className={`${thClass} text-left`}>
                                            <Caption2 className="font-medium">
                                                Type
                                            </Caption2>
                                        </th>
                                        <th className={`${thClass} text-right`}>
                                            <Caption2 className="font-medium">
                                                Fill %
                                            </Caption2>
                                        </th>
                                        <th className={`${thClass} text-right`}>
                                            <Caption2 className="font-medium">
                                                Unique
                                            </Caption2>
                                        </th>
                                        <th className={`${thClass} text-left`}>
                                            <Caption2 className="font-medium">
                                                Sample
                                            </Caption2>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {analysis.attributes.map((attr) => (
                                        <tr
                                            key={attr.name}
                                            className={`border-b cursor-pointer ${borderColor} ${
                                                currentTheme?.[
                                                    "hover-bg-primary-dark"
                                                ] || ""
                                            }`}
                                            onClick={() =>
                                                setExpandedAttr(
                                                    expandedAttr === attr.name
                                                        ? null
                                                        : attr.name
                                                )
                                            }
                                        >
                                            <td
                                                className={`px-2 py-1.5 font-mono ${bodyText}`}
                                            >
                                                {attr.name}
                                                {attr.isObjectID && (
                                                    <span
                                                        className={`ml-1 text-xs ${
                                                            currentTheme?.[
                                                                "text-secondary-medium"
                                                            ] || ""
                                                        }`}
                                                    >
                                                        PK
                                                    </span>
                                                )}
                                            </td>
                                            <td
                                                className={`px-2 py-1.5 font-mono ${
                                                    typeColors[
                                                        attr.primaryType
                                                    ] || bodyText
                                                }`}
                                            >
                                                {attr.primaryType}
                                            </td>
                                            <td className="px-2 py-1.5 text-right">
                                                <span
                                                    className={
                                                        attr.fillRate >= 90
                                                            ? status.success
                                                                  .icon
                                                            : attr.fillRate >=
                                                              50
                                                            ? status.warning
                                                                  .icon
                                                            : status.error.icon
                                                    }
                                                >
                                                    {attr.fillRate}%
                                                </span>
                                            </td>
                                            <td
                                                className={`px-2 py-1.5 text-right ${bodyText}`}
                                            >
                                                {attr.cardinality}
                                                {attr.cardinalityNote && "+"}
                                            </td>
                                            <td className="px-2 py-1.5 truncate max-w-xs">
                                                <Caption2>
                                                    {attr.sampleValues
                                                        .slice(0, 2)
                                                        .join(", ")}
                                                </Caption2>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Expanded Detail */}
                    {expandedAttr && (
                        <div
                            className={`p-2 rounded text-xs space-y-1 ${surface}`}
                        >
                            {(() => {
                                const attr = analysis.attributes.find(
                                    (a) => a.name === expandedAttr
                                );
                                if (!attr) return null;
                                return (
                                    <>
                                        <div
                                            className={`font-medium ${bodyText}`}
                                        >
                                            {attr.name}
                                        </div>
                                        <Caption2 block>
                                            Present: {attr.presentCount} | Null:{" "}
                                            {attr.nullCount} | Empty:{" "}
                                            {attr.emptyCount} | Missing:{" "}
                                            {attr.missingCount}
                                        </Caption2>
                                        <Caption2 block>
                                            Types:{" "}
                                            {attr.types
                                                .map(
                                                    (t) =>
                                                        `${t.type}(${t.count})`
                                                )
                                                .join(", ")}
                                        </Caption2>
                                        {attr.sampleValues.length > 0 && (
                                            <div
                                                className={`font-mono ${bodyText}`}
                                            >
                                                Samples:{" "}
                                                {attr.sampleValues.join(" | ")}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}

            {!analysis && !scanning && !error && hasCredentials && (
                <Caption2 block className="italic">
                    Select an index and click Scan to discover attribute types,
                    fill rates, and cardinality.
                </Caption2>
            )}
        </div>
    );
}

export const AttributeExplorer = ({
    title = "Attribute Explorer",
    sampleSize = "100",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AttributeExplorerContent
                    title={title}
                    sampleSize={sampleSize}
                />
            </Panel>
        </Widget>
    );
};
