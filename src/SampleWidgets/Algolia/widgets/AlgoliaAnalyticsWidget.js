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
import {
    Panel,
    SubHeading2,
    Button2,
    AlertBanner,
    Caption2,
    EmptyState,
    InputText,
    SelectInput,
    Tabs,
    ThemeContext,
    useStatusTokens,
    readableError,
} from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useProviderClient,
    useWidgetEvents,
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
    const { listen, listeners } = useWidgetEvents();

    const { widgetApi } = useContext(DashboardContext);
    const { currentTheme } = useContext(ThemeContext);
    const status = useStatusTokens();

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

    // Load indices via invoke-based IPC
    useEffect(() => {
        if (!pc?.providerHash) return;
        let cancelled = false;
        setIndicesLoading(true);

        window.mainApi.algolia
            .listIndices({ ...pc, cache: true })
            .then((data) => {
                if (!cancelled) {
                    const items = Array.isArray(data) ? data : [];
                    setIndices(items);
                    if (!selectedIndex && items.length > 0) {
                        const firstName = items[0]?.name || items[0];
                        setSelectedIndex(firstName);
                    }
                    setIndicesLoading(false);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setErrorMsg(readableError(err, "Failed to load indices"));
                    setIndicesLoading(false);
                }
            });

        return () => {
            cancelled = true;
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
                        errors.push(`${label}: ${readableError(r.reason)}`);
                        return null;
                    }
                    const val = r.value;
                    if (val?.error) {
                        errors.push(
                            `${label}: ${readableError(val, "Unknown error")}`
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
                setErrorMsg(readableError(err));
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
                <AlertBanner
                    variant="warning"
                    size="compact"
                    message="No Algolia credential provider configured. Add an Algolia provider with your App ID and API Key to use analytics."
                />
            </div>
        );
    }

    // Theme tokens: rows sit one step above the Panel surface, and the
    // count column uses the secondary channel as its accent.
    const rowClass = `${currentTheme?.["bg-primary-dark"] || ""} ${
        currentTheme?.["text-primary-medium"] || ""
    }`;
    const accentText = currentTheme?.["text-secondary-medium"] || "";

    const renderRows = (items, renderItem) =>
        items.length === 0 ? (
            <EmptyState description="No data available." className="p-2" />
        ) : (
            <div className="space-y-1">
                {items.map((item, i) => (
                    <div
                        key={i}
                        className={`flex items-center justify-between px-2 py-1 rounded text-xs ${rowClass}`}
                    >
                        {renderItem(item, i)}
                    </div>
                ))}
            </div>
        );

    const renderRank = (i, label) => (
        <div className="flex items-center gap-2">
            <Caption2 className="font-mono w-5 text-right">{i + 1}</Caption2>
            <span>{label}</span>
        </div>
    );

    const renderCount = (value, className = accentText) => (
        <span className={`font-mono ${className}`}>
            {(value ?? "").toLocaleString()}
        </span>
    );

    const summaryTiles = summary
        ? [
              {
                  label: "Searches",
                  value: formatNumber(summary.searches),
                  className: accentText,
              },
              {
                  label: "Users",
                  value: formatNumber(summary.users),
                  className: accentText,
              },
              {
                  label: "No Results",
                  value: formatRate(summary.noResultsRate),
                  className: status.warning.icon,
              },
              {
                  label: "No Clicks",
                  value: formatRate(summary.noClickRate),
                  className: status.warning.icon,
              },
          ]
        : [];

    return (
        <div className="flex flex-col gap-3 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} padding={false} />

            {errorMsg && (
                <AlertBanner
                    variant="error"
                    size="compact"
                    message={errorMsg}
                />
            )}

            {/* Index Selector + Date Range */}
            <div className="space-y-2">
                <SelectInput
                    value={selectedIndex}
                    onChange={(value) => handleIndexChange(value)}
                    disabled={indicesLoading}
                    placeholder={
                        indicesLoading
                            ? "Loading indices..."
                            : "Select an index"
                    }
                    options={indices.map((idx) => {
                        const name = idx?.name || idx;
                        return { value: name, label: name };
                    })}
                    inputClassName="text-xs"
                />
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Caption2>From</Caption2>
                    <InputText
                        type="date"
                        value={startDate}
                        onChange={(value) => setStartDate(value)}
                        height="h-7"
                        padding="px-1.5 py-0.5"
                        inputClassName="text-xs"
                        className="flex-1 min-w-0"
                    />
                    <Caption2>To</Caption2>
                    <InputText
                        type="date"
                        value={endDate}
                        onChange={(value) => setEndDate(value)}
                        height="h-7"
                        padding="px-1.5 py-0.5"
                        inputClassName="text-xs"
                        className="flex-1 min-w-0"
                    />
                    <Button2
                        onClick={() => fetchAnalytics(true)}
                        disabled={loading || !selectedIndex}
                        size="sm"
                    >
                        {loading ? "..." : "Refresh"}
                    </Button2>
                </div>
            </div>

            {/* Summary Stats */}
            {summary && (
                <div className="grid grid-cols-4 gap-2">
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

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <Tabs.List className="flex flex-wrap">
                    {TABS.map((tab) => (
                        <Tabs.Trigger
                            key={tab.key}
                            value={tab.key}
                            className="text-xs"
                        >
                            {tab.label}
                        </Tabs.Trigger>
                    ))}
                </Tabs.List>
            </Tabs>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
                {loading && (
                    <Caption2 block className="italic p-2">
                        Loading analytics...
                    </Caption2>
                )}

                {!loading &&
                    activeTab === "topSearches" &&
                    renderRows(topSearches, (item, i) => (
                        <>
                            {renderRank(
                                i,
                                item.search ||
                                    item.query ||
                                    JSON.stringify(item)
                            )}
                            {renderCount(item.count ?? item.nbSearches)}
                        </>
                    ))}

                {!loading &&
                    activeTab === "noResults" &&
                    renderRows(noResultsSearches, (item, i) => (
                        <>
                            {renderRank(
                                i,
                                item.search ||
                                    item.query ||
                                    JSON.stringify(item)
                            )}
                            {renderCount(
                                item.count ?? item.nbSearches,
                                status.warning.icon
                            )}
                        </>
                    ))}

                {!loading &&
                    activeTab === "clickPositions" &&
                    renderRows(clickPositions, (item, i) => (
                        <>
                            <span>
                                Position{" "}
                                {item.position ?? item.clickPosition ?? i + 1}
                            </span>
                            <span className={`font-mono ${accentText}`}>
                                {(
                                    item.clickCount ??
                                    item.count ??
                                    ""
                                ).toLocaleString()}{" "}
                                clicks
                            </span>
                        </>
                    ))}

                {!loading &&
                    activeTab === "countries" &&
                    renderRows(topCountries, (item) => (
                        <>
                            <span>
                                {item.country ||
                                    item.code ||
                                    JSON.stringify(item)}
                            </span>
                            {renderCount(item.count ?? item.nbSearches)}
                        </>
                    ))}

                {!loading &&
                    activeTab === "filters" &&
                    renderRows(topFilters, (item) => (
                        <>
                            <span className="font-mono">
                                {item.attribute ||
                                    item.filter ||
                                    item.value ||
                                    JSON.stringify(item)}
                            </span>
                            {renderCount(item.count ?? item.nbSearches)}
                        </>
                    ))}
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
