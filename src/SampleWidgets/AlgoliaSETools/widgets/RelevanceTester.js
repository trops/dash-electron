/**
 * RelevanceTester
 *
 * Run a search query against an Algolia index, see ranked results,
 * mark expected results, and get a relevance score. Core demo tool
 * for showing customers how relevance changes with config tweaks.
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
import { scoreRelevance } from "../utils/relevanceScorer";

const STATUS_STYLES = {
    perfect: {
        bg: "bg-green-900/30",
        border: "border-green-700",
        badge: "bg-green-600",
    },
    close: {
        bg: "bg-yellow-900/20",
        border: "border-yellow-700",
        badge: "bg-yellow-600",
    },
    displaced: {
        bg: "bg-red-900/20",
        border: "border-red-700",
        badge: "bg-red-600",
    },
    unexpected: {
        bg: "bg-gray-800/30",
        border: "border-gray-700",
        badge: "bg-gray-600",
    },
};

function RelevanceTesterContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);

    const [indices, setIndices] = useState([]);
    const [loadingIndices, setLoadingIndices] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState("");
    const [query, setQuery] = useState("");
    const [hits, setHits] = useState([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState(null);

    // Expected results tracking
    const [expectedIds, setExpectedIds] = useState([]);
    const [relevanceResult, setRelevanceResult] = useState(null);

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

    const handleSearch = useCallback(async () => {
        if (!pc?.providerHash || !selectedIndex) return;
        setSearching(true);
        setError(null);
        setRelevanceResult(null);
        try {
            const result = await window.mainApi.algolia.search({
                ...pc,
                indexName: selectedIndex,
                query: query.trim(),
                page: 0,
                hitsPerPage: 20,
            });
            if (result?.error) {
                setError(result.message || "Search failed");
                return;
            }
            setHits(result?.hits || []);
            // Re-score if we have expected results
            if (expectedIds.length > 0) {
                setRelevanceResult(
                    scoreRelevance(result?.hits || [], expectedIds)
                );
            }
        } catch (err) {
            setError(err.message || "Search failed");
        } finally {
            setSearching(false);
        }
    }, [pc, selectedIndex, query, expectedIds]);

    const toggleExpected = useCallback(
        (objectID) => {
            setExpectedIds((prev) => {
                const next = prev.includes(objectID)
                    ? prev.filter((id) => id !== objectID)
                    : [...prev, objectID];
                // Re-score
                if (hits.length > 0 && next.length > 0) {
                    setRelevanceResult(scoreRelevance(hits, next));
                } else {
                    setRelevanceResult(null);
                }
                return next;
            });
        },
        [hits]
    );

    const clearExpected = useCallback(() => {
        setExpectedIds([]);
        setRelevanceResult(null);
    }, []);

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
                <div className="space-y-2">
                    <select
                        value={selectedIndex}
                        onChange={(e) => setSelectedIndex(e.target.value)}
                        className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                    >
                        <option value="">
                            {loadingIndices ? "Loading..." : "Select an index"}
                        </option>
                        {indices.map((idx) => (
                            <option key={idx.name} value={idx.name}>
                                {idx.name} (
                                {(idx.entries || 0).toLocaleString()})
                            </option>
                        ))}
                    </select>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) =>
                                e.key === "Enter" && handleSearch()
                            }
                            placeholder="Search query..."
                            className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                        />
                        <button
                            onClick={handleSearch}
                            disabled={!selectedIndex || searching}
                            className="px-3 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                        >
                            {searching ? "..." : "Search"}
                        </button>
                    </div>
                </div>
            )}

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {/* Relevance Score */}
            {relevanceResult && (
                <div className="flex items-center gap-3 p-2 bg-gray-800/50 rounded text-xs">
                    <span
                        className={`text-lg font-bold ${
                            relevanceResult.metrics.precisionAtN >= 80
                                ? "text-green-400"
                                : relevanceResult.metrics.precisionAtN >= 50
                                ? "text-yellow-400"
                                : "text-red-400"
                        }`}
                    >
                        {relevanceResult.metrics.precisionAtN}%
                    </span>
                    <div className="flex-1 text-gray-400 space-y-0.5">
                        <div>
                            Precision@{relevanceResult.metrics.totalExpected}:{" "}
                            <span className="text-gray-300">
                                {relevanceResult.metrics.foundInTopN}/
                                {relevanceResult.metrics.totalExpected}
                            </span>
                        </div>
                        <div>
                            Recall: {relevanceResult.metrics.recall}% | MRR:{" "}
                            {relevanceResult.metrics.mrr}%
                            {relevanceResult.metrics.firstFoundAt && (
                                <>
                                    {" "}
                                    | First at #
                                    {relevanceResult.metrics.firstFoundAt}
                                </>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={clearExpected}
                        className="px-2 py-0.5 text-[10px] bg-gray-700 hover:bg-gray-600 rounded text-gray-400"
                    >
                        Clear
                    </button>
                </div>
            )}

            {/* Expected IDs indicator */}
            {expectedIds.length > 0 && !relevanceResult && (
                <div className="text-[10px] text-gray-500">
                    {expectedIds.length} expected result
                    {expectedIds.length !== 1 ? "s" : ""} marked. Run a search
                    to score.
                </div>
            )}

            {/* Results */}
            {hits.length > 0 && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wide">
                            Results ({hits.length})
                        </span>
                        <span className="text-[10px] text-gray-600">
                            Click star to mark as expected result
                        </span>
                    </div>
                    {hits.map((hit, idx) => {
                        const id = hit.objectID;
                        const isExpected = expectedIds.includes(id);
                        const detail = relevanceResult?.hitDetails?.[idx];
                        const style = detail
                            ? STATUS_STYLES[detail.status]
                            : STATUS_STYLES.unexpected;

                        return (
                            <div
                                key={id || idx}
                                className={`flex items-start gap-2 px-2 py-1.5 rounded border ${
                                    detail
                                        ? `${style.bg} ${style.border}`
                                        : isExpected
                                        ? "bg-blue-900/20 border-blue-700"
                                        : "bg-gray-800/30 border-gray-700/50"
                                }`}
                            >
                                {/* Position */}
                                <span className="text-gray-500 font-mono text-xs w-6 text-right shrink-0 mt-0.5">
                                    #{idx + 1}
                                </span>

                                {/* Star toggle */}
                                <button
                                    onClick={() => toggleExpected(id)}
                                    className={`shrink-0 mt-0.5 text-sm ${
                                        isExpected
                                            ? "text-yellow-400"
                                            : "text-gray-600 hover:text-yellow-400"
                                    }`}
                                    title={
                                        isExpected
                                            ? "Remove from expected"
                                            : "Mark as expected result"
                                    }
                                >
                                    {isExpected ? "\u2605" : "\u2606"}
                                </button>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs text-gray-300 truncate">
                                        {hit.title ||
                                            hit.name ||
                                            hit.label ||
                                            hit.objectID}
                                    </div>
                                    {(hit.description || hit.content) && (
                                        <div className="text-[10px] text-gray-500 truncate">
                                            {(
                                                hit.description ||
                                                hit.content ||
                                                ""
                                            ).slice(0, 120)}
                                        </div>
                                    )}
                                    <div className="text-[10px] text-gray-600 font-mono">
                                        {id}
                                    </div>
                                </div>

                                {/* Position delta badge */}
                                {detail && detail.isExpected && (
                                    <span
                                        className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] text-white ${style.badge}`}
                                    >
                                        {detail.status === "perfect"
                                            ? "exact"
                                            : detail.positionDelta > 0
                                            ? `+${detail.positionDelta}`
                                            : String(detail.positionDelta)}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {hits.length === 0 && !searching && !error && hasCredentials && (
                <div className="text-xs text-gray-600 italic">
                    Select an index, enter a query, and search. Star the results
                    you expect at the top to measure relevance quality.
                </div>
            )}
        </div>
    );
}

export const RelevanceTester = ({ title = "Relevance Tester", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <RelevanceTesterContent title={title} />
            </Panel>
        </Widget>
    );
};
