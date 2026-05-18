/**
 * NotionPageSearch
 *
 * Focused search-only Notion widget. Search input → debounced
 * `notion_search` MCP call → result list of pages/databases. Click
 * publishes `pageSelected` with the page id + title + url so paired
 * widgets (page viewer, database renderer) can react.
 *
 * Page-title extraction handles Notion's three common shapes:
 *   - top-level `title` array (most common search results)
 *   - `properties.title.title[].plain_text` (page properties)
 *   - `properties.Name.title[].plain_text` (database rows)
 *
 * Debouncing matters here: typing into the input shouldn't fire one
 * MCP request per keystroke (rate-limit and visual jitter risk).
 * Default 400ms is responsive enough to feel live, cheap enough to
 * not spam the wire.
 *
 * @package Notion
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { parseMcpResponse, parseNotionTextEntries } from "../utils/mcpUtils";

function getPageTitle(page) {
    if (page.title) {
        if (typeof page.title === "string") return page.title;
        if (Array.isArray(page.title) && page.title[0]?.plain_text)
            return page.title[0].plain_text;
    }
    const props = page.properties || {};
    if (props.title?.title?.[0]?.plain_text)
        return props.title.title[0].plain_text;
    if (props.Name?.title?.[0]?.plain_text)
        return props.Name.title[0].plain_text;
    return page.object === "database" ? "Untitled database" : "Untitled page";
}

function relativeTime(input) {
    if (!input) return "";
    const date = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(date.getTime())) return "";
    const sec = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
    if (sec < 60) return `${sec}s ago`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.round(hr / 24);
    if (day < 30) return `${day}d ago`;
    const mo = Math.round(day / 30);
    if (mo < 12) return `${mo}mo ago`;
    const yr = Math.round(mo / 12);
    return `${yr}y ago`;
}

function NotionPageSearchContent({ title, initialQuery, debounceMs }) {
    const { isConnected, isConnecting, error, callTool, status } =
        useMcpProvider("notion");
    const { publishEvent } = useWidgetEvents();

    const [query, setQuery] = useState(initialQuery || "");
    const [debouncedQuery, setDebouncedQuery] = useState(initialQuery || "");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [lastFetchedQuery, setLastFetchedQuery] = useState(null);

    // re-render every 30s so the relative timestamps in the results
    // ("3m ago") stay fresh without a re-fetch.
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((n) => n + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    // Debounce: bump debouncedQuery only after the input has been
    // idle for debounceMs. Cleanup on every keystroke resets the
    // timer so back-to-back typing doesn't fire intermediate
    // searches.
    useEffect(() => {
        const ms = Math.max(0, Number(debounceMs) || 400);
        if (ms === 0) {
            setDebouncedQuery(query);
            return undefined;
        }
        const id = setTimeout(() => setDebouncedQuery(query), ms);
        return () => clearTimeout(id);
    }, [query, debounceMs]);

    // publishEvent kept in a ref so the search callback's dep list
    // stays tight — same useRef discipline the conventions call out.
    const publishRef = useRef(publishEvent);
    publishRef.current = publishEvent;

    const runSearch = useCallback(
        async (q) => {
            if (!isConnected) return;
            const trimmed = (q || "").trim();
            if (!trimmed) {
                // Empty query: clear results without spamming the
                // MCP. The empty-state branch below handles this.
                setResults([]);
                setLastFetchedQuery("");
                return;
            }
            setLoading(true);
            setFetchError(null);
            try {
                const res = await callTool("notion_search", { query: trimmed });
                const { data, error: mcpError } = parseMcpResponse(res, {
                    arrayKeys: ["results", "pages"],
                    textParser: parseNotionTextEntries,
                });
                if (mcpError) {
                    setFetchError(mcpError);
                    return;
                }
                setResults(Array.isArray(data) ? data : []);
                setLastFetchedQuery(trimmed);
            } catch (err) {
                setFetchError(err?.message || "Search failed");
            } finally {
                setLoading(false);
            }
        },
        [isConnected, callTool]
    );

    // Fire whenever the debounced query (or connection) changes —
    // skips while the user is still typing.
    useEffect(() => {
        runSearch(debouncedQuery);
    }, [debouncedQuery, runSearch]);

    const handleSelect = (page) => {
        const pageId = page.id || page.pageId || page.page_id;
        const pageTitle = getPageTitle(page);
        setSelectedId(pageId);
        publishRef.current("pageSelected", {
            id: pageId,
            title: pageTitle,
            url: page.url || null,
            object: page.object || "page",
            lastEditedTime: page.last_edited_time || null,
        });
    };

    const submitForm = (e) => {
        e.preventDefault();
        // Bypass debounce on explicit Enter — user signalled
        // "search now."
        setDebouncedQuery(query);
    };

    return (
        <div className="flex flex-col gap-4 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

            {/* Connection status line. */}
            <div className="flex items-center gap-2 text-xs">
                <span
                    className={`inline-block w-2 h-2 rounded-full ${
                        !isConnected && !isConnecting
                            ? "bg-gray-500"
                            : isConnecting
                            ? "bg-yellow-500 animate-pulse"
                            : error
                            ? "bg-red-500"
                            : loading
                            ? "bg-blue-500 animate-pulse"
                            : "bg-green-500"
                    }`}
                />
                <span className="text-gray-400 font-mono">{status}</span>
                {lastFetchedQuery !== null && (
                    <span className="text-gray-600 truncate">
                        {lastFetchedQuery
                            ? `"${lastFetchedQuery}" → ${results.length}`
                            : "—"}
                    </span>
                )}
            </div>

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {/* Search input — onSubmit (Enter) bypasses the debounce. */}
            <form onSubmit={submitForm} className="flex items-center gap-2">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search Notion pages…"
                    disabled={!isConnected}
                    className="flex-1 px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 disabled:opacity-40"
                />
                <button
                    type="submit"
                    disabled={!isConnected || loading || !query.trim()}
                    className="px-3 py-2 text-xs rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                >
                    {loading ? "…" : "Search"}
                </button>
            </form>

            {/* Five-way state machine for the results block. Each
                branch is mutually exclusive so the user never sees a
                blank or ambiguous list. */}
            {!isConnected && (
                <div className="text-xs text-gray-500 italic">
                    Connect the Notion provider in Settings to search pages.
                </div>
            )}

            {isConnected && !query.trim() && (
                <div className="text-xs text-gray-500 italic">
                    Type to search Notion pages and databases. Click a result to
                    publish pageSelected for a paired viewer widget.
                </div>
            )}

            {isConnected &&
                query.trim() &&
                !loading &&
                !fetchError &&
                results.length === 0 &&
                lastFetchedQuery && (
                    <div className="text-xs text-gray-500 italic">
                        No pages match "{lastFetchedQuery}".
                    </div>
                )}

            {results.length > 0 && (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
                    {results.map((page, i) => {
                        const pageId =
                            page.id ||
                            page.pageId ||
                            page.page_id ||
                            `page-${i}`;
                        const isSelected = selectedId === pageId;
                        const isDatabase = page.object === "database";
                        return (
                            <button
                                key={pageId}
                                type="button"
                                onClick={() => handleSelect(page)}
                                className={`w-full text-left px-3 py-2 rounded text-xs transition-colors border ${
                                    isSelected
                                        ? "bg-purple-900/40 border-purple-500"
                                        : "bg-white/5 hover:bg-white/10 border-transparent"
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-gray-200 truncate flex-1">
                                        {getPageTitle(page)}
                                    </span>
                                    <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide shrink-0 ${
                                            isDatabase
                                                ? "bg-indigo-900/50 text-indigo-300"
                                                : "bg-gray-700/50 text-gray-400"
                                        }`}
                                    >
                                        {isDatabase ? "db" : "page"}
                                    </span>
                                </div>
                                {page.last_edited_time && (
                                    <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                                        edited{" "}
                                        {relativeTime(page.last_edited_time)}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Per-fetch error — distinct from the provider-level
                error rendered above. */}
            {fetchError && (
                <div className="text-xs text-red-400">
                    Search failed: {fetchError}
                </div>
            )}
        </div>
    );
}

export const NotionPageSearch = ({
    title = "Notion Search",
    initialQuery = "",
    debounceMs = 400,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <NotionPageSearchContent
                    title={title}
                    initialQuery={initialQuery || ""}
                    debounceMs={Number(debounceMs) || 400}
                />
            </Panel>
        </Widget>
    );
};
