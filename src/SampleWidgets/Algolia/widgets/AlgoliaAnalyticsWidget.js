/**
 * AlgoliaAnalyticsWidget
 *
 * View search analytics and monitoring data: top searches, no-results queries,
 * click positions, geographic distribution, and top filters.
 * Requires an Algolia credential provider to be configured.
 *
 * @package Algolia
 */
import { useState, useEffect, useContext, useCallback } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useProviderClient,
    DashboardContext,
} from "@trops/dash-core";

function formatDate(date) {
    return date.toISOString().split("T")[0];
}

const TABS = [
    { key: "topSearches", label: "Top Searches" },
    { key: "noResults", label: "No Results" },
    { key: "clickPositions", label: "Click Positions" },
    { key: "countries", label: "Countries" },
    { key: "filters", label: "Top Filters" },
];

function AlgoliaAnalyticsContent({ id, title, defaultIndex, defaultDays = 7 }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);

    const { widgetApi } = useContext(DashboardContext);

    const [indices, setIndices] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(defaultIndex || "");
    const [activeTab, setActiveTab] = useState("topSearches");
    const [loading, setLoading] = useState(false);
    const [indicesLoading, setIndicesLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    // Date range
    const [endDate, setEndDate] = useState(formatDate(new Date()));
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - defaultDays);
        return formatDate(d);
    });

    // Analytics data
    const [summary, setSummary] = useState(null);
    const [topSearches, setTopSearches] = useState([]);
    const [noResultsSearches, setNoResultsSearches] = useState([]);
    const [clickPositions, setClickPositions] = useState([]);
    const [topCountries, setTopCountries] = useState([]);
    const [topFilters, setTopFilters] = useState([]);

    // Load indices via event-based IPC (same pattern as AlgoliaIndexDashboardWidget)
    useEffect(() => {
        if (!pc?.providerHash) return;

        setIndicesLoading(true);

        const handleComplete = (_event, data) => {
            const items = Array.isArray(data) ? data : [];
            setIndices(items);
            if (!selectedIndex && items.length > 0) {
                const firstName = items[0]?.name || items[0];
                setSelectedIndex(firstName);
            }
            setIndicesLoading(false);
        };

        const handleError = (_event, data) => {
            setErrorMsg(data?.error || "Failed to load indices");
            setIndicesLoading(false);
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

    const fetchAnalytics = useCallback(
        async (forceRefresh = false) => {
            if (!pc?.providerHash || !selectedIndex) return;
            setLoading(true);
            setErrorMsg(null);

            console.log("[AlgoliaAnalytics] Fetching", {
                selectedIndex,
                providerName: pc.providerName,
                startDate,
                endDate,
            });

            const fetchEndpoint = (endpoint) =>
                window.mainApi.algolia.getAnalyticsForQuery({
                    ...pc,
                    indexName: selectedIndex,
                    query: { endpoint, startDate, endDate },
                    cache: 120000,
                    forceRefresh,
                });

            try {
                const results = await Promise.allSettled([
                    fetchEndpoint("searches/count"),
                    fetchEndpoint("users/count"),
                    fetchEndpoint("searches/noResultRate"),
                    fetchEndpoint("searches/noClickRate"),
                    fetchEndpoint("searches"),
                    fetchEndpoint("searches/noResults"),
                    fetchEndpoint("clicks/positions"),
                    fetchEndpoint("countries"),
                    fetchEndpoint("filters"),
                ]);

                console.log(
                    "[AlgoliaAnalytics] Results:",
                    results.map((r) =>
                        r.status === "fulfilled"
                            ? r.value?.error
                                ? `Error: ${r.value.message}`
                                : "OK"
                            : `Rejected: ${r.reason}`
                    )
                );

                const errors = [];
                const parse = (r, label) => {
                    if (r.status !== "fulfilled") {
                        errors.push(`${label}: ${r.reason}`);
                        return null;
                    }
                    const val = r.value;
                    if (val?.error) {
                        errors.push(
                            `${label}: ${
                                val.message || val.status || "Unknown error"
                            }`
                        );
                        return null;
                    }
                    return val;
                };

                const searchCount = parse(results[0], "Search count");
                const userCount = parse(results[1], "User count");
                const noResultsRate = parse(results[2], "No results rate");
                const noClickRate = parse(results[3], "No click rate");

                setSummary({
                    searches: searchCount?.count ?? searchCount,
                    users: userCount?.count ?? userCount,
                    noResultsRate: noResultsRate?.rate ?? noResultsRate,
                    noClickRate: noClickRate?.rate ?? noClickRate,
                });

                const topSearchData = parse(results[4], "Top searches");
                setTopSearches(
                    Array.isArray(topSearchData)
                        ? topSearchData
                        : topSearchData?.searches || []
                );

                const noResData = parse(results[5], "No results");
                setNoResultsSearches(
                    Array.isArray(noResData)
                        ? noResData
                        : noResData?.searches || []
                );

                const clickData = parse(results[6], "Click positions");
                setClickPositions(
                    Array.isArray(clickData)
                        ? clickData
                        : clickData?.clicks || clickData?.positions || []
                );

                const countryData = parse(results[7], "Countries");
                setTopCountries(
                    Array.isArray(countryData)
                        ? countryData
                        : countryData?.countries || []
                );

                const filterData = parse(results[8], "Filters");
                setTopFilters(
                    Array.isArray(filterData)
                        ? filterData
                        : filterData?.filters || []
                );

                if (errors.length > 0) {
                    setErrorMsg(errors[0]);
                }
            } catch (err) {
                setErrorMsg(err.message);
            } finally {
                setLoading(false);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            pc?.providerHash,
            pc?.providerName,
            pc?.dashboardAppId,
            selectedIndex,
            startDate,
            endDate,
        ]
    );

    useEffect(() => {
        if (selectedIndex && pc?.providerHash) {
            fetchAnalytics();
        }
    }, [selectedIndex, pc?.providerHash]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleIndexChange = (indexName) => {
        setSelectedIndex(indexName);
        if (widgetApi) {
            widgetApi.publishEvent(
                `AlgoliaAnalyticsWidget[${id}].algolia-index-selected`,
                { indexName }
            );
        }
    };

    const formatRate = (rate) => {
        if (rate == null) return "\u2014";
        const num = typeof rate === "number" ? rate : parseFloat(rate);
        if (isNaN(num)) return "\u2014";
        return `${(num * 100).toFixed(1)}%`;
    };

    const formatNumber = (n) => {
        if (n == null) return "\u2014";
        const num = typeof n === "number" ? n : parseInt(n, 10);
        if (isNaN(num)) return "\u2014";
        return num.toLocaleString();
    };

    if (!hasCredentials) {
        return (
            <div className="flex flex-col gap-3 h-full text-sm">
                <SubHeading2 title={title} padding={false} />
                <div className="p-3 bg-amber-900/30 border border-amber-700 rounded text-amber-300 text-xs">
                    No Algolia credential provider configured. Add an Algolia
                    provider with your App ID and API Key to use analytics.
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} padding={false} />

            {errorMsg && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {errorMsg}
                </div>
            )}

            {/* Index Selector + Date Range */}
            <div className="space-y-2">
                <div className="flex gap-2">
                    <select
                        value={selectedIndex}
                        onChange={(e) => handleIndexChange(e.target.value)}
                        disabled={indicesLoading}
                        className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    >
                        <option value="">
                            {indicesLoading
                                ? "Loading indices..."
                                : "Select an index"}
                        </option>
                        {indices.map((idx, i) => {
                            const name = idx?.name || idx;
                            return (
                                <option key={name + i} value={name}>
                                    {name}
                                </option>
                            );
                        })}
                    </select>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <label className="text-gray-400">From</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="px-1.5 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                    />
                    <label className="text-gray-400">To</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="px-1.5 py-0.5 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                        onClick={() => fetchAnalytics(true)}
                        disabled={loading || !selectedIndex}
                        className="px-2 py-0.5 text-xs rounded bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        {loading ? "..." : "Refresh"}
                    </button>
                </div>
            </div>

            {/* Summary Stats */}
            {summary && (
                <div className="grid grid-cols-4 gap-2">
                    <div className="bg-white/5 rounded p-2 text-center">
                        <div className="text-lg font-semibold text-indigo-300">
                            {formatNumber(summary.searches)}
                        </div>
                        <div className="text-[10px] text-gray-500">
                            Searches
                        </div>
                    </div>
                    <div className="bg-white/5 rounded p-2 text-center">
                        <div className="text-lg font-semibold text-indigo-300">
                            {formatNumber(summary.users)}
                        </div>
                        <div className="text-[10px] text-gray-500">Users</div>
                    </div>
                    <div className="bg-white/5 rounded p-2 text-center">
                        <div className="text-lg font-semibold text-amber-300">
                            {formatRate(summary.noResultsRate)}
                        </div>
                        <div className="text-[10px] text-gray-500">
                            No Results
                        </div>
                    </div>
                    <div className="bg-white/5 rounded p-2 text-center">
                        <div className="text-lg font-semibold text-amber-300">
                            {formatRate(summary.noClickRate)}
                        </div>
                        <div className="text-[10px] text-gray-500">
                            No Clicks
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-700 pb-0">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-2 py-1 text-xs rounded-t transition-colors ${
                            activeTab === tab.key
                                ? "bg-indigo-900/50 text-indigo-300 border-b-2 border-indigo-500"
                                : "text-gray-500 hover:text-gray-300"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto max-h-[50vh]">
                {loading && (
                    <div className="text-xs text-gray-500 italic p-2">
                        Loading analytics...
                    </div>
                )}

                {!loading && activeTab === "topSearches" && (
                    <div className="space-y-1">
                        {topSearches.length === 0 ? (
                            <div className="text-xs text-gray-600 italic p-2">
                                No data available.
                            </div>
                        ) : (
                            topSearches.map((item, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between px-2 py-1 bg-white/5 rounded text-xs"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-600 font-mono w-5 text-right">
                                            {i + 1}
                                        </span>
                                        <span className="text-gray-200">
                                            {item.search ||
                                                item.query ||
                                                JSON.stringify(item)}
                                        </span>
                                    </div>
                                    <span className="text-indigo-400 font-mono">
                                        {(
                                            item.count ??
                                            item.nbSearches ??
                                            ""
                                        ).toLocaleString()}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {!loading && activeTab === "noResults" && (
                    <div className="space-y-1">
                        {noResultsSearches.length === 0 ? (
                            <div className="text-xs text-gray-600 italic p-2">
                                No data available.
                            </div>
                        ) : (
                            noResultsSearches.map((item, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between px-2 py-1 bg-white/5 rounded text-xs"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-600 font-mono w-5 text-right">
                                            {i + 1}
                                        </span>
                                        <span className="text-gray-200">
                                            {item.search ||
                                                item.query ||
                                                JSON.stringify(item)}
                                        </span>
                                    </div>
                                    <span className="text-amber-400 font-mono">
                                        {(
                                            item.count ??
                                            item.nbSearches ??
                                            ""
                                        ).toLocaleString()}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {!loading && activeTab === "clickPositions" && (
                    <div className="space-y-1">
                        {clickPositions.length === 0 ? (
                            <div className="text-xs text-gray-600 italic p-2">
                                No data available.
                            </div>
                        ) : (
                            clickPositions.map((item, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between px-2 py-1 bg-white/5 rounded text-xs"
                                >
                                    <span className="text-gray-300">
                                        Position{" "}
                                        {item.position ??
                                            item.clickPosition ??
                                            i + 1}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <span className="text-indigo-400 font-mono">
                                            {(
                                                item.clickCount ??
                                                item.count ??
                                                ""
                                            ).toLocaleString()}{" "}
                                            clicks
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {!loading && activeTab === "countries" && (
                    <div className="space-y-1">
                        {topCountries.length === 0 ? (
                            <div className="text-xs text-gray-600 italic p-2">
                                No data available.
                            </div>
                        ) : (
                            topCountries.map((item, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between px-2 py-1 bg-white/5 rounded text-xs"
                                >
                                    <span className="text-gray-200">
                                        {item.country ||
                                            item.code ||
                                            JSON.stringify(item)}
                                    </span>
                                    <span className="text-indigo-400 font-mono">
                                        {(
                                            item.count ??
                                            item.nbSearches ??
                                            ""
                                        ).toLocaleString()}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {!loading && activeTab === "filters" && (
                    <div className="space-y-1">
                        {topFilters.length === 0 ? (
                            <div className="text-xs text-gray-600 italic p-2">
                                No data available.
                            </div>
                        ) : (
                            topFilters.map((item, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between px-2 py-1 bg-white/5 rounded text-xs"
                                >
                                    <span className="text-gray-200 font-mono">
                                        {item.attribute ||
                                            item.filter ||
                                            item.value ||
                                            JSON.stringify(item)}
                                    </span>
                                    <span className="text-indigo-400 font-mono">
                                        {(
                                            item.count ??
                                            item.nbSearches ??
                                            ""
                                        ).toLocaleString()}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export const AlgoliaAnalyticsWidget = ({
    title = "Algolia Analytics",
    defaultIndex = "",
    defaultDays = 7,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaAnalyticsContent
                    id={props.id}
                    title={title}
                    defaultIndex={defaultIndex}
                    defaultDays={defaultDays}
                />
            </Panel>
        </Widget>
    );
};
