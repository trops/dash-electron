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
import { useState, useEffect, useCallback, useContext } from "react";
import {
    Panel,
    SubHeading2,
    AlertBanner,
    Caption2,
    ThemeContext,
    useStatusTokens,
    readableError,
} from "@trops/dash-react";
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
    const { currentTheme } = useContext(ThemeContext);
    const status = useStatusTokens();

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
                    setErrorMsg(readableError(result));
                    setAllSearches([]);
                } else {
                    const searches = Array.isArray(result)
                        ? result
                        : result?.searches || [];
                    setAllSearches(searches);
                }
            } catch (err) {
                setErrorMsg(readableError(err));
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

    // Theme tokens: rows/tiles sit one step above the Panel surface; the
    // count uses the secondary channel and CTR the tertiary channel.
    const rowClass = `${currentTheme?.["bg-primary-dark"] || ""} ${
        currentTheme?.["text-primary-medium"] || ""
    }`;
    const bodyText = currentTheme?.["text-primary-medium"] || "";
    const accentText = currentTheme?.["text-secondary-medium"] || "";
    const accentText2 = currentTheme?.["text-tertiary-medium"] || "";
    const rowHover = currentTheme?.["hover-bg-primary-dark"] || "";

    if (!hasCredentials) {
        return (
            <div className="flex flex-col gap-3 h-full text-sm">
                <SubHeading2 title={title} padding={false} />
                <AlertBanner
                    variant="warning"
                    size="compact"
                    message="No Algolia Search credential provider configured. Add an algolia-search provider to use query analytics."
                />
            </div>
        );
    }

    if (!allSearches && !loading) {
        return (
            <div className="flex flex-col gap-3 h-full text-sm">
                <SubHeading2 title={title} padding={false} />
                <div className="flex items-center justify-center flex-1">
                    <Caption2 block className="italic">
                        Loading top searches...
                    </Caption2>
                </div>
            </div>
        );
    }

    const hasQuery = query && query.length > 0;

    const summaryTiles = summary
        ? [
              {
                  label: "Total Searches",
                  value: formatNumber(summary.totalSearches),
                  className: accentText,
              },
              {
                  label: "Avg CTR",
                  value: formatRate(summary.avgCtr),
                  className: accentText2,
              },
              {
                  label: "Avg Click Pos",
                  value:
                      summary.avgClickPos > 0
                          ? summary.avgClickPos.toFixed(1)
                          : "\u2014",
                  className: status.info.icon,
              },
          ]
        : [];

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} padding={false} />

            {hasQuery && (
                <Caption2 block>
                    Filtering for:{" "}
                    <span className={`font-medium ${bodyText}`}>
                        &ldquo;{query}&rdquo;
                    </span>
                    <span className="ml-1">
                        ({filteredSearches.length} match
                        {filteredSearches.length !== 1 ? "es" : ""})
                    </span>
                </Caption2>
            )}

            {!hasQuery && (
                <Caption2 block>Top searches &mdash; last {days} days</Caption2>
            )}

            {errorMsg && (
                <AlertBanner
                    variant="error"
                    size="compact"
                    message={errorMsg}
                />
            )}

            {loading && (
                <Caption2 block className="italic">
                    Loading analytics...
                </Caption2>
            )}

            {!loading && summary && (
                <div className="grid grid-cols-3 gap-2">
                    {summaryTiles.map((tile) => (
                        <div
                            key={tile.label}
                            className={`rounded p-2 text-center ${rowClass}`}
                        >
                            <div
                                className={`text-lg font-semibold ${tile.className}`}
                            >
                                {tile.value}
                            </div>
                            <Caption2 block>{tile.label}</Caption2>
                        </div>
                    ))}
                </div>
            )}

            {!loading && filteredSearches.length > 0 && (
                <div className="flex flex-col gap-1">
                    {filteredSearches.map((item, i) => (
                        <div
                            key={i}
                            className={`flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer transition-colors ${rowClass} ${rowHover}`}
                            onClick={() =>
                                publishEvent("searchQuerySelected", {
                                    query: item.search,
                                })
                            }
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <Caption2 className="font-mono w-4 text-right flex-shrink-0">
                                    {i + 1}
                                </Caption2>
                                <span className="truncate">{item.search}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                                <span
                                    className={`font-mono ${accentText}`}
                                    title="Search count"
                                >
                                    {formatNumber(item.count)}
                                </span>
                                <span
                                    className={`font-mono w-12 text-right ${accentText2}`}
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
                    <Caption2 block className="italic">
                        No searches match &ldquo;{query}&rdquo;
                    </Caption2>
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
