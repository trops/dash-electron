/**
 * AttributeExplorer
 *
 * Scan records from an Algolia index to discover all attributes,
 * their types, cardinality, fill rates, and sample values.
 * Helps SEs understand a customer's data structure before configuring.
 *
 * @package AlgoliaSETools
 */
import { useState, useEffect, useCallback } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useProviderClient,
} from "@trops/dash-core";
import { analyzeRecords } from "../utils/attributeAnalyzer";

const TYPE_COLORS = {
    string: "text-green-400",
    number: "text-blue-400",
    boolean: "text-yellow-400",
    array: "text-purple-400",
    object: "text-orange-400",
    null: "text-gray-500",
};

function AttributeExplorerContent({ title, sampleSize = "100" }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);

    const [indices, setIndices] = useState([]);
    const [loadingIndices, setLoadingIndices] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState("");
    const [scanning, setScanning] = useState(false);
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState(null);
    const [expandedAttr, setExpandedAttr] = useState(null);

    // Load index list
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
        window.mainApi.algolia.listIndices({ ...pc, cache: true });

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
                <div className="flex items-center gap-2">
                    <select
                        value={selectedIndex}
                        onChange={(e) => setSelectedIndex(e.target.value)}
                        className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                    >
                        <option value="">
                            {loadingIndices
                                ? "Loading indices..."
                                : "Select an index"}
                        </option>
                        {indices.map((idx) => (
                            <option key={idx.name} value={idx.name}>
                                {idx.name} (
                                {(idx.entries || 0).toLocaleString()})
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={handleScan}
                        disabled={!selectedIndex || scanning}
                        className="px-3 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        {scanning ? "Scanning..." : "Scan"}
                    </button>
                </div>
            )}

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {analysis && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                            {analysis.attributes.length} attributes found from{" "}
                            {analysis.totalRecords} sampled records
                        </span>
                    </div>

                    <div className="border border-gray-700 rounded overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-800">
                                        <th className="px-2 py-1.5 text-left text-gray-400 font-medium border-b border-gray-700">
                                            Attribute
                                        </th>
                                        <th className="px-2 py-1.5 text-left text-gray-400 font-medium border-b border-gray-700">
                                            Type
                                        </th>
                                        <th className="px-2 py-1.5 text-right text-gray-400 font-medium border-b border-gray-700">
                                            Fill %
                                        </th>
                                        <th className="px-2 py-1.5 text-right text-gray-400 font-medium border-b border-gray-700">
                                            Unique
                                        </th>
                                        <th className="px-2 py-1.5 text-left text-gray-400 font-medium border-b border-gray-700">
                                            Sample
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {analysis.attributes.map((attr) => (
                                        <tr
                                            key={attr.name}
                                            className="border-b border-gray-800 hover:bg-white/5 cursor-pointer"
                                            onClick={() =>
                                                setExpandedAttr(
                                                    expandedAttr === attr.name
                                                        ? null
                                                        : attr.name
                                                )
                                            }
                                        >
                                            <td className="px-2 py-1.5 text-gray-300 font-mono">
                                                {attr.name}
                                                {attr.isObjectID && (
                                                    <span className="ml-1 text-[10px] text-blue-400">
                                                        PK
                                                    </span>
                                                )}
                                            </td>
                                            <td
                                                className={`px-2 py-1.5 font-mono ${
                                                    TYPE_COLORS[
                                                        attr.primaryType
                                                    ] || "text-gray-400"
                                                }`}
                                            >
                                                {attr.primaryType}
                                            </td>
                                            <td className="px-2 py-1.5 text-right">
                                                <span
                                                    className={
                                                        attr.fillRate >= 90
                                                            ? "text-green-400"
                                                            : attr.fillRate >=
                                                              50
                                                            ? "text-yellow-400"
                                                            : "text-red-400"
                                                    }
                                                >
                                                    {attr.fillRate}%
                                                </span>
                                            </td>
                                            <td className="px-2 py-1.5 text-right text-gray-400">
                                                {attr.cardinality}
                                                {attr.cardinalityNote && "+"}
                                            </td>
                                            <td className="px-2 py-1.5 text-gray-500 truncate max-w-[200px]">
                                                {attr.sampleValues
                                                    .slice(0, 2)
                                                    .join(", ")}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Expanded Detail */}
                    {expandedAttr && (
                        <div className="p-2 bg-gray-800/50 rounded text-xs space-y-1">
                            {(() => {
                                const attr = analysis.attributes.find(
                                    (a) => a.name === expandedAttr
                                );
                                if (!attr) return null;
                                return (
                                    <>
                                        <div className="text-gray-300 font-medium">
                                            {attr.name}
                                        </div>
                                        <div className="text-gray-500">
                                            Present: {attr.presentCount} | Null:{" "}
                                            {attr.nullCount} | Empty:{" "}
                                            {attr.emptyCount} | Missing:{" "}
                                            {attr.missingCount}
                                        </div>
                                        <div className="text-gray-500">
                                            Types:{" "}
                                            {attr.types
                                                .map(
                                                    (t) =>
                                                        `${t.type}(${t.count})`
                                                )
                                                .join(", ")}
                                        </div>
                                        {attr.sampleValues.length > 0 && (
                                            <div className="text-gray-400 font-mono">
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
                <div className="text-xs text-gray-600 italic">
                    Select an index and click Scan to discover attribute types,
                    fill rates, and cardinality.
                </div>
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
