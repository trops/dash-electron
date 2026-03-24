/**
 * AlgoliaSearchQueryAnalytics
 *
 * Listens for queryChanged events from AlgoliaSearchPage and displays
 * historical analytics for the active search query via the Algolia
 * Analytics REST API.
 *
 * Fetches top searches from GET /2/searches?clickAnalytics=true and
 * filters client-side for queries containing the user's search term.
 *
 * @package Algolia Search
 */
import { useState, useEffect, useCallback } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import {
    Widget,
    useWidgetEvents,
    useWidgetProviders,
    useProviderClient,
} from "@trops/dash-core";

function formatRate(rate) {
    if (rate == null) return "\u2014";
    const num = typeof rate === "number" ? rate : parseFloat(rate);
    if (isNaN(num)) return "\u2014";
    return `${(num * 100).toFixed(1)}%`;
}

function formatNumber(n) {
    if (n == null) return "\u2014";
    const num = typeof n === "number" ? n : parseInt(n, 10);
    if (isNaN(num)) return "\u2014";
    return num.toLocaleString();
}

function AnalyticsContent({ title, days = 7 }) {
    const { listen, listeners, publishEvent } = useWidgetEvents();
    const { hasProvider, getProvider } = useWidgetProviders();
    const hasCredentials = hasProvider("algolia-search");
    const provider = hasCredentials ? getProvider("algolia-search") : null;
    const pc = useProviderClient(provider);

    const [query, setQuery] = useState(null);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [allSearches, setAllSearches] = useState(null);

    // Listen for queryChanged events
    listen(listeners, {
        onQueryChanged: (data) => {
            const q = data?.message?.query ?? "";
            setQuery(q);
        },
    });

    // Fetch top searches from Algolia (single endpoint)
    const fetchTopSearches = useCallback(
        async () => {
            if (!pc?.providerHash) return;

            const indexName = provider?.credentials?.indexName;
            if (!indexName) return;

            setLoading(true);
            setErrorMsg(null);

            const today = new Date();
            const startDay = new Date();
            startDay.setDate(startDay.getDate() - days);

            const startDate = startDay.toISOString().split("T")[0];
            const endDate = today.toISOString().split("T")[0];

            try {
                const result =
                    await window.mainApi.algolia.getAnalyticsForQuery({
                        ...pc,
                        indexName,
                        query: {
                            endpoint: "searches",
                            startDate,
                            endDate,
                            clickAnalytics: true,
                            limit: 1000,
                        },
                        cache: 120000,
                    });

                if (result?.error) {
                    setErrorMsg(result.message || `Error ${result.status}`);
                    setAllSearches([]);
                } else {
                    const searches = Array.isArray(result)
                        ? result
                        : result?.searches || [];
                    setAllSearches(searches);
                }
            } catch (err) {
                setErrorMsg(err.message);
                setAllSearches([]);
            } finally {
                setLoading(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            pc?.providerHash,
            pc?.providerName,
            pc?.dashboardAppId,
            provider?.credentials?.indexName,
            days,
        ]
    );

    // Fetch top searches on mount and when provider/days change
    useEffect(() => {
        if (pc?.providerHash && provider?.credentials?.indexName) {
            fetchTopSearches();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchTopSearches]);

    // Filter searches client-side based on query
    const filteredSearches = (() => {
        if (!allSearches) return [];
        if (!query) return allSearches.slice(0, 20);
        const lowerQuery = query.toLowerCase();
        return allSearches.filter(
            (item) =>
                item.search && item.search.toLowerCase().includes(lowerQuery)
        );
    })();

    // Compute summary stats from filtered results
    const summary = (() => {
        if (filteredSearches.length === 0) return null;
        const totalSearches = filteredSearches.reduce(
            (sum, item) => sum + (item.count || 0),
            0
        );
        const avgCtr =
            filteredSearches.reduce(
                (sum, item) => sum + (item.clickThroughRate || 0),
                0
            ) / filteredSearches.length;
        const avgClickPos =
            filteredSearches.reduce(
                (sum, item) => sum + (item.averageClickPosition || 0),
                0
            ) / filteredSearches.length;
        return { totalSearches, avgCtr, avgClickPos };
    })();

    if (!hasCredentials) {
        return (
            <div className="flex flex-col gap-3 h-full text-sm">
                <SubHeading2 title={title} padding={false} />
                <div className="p-3 bg-amber-900/30 border border-amber-700 rounded text-amber-300 text-xs">
                    No Algolia Search credential provider configured. Add an
                    algolia-search provider to use query analytics.
                </div>
            </div>
        );
    }

    if (!allSearches && !loading) {
        return (
            <div className="flex flex-col gap-3 h-full text-sm">
                <SubHeading2 title={title} padding={false} />
                <div className="flex items-center justify-center flex-1">
                    <div className="text-gray-500 text-xs italic">
                        Loading top searches...
                    </div>
                </div>
            </div>
        );
    }

    const hasQuery = query && query.length > 0;

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} padding={false} />

            {hasQuery && (
                <div className="text-xs text-gray-400">
                    Filtering for:{" "}
                    <span className="text-gray-200 font-medium">
                        &ldquo;{query}&rdquo;
                    </span>
                    <span className="text-gray-500 ml-1">
                        ({filteredSearches.length} match
                        {filteredSearches.length !== 1 ? "es" : ""})
                    </span>
                </div>
            )}

            {!hasQuery && (
                <div className="text-xs text-gray-400">
                    Top searches &mdash; last {days} days
                </div>
            )}

            {errorMsg && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {errorMsg}
                </div>
            )}

            {loading && (
                <div className="text-xs text-gray-500 italic">
                    Loading analytics...
                </div>
            )}

            {!loading && summary && (
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white/5 rounded p-2 text-center">
                        <div className="text-lg font-semibold text-indigo-300">
                            {formatNumber(summary.totalSearches)}
                        </div>
                        <div className="text-[10px] text-gray-500">
                            Total Searches
                        </div>
                    </div>
                    <div className="bg-white/5 rounded p-2 text-center">
                        <div className="text-lg font-semibold text-emerald-300">
                            {formatRate(summary.avgCtr)}
                        </div>
                        <div className="text-[10px] text-gray-500">Avg CTR</div>
                    </div>
                    <div className="bg-white/5 rounded p-2 text-center">
                        <div className="text-lg font-semibold text-sky-300">
                            {summary.avgClickPos > 0
                                ? summary.avgClickPos.toFixed(1)
                                : "\u2014"}
                        </div>
                        <div className="text-[10px] text-gray-500">
                            Avg Click Pos
                        </div>
                    </div>
                </div>
            )}

            {!loading && filteredSearches.length > 0 && (
                <div className="flex flex-col gap-1">
                    {filteredSearches.map((item, i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between px-2 py-1 bg-white/5 rounded text-xs cursor-pointer hover:bg-white/10 transition-colors"
                            onClick={() =>
                                publishEvent("searchQuerySelected", {
                                    query: item.search,
                                })
                            }
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-gray-600 font-mono w-4 text-right flex-shrink-0">
                                    {i + 1}
                                </span>
                                <span className="text-gray-200 truncate">
                                    {item.search}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                                <span
                                    className="text-indigo-400 font-mono"
                                    title="Search count"
                                >
                                    {formatNumber(item.count)}
                                </span>
                                <span
                                    className="text-emerald-400 font-mono w-12 text-right"
                                    title="Click-through rate"
                                >
                                    {formatRate(item.clickThroughRate)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!loading && filteredSearches.length === 0 && hasQuery && (
                <div className="flex items-center justify-center flex-1">
                    <div className="text-gray-500 text-xs italic">
                        No searches match &ldquo;{query}&rdquo;
                    </div>
                </div>
            )}
        </div>
    );
}

export const AlgoliaSearchQueryAnalytics = ({
    title = "Query Analytics",
    days = 7,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AnalyticsContent title={title} days={days} />
            </Panel>
        </Widget>
    );
};
