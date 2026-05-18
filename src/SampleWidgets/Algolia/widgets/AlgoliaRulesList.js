/**
 * AlgoliaRulesList
 *
 * Paginated list of an Algolia index's rules. Each row shows the rule's
 * description (or objectID), its enabled state, and a count of
 * conditions / consequence ops. Clicking a row publishes a
 * `ruleSelected` event with the full rule object so paired widgets
 * (rule editor, condition viewer, …) can react.
 *
 * Calls `window.mainApi.algolia.searchRules` via the credential
 * provider IPC path — same plumbing AlgoliaIndexDashboardWidget uses
 * for listIndices. The IPC handler accepts a positional
 * (query, options) shape under the hood (Algolia v4 SDK gotcha,
 * pinned by algoliaOps.test.js).
 *
 * Listens for `indexSelected` events so it can react to widgets that
 * publish an index name (e.g. the AlgoliaIndexDashboardWidget); the
 * received name overrides the userConfig default until the user
 * picks another. This keeps the widget useful both standalone (set
 * indexName in config) and as part of a multi-widget Algolia
 * dashboard.
 *
 * @package Algolia
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import {
    Widget,
    useWidgetProviders,
    useProviderClient,
    useWidgetEvents,
} from "@trops/dash-core";

function AlgoliaRulesListContent({ title, indexName, hitsPerPage }) {
    const { hasProvider, getProvider } = useWidgetProviders();
    const { publishEvent, listen, listeners } = useWidgetEvents();

    const hasCredentials = hasProvider("algolia");
    const provider = hasCredentials ? getProvider("algolia") : null;
    const pc = useProviderClient(provider);

    const [activeIndex, setActiveIndex] = useState(indexName || "");
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(0);
    const [rules, setRules] = useState([]);
    const [nbPages, setNbPages] = useState(0);
    const [nbHits, setNbHits] = useState(0);
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Re-sync from userConfig when the config-pane edit fires (parent
    // re-renders us with a new indexName prop). Skip when the user
    // already overrode via an indexSelected event — the runtime pick
    // wins until the config explicitly changes.
    const configIndexRef = useRef(indexName);
    useEffect(() => {
        if (indexName !== configIndexRef.current) {
            configIndexRef.current = indexName;
            setActiveIndex(indexName || "");
            setPage(0);
        }
    }, [indexName]);

    // Listen for indexSelected — useRef-stored handler so a re-render
    // doesn't tear listener bindings down (convention from
    // widgetConventions.js).
    const indexSelectedRef = useRef(null);
    indexSelectedRef.current = (data) => {
        const payload = data?.message || data;
        const name =
            (typeof payload === "string" ? payload : payload?.name) || "";
        if (name) {
            setActiveIndex(name);
            setPage(0);
        }
    };
    useEffect(() => {
        if (!listeners || !listen) return;
        listen(listeners, {
            indexSelected: (payload) => indexSelectedRef.current(payload),
        });
    }, [listen, listeners]);

    const loadRules = useCallback(
        (targetPage = 0) => {
            if (!pc?.providerHash || !activeIndex) return;
            setLoading(true);
            setError(null);
            window.mainApi.algolia
                .searchRules({
                    ...pc,
                    indexName: activeIndex,
                    query: query.trim(),
                    hitsPerPage,
                    page: targetPage,
                })
                .then((data) => {
                    setRules(Array.isArray(data?.hits) ? data.hits : []);
                    setNbPages(data?.nbPages || 0);
                    setNbHits(data?.nbHits || 0);
                    setPage(data?.page || 0);
                    setLoading(false);
                })
                .catch((err) => {
                    setError(err?.message || "Failed to load rules");
                    setLoading(false);
                });
        },
        [pc?.providerHash, activeIndex, query, hitsPerPage]
    );

    // Re-load whenever the index changes or the provider connects.
    // The query is committed via the search form's submit, not on
    // every keystroke — per-keystroke IPC spam is worse than an
    // extra Enter.
    useEffect(() => {
        loadRules(0);
    }, [pc?.providerHash, activeIndex, loadRules]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        loadRules(0);
    };

    const handleSelect = (rule) => {
        setSelectedId(rule.objectID);
        publishEvent("ruleSelected", {
            objectID: rule.objectID,
            description: rule.description || "",
            indexName: activeIndex,
            rule,
        });
    };

    const handlePrev = () => {
        if (page > 0) loadRules(page - 1);
    };
    const handleNext = () => {
        if (page + 1 < nbPages) loadRules(page + 1);
    };

    const ruleLabel = (rule) =>
        rule.description ||
        rule.objectID ||
        (rule.conditions && rule.conditions[0]?.pattern) ||
        "(unnamed rule)";

    const conditionCount = (rule) =>
        Array.isArray(rule.conditions) ? rule.conditions.length : 0;

    const consequenceOpCount = (rule) => {
        const c = rule.consequence || {};
        let n = 0;
        if (Array.isArray(c.promote)) n += c.promote.length;
        if (Array.isArray(c.hide)) n += c.hide.length;
        if (c.userData) n += 1;
        if (c.filterPromotes) n += 1;
        if (c.params) n += 1;
        return n;
    };

    return (
        <div className="flex flex-col gap-4 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

            {/* Connection / config status — a single line so the user
                always knows which of (provider missing / index missing
                / loaded) they're looking at. */}
            <div className="flex items-center gap-2 text-xs">
                <span
                    className={`inline-block w-2 h-2 rounded-full ${
                        !hasCredentials
                            ? "bg-gray-500"
                            : !activeIndex
                            ? "bg-yellow-500"
                            : error
                            ? "bg-red-500"
                            : loading
                            ? "bg-blue-500 animate-pulse"
                            : "bg-green-500"
                    }`}
                />
                <span className="text-gray-400 font-mono">
                    {!hasCredentials
                        ? "no provider"
                        : !activeIndex
                        ? "no index"
                        : loading
                        ? "loading"
                        : error
                        ? "error"
                        : `${nbHits} rule${nbHits === 1 ? "" : "s"}`}
                </span>
                {activeIndex && (
                    <span className="text-gray-600 truncate">
                        ({activeIndex})
                    </span>
                )}
            </div>

            {/* Error panel — visible feedback, not just console. */}
            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {/* Search + refresh row. */}
            <form
                onSubmit={handleSearchSubmit}
                className="flex items-center gap-2"
            >
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter rules by query…"
                    disabled={!hasCredentials || !activeIndex}
                    className="flex-1 px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-40"
                />
                <button
                    type="submit"
                    disabled={!hasCredentials || !activeIndex || loading}
                    className="px-3 py-2 text-xs rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                >
                    {loading ? "Loading…" : "Search"}
                </button>
            </form>

            {/* Section header for the result list. */}
            <div className="flex items-center justify-between">
                <SubHeading3 title="Rules" />
                {nbPages > 1 && (
                    <div className="flex items-center gap-2 text-xs">
                        <button
                            type="button"
                            onClick={handlePrev}
                            disabled={page === 0 || loading}
                            className="px-2 py-1 rounded bg-gray-700/40 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300"
                        >
                            ← Prev
                        </button>
                        <span className="text-gray-500">
                            page {page + 1} of {nbPages}
                        </span>
                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={page + 1 >= nbPages || loading}
                            className="px-2 py-1 rounded bg-gray-700/40 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300"
                        >
                            Next →
                        </button>
                    </div>
                )}
            </div>

            {/* Rule rows. The empty / no-provider / no-index branches
                each render a distinct message so the user knows exactly
                what to do next — never a blank list with no
                explanation. */}
            {!hasCredentials && (
                <div className="text-xs text-gray-500 italic">
                    Configure an Algolia provider (appId + apiKey) in Settings
                    to load rules.
                </div>
            )}

            {hasCredentials && !activeIndex && (
                <div className="text-xs text-gray-500 italic">
                    Set the Index Name in this widget's settings, or pair it
                    with a widget that publishes an indexSelected event.
                </div>
            )}

            {hasCredentials &&
                activeIndex &&
                !loading &&
                !error &&
                rules.length === 0 && (
                    <div className="text-xs text-gray-500 italic">
                        Index <span className="font-mono">{activeIndex}</span>{" "}
                        has no rules
                        {query.trim() ? ` matching "${query.trim()}"` : ""}.
                    </div>
                )}

            {rules.length > 0 && (
                <div className="flex-1 overflow-y-auto space-y-1">
                    {rules.map((rule) => {
                        const enabled = rule.enabled !== false;
                        return (
                            <button
                                key={rule.objectID}
                                type="button"
                                onClick={() => handleSelect(rule)}
                                className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                                    selectedId === rule.objectID
                                        ? "bg-blue-900/50 border border-blue-500"
                                        : "bg-white/5 hover:bg-white/10 border border-transparent"
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-gray-200 truncate flex-1">
                                        {ruleLabel(rule)}
                                    </span>
                                    <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide shrink-0 ${
                                            enabled
                                                ? "bg-green-900/50 text-green-300"
                                                : "bg-gray-700/50 text-gray-400"
                                        }`}
                                    >
                                        {enabled ? "on" : "off"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500 font-mono">
                                    <span>{conditionCount(rule)} cond</span>
                                    <span>
                                        {consequenceOpCount(rule)} action
                                        {consequenceOpCount(rule) === 1
                                            ? ""
                                            : "s"}
                                    </span>
                                    <span className="truncate">
                                        {rule.objectID}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export const AlgoliaRulesList = ({
    title = "Algolia Rules",
    indexName = "",
    hitsPerPage = 25,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <AlgoliaRulesListContent
                    title={title}
                    indexName={indexName}
                    hitsPerPage={Number(hitsPerPage) || 25}
                />
            </Panel>
        </Widget>
    );
};
