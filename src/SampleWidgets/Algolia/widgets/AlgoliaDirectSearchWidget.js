/**
 * AlgoliaDirectSearchWidget
 *
 * Search an Algolia index directly via the IPC API (window.mainApi.algolia.search).
 * Select index, type query, get paginated results with expandable record JSON.
 * Requires an Algolia credential provider (appId + apiKey).
 *
 * @package Algolia
 */
import { useState, useEffect, useCallback } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useProviderClient,
    useWidgetEvents,
} from "@trops/dash-core";

function AlgoliaDirectSearchContent({ title, defaultIndex, hitsPerPage = 10 }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const [indices, setIndices] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(defaultIndex || "");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState(null);
    const [expandedRecord, setExpandedRecord] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingIndices, setLoadingIndices] = useState(false);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(0);

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
                    if (data?.length > 0 && !selectedIndex) {
                        if (defaultIndex) {
                            const found = data.find(
                                (idx) => idx.name === defaultIndex
                            );
                            if (found) {
                                setSelectedIndex(defaultIndex);
                                return;
                            }
                        }
                        setSelectedIndex(data[0].name);
                    }
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

    const handleSearch = useCallback(
        async (page = 0) => {
            if (!selectedIndex || !pc?.providerHash) return;
            setLoading(true);
            setError(null);
            setCurrentPage(page);
            try {
                const result = await window.mainApi.algolia.search({
                    ...pc,
                    indexName: selectedIndex,
                    query,
                    options: { page, hitsPerPage },
                });
                if (result?.error) {
                    setError(result.message || "Search failed");
                } else {
                    setResults(result);
                }
            } catch (err) {
                setError(err.message || "Search failed");
            } finally {
                setLoading(false);
            }
        },
        [selectedIndex, query, hitsPerPage, pc?.providerHash] // eslint-disable-line react-hooks/exhaustive-deps
    );

    // Search as you type — debounce to avoid flooding API
    useEffect(() => {
        if (!selectedIndex || !pc?.providerHash) return;
        if (!query) {
            setResults(null);
            return;
        }
        const timer = setTimeout(() => {
            handleSearch(0);
        }, 300);
        return () => clearTimeout(timer);
    }, [query, selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleIndexChange = (indexName) => {
        setSelectedIndex(indexName);
        setResults(null);
        setExpandedRecord(null);
        setCurrentPage(0);
    };

    const hits = results?.hits || [];
    const nbHits = results?.nbHits ?? hits.length;
    const nbPages = results?.nbPages ?? 1;

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
                    onChange={(e) => handleIndexChange(e.target.value)}
                    disabled={loadingIndices || indices.length === 0}
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-teal-500 disabled:opacity-50"
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
                            {idx.name} ({(idx.entries || 0).toLocaleString()})
                        </option>
                    ))}
                </select>
            </div>

            {/* Search Bar */}
            <div className="space-y-1">
                <SubHeading3 title="Search" padding={false} />
                <div className="relative">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={
                            selectedIndex
                                ? `Search ${selectedIndex}...`
                                : "Select an index first"
                        }
                        disabled={!selectedIndex}
                        className={`w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-teal-500 disabled:opacity-50 transition-opacity ${
                            loading ? "opacity-70" : ""
                        }`}
                    />
                    {loading && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-teal-400 animate-pulse">
                            searching...
                        </span>
                    )}
                </div>
            </div>

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {/* Results */}
            {results && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>
                            {nbHits.toLocaleString()} result
                            {nbHits !== 1 ? "s" : ""}
                            {results.processingTimeMS != null && (
                                <span className="text-gray-600 ml-1">
                                    ({results.processingTimeMS}ms)
                                </span>
                            )}
                        </span>
                        {nbPages > 1 && (
                            <span>
                                Page {currentPage + 1} of {nbPages}
                            </span>
                        )}
                    </div>

                    <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                        {hits.length === 0 ? (
                            <div className="text-xs text-gray-600 italic p-2">
                                No results found.
                            </div>
                        ) : (
                            hits.map((hit, i) => {
                                const oid = hit.objectID || hit.id || i;
                                const isExpanded = expandedRecord === oid;
                                const displayTitle =
                                    hit.title ||
                                    hit.name ||
                                    hit.label ||
                                    hit.objectID ||
                                    `Record ${i + 1}`;
                                const displaySubtitle =
                                    hit.description ||
                                    hit.subtitle ||
                                    hit.content?.substring(0, 100) ||
                                    "";

                                return (
                                    <div
                                        key={oid + "-" + i}
                                        className="bg-white/5 rounded overflow-hidden"
                                    >
                                        <button
                                            onClick={() => {
                                                setExpandedRecord(
                                                    isExpanded ? null : oid
                                                );
                                            }}
                                            className="w-full text-left px-2 py-1.5 text-xs hover:bg-white/5 transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-teal-400 font-mono text-[10px] shrink-0">
                                                    {oid}
                                                </span>
                                                <span className="text-gray-200 truncate">
                                                    {displayTitle}
                                                </span>
                                            </div>
                                            {displaySubtitle && (
                                                <div className="text-gray-500 truncate mt-0.5">
                                                    {displaySubtitle}
                                                </div>
                                            )}
                                        </button>
                                        {isExpanded && (
                                            <div className="px-2 pb-2 border-t border-gray-700">
                                                <pre className="text-[10px] text-gray-400 whitespace-pre-wrap overflow-auto max-h-48 mt-1">
                                                    {JSON.stringify(
                                                        hit,
                                                        null,
                                                        2
                                                    )}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Pagination */}
                    {nbPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-1">
                            <button
                                onClick={() => handleSearch(currentPage - 1)}
                                disabled={currentPage === 0 || loading}
                                className="px-2 py-0.5 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white"
                            >
                                Prev
                            </button>
                            <span className="text-xs text-gray-500">
                                {currentPage + 1} / {nbPages}
                            </span>
                            <button
                                onClick={() => handleSearch(currentPage + 1)}
                                disabled={currentPage >= nbPages - 1 || loading}
                                className="px-2 py-0.5 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-white"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export const AlgoliaDirectSearchWidget = ({
    title = "Algolia Direct Search",
    defaultIndex = "",
    hitsPerPage = 10,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaDirectSearchContent
                    title={title}
                    defaultIndex={defaultIndex}
                    hitsPerPage={hitsPerPage}
                />
            </Panel>
        </Widget>
    );
};
