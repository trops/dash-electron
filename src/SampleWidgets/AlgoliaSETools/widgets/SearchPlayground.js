/**
 * SearchPlayground
 *
 * Minimal search UI with toggles for every relevance lever.
 * Demo tool for showing customers the impact of typo tolerance,
 * distinct, highlighting, and search parameters in real-time.
 *
 * @package AlgoliaSETools
 */
import { useState, useEffect, useCallback } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useWidgetEvents,
    useProviderClient,
} from "@trops/dash-core";

function SearchPlaygroundContent({ title }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const { listen, listeners } = useWidgetEvents();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);

    const [indices, setIndices] = useState([]);
    const [loadingIndices, setLoadingIndices] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState("");
    const [query, setQuery] = useState("");
    const [hits, setHits] = useState([]);
    const [nbHits, setNbHits] = useState(0);
    const [queryTime, setQueryTime] = useState(null);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState(null);

    // Search parameter toggles
    const [typoTolerance, setTypoTolerance] = useState("true");
    const [hitsPerPage, setHitsPerPage] = useState(10);
    const [distinct, setDistinct] = useState(0);
    const [filters, setFilters] = useState("");
    const [showHighlights, setShowHighlights] = useState(true);

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
                    if (payload.name) setSelectedIndex(payload.name);
                },
            });
        }
    }, [listeners, listen]);

    const handleSearch = useCallback(async () => {
        if (!pc?.providerHash || !selectedIndex || !query.trim()) return;
        setSearching(true);
        setError(null);
        try {
            const searchParams = {
                ...pc,
                indexName: selectedIndex,
                query: query.trim(),
                page: 0,
                hitsPerPage,
                typoTolerance:
                    typoTolerance === "true"
                        ? true
                        : typoTolerance === "false"
                        ? false
                        : typoTolerance,
            };
            if (distinct > 0) searchParams.distinct = distinct;
            if (filters.trim()) searchParams.filters = filters.trim();

            const result = await window.mainApi.algolia.search(searchParams);
            if (result?.error) {
                setError(result.message || "Search failed");
                return;
            }
            setHits(result?.hits || []);
            setNbHits(result?.nbHits || 0);
            setQueryTime(result?.processingTimeMS ?? null);
        } catch (err) {
            setError(err.message || "Search failed");
        } finally {
            setSearching(false);
        }
    }, [
        pc,
        selectedIndex,
        query,
        hitsPerPage,
        typoTolerance,
        distinct,
        filters,
    ]);

    // Extract highlighted value from _highlightResult
    const getHighlighted = (hit, field) => {
        if (!showHighlights) return null;
        const hr = hit._highlightResult?.[field];
        if (!hr) return null;
        return hr.value || null;
    };

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

            {!hasCredentials && (
                <div className="p-2 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-300 text-xs">
                    Algolia provider not configured.
                </div>
            )}

            {hasCredentials && (
                <>
                    {/* Index + Query */}
                    <div className="space-y-2">
                        <select
                            value={selectedIndex}
                            onChange={(e) => setSelectedIndex(e.target.value)}
                            className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                        >
                            <option value="">
                                {loadingIndices ? "Loading..." : "Select index"}
                            </option>
                            {indices.map((idx) => (
                                <option key={idx.name} value={idx.name}>
                                    {idx.name}
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
                                disabled={
                                    !selectedIndex || !query.trim() || searching
                                }
                                className="px-3 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white"
                            >
                                {searching ? "..." : "Search"}
                            </button>
                        </div>
                    </div>

                    {/* Parameter Toggles */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <label className="text-[10px] text-gray-500 block mb-0.5">
                                Typo Tolerance
                            </label>
                            <select
                                value={typoTolerance}
                                onChange={(e) =>
                                    setTypoTolerance(e.target.value)
                                }
                                className="w-full px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300"
                            >
                                <option value="true">Enabled</option>
                                <option value="false">Disabled</option>
                                <option value="min">Min (1 typo)</option>
                                <option value="strict">Strict</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 block mb-0.5">
                                Hits / Page
                            </label>
                            <select
                                value={hitsPerPage}
                                onChange={(e) =>
                                    setHitsPerPage(Number(e.target.value))
                                }
                                className="w-full px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 block mb-0.5">
                                Distinct
                            </label>
                            <select
                                value={distinct}
                                onChange={(e) =>
                                    setDistinct(Number(e.target.value))
                                }
                                className="w-full px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300"
                            >
                                <option value={0}>Off</option>
                                <option value={1}>1 per group</option>
                                <option value={2}>2 per group</option>
                                <option value={3}>3 per group</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showHighlights}
                                    onChange={(e) =>
                                        setShowHighlights(e.target.checked)
                                    }
                                    className="rounded"
                                />
                                <span className="text-[10px] text-gray-500">
                                    Show highlights
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Filters */}
                    <div>
                        <label className="text-[10px] text-gray-500 block mb-0.5">
                            Filters (Algolia filter syntax)
                        </label>
                        <input
                            type="text"
                            value={filters}
                            onChange={(e) => setFilters(e.target.value)}
                            placeholder='e.g., brand:"Nike" AND price < 100'
                            className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-200 placeholder-gray-600 font-mono focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </>
            )}

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {/* Stats */}
            {hits.length > 0 && (
                <div className="text-[10px] text-gray-500">
                    {nbHits.toLocaleString()} results
                    {queryTime != null && <> in {queryTime}ms</>}
                </div>
            )}

            {/* Results */}
            {hits.length > 0 && (
                <div className="space-y-1">
                    {hits.map((hit, idx) => {
                        const titleField =
                            hit.title || hit.name || hit.label || hit.objectID;
                        const highlightedTitle = getHighlighted(
                            hit,
                            hit.title ? "title" : hit.name ? "name" : "label"
                        );

                        return (
                            <div
                                key={hit.objectID || idx}
                                className="px-2 py-1.5 bg-gray-800/30 border border-gray-700/50 rounded text-xs"
                            >
                                <div className="flex items-start gap-2">
                                    <span className="text-gray-600 font-mono shrink-0">
                                        #{idx + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        {highlightedTitle ? (
                                            <div
                                                className="text-gray-200 truncate"
                                                dangerouslySetInnerHTML={{
                                                    __html: highlightedTitle,
                                                }}
                                            />
                                        ) : (
                                            <div className="text-gray-200 truncate">
                                                {titleField}
                                            </div>
                                        )}
                                        <div className="text-[10px] text-gray-600 font-mono truncate">
                                            {hit.objectID}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export const SearchPlayground = ({ title = "Search Playground", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <SearchPlaygroundContent title={title} />
            </Panel>
        </Widget>
    );
};
