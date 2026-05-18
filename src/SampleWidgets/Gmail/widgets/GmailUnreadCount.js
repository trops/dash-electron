/**
 * GmailUnreadCount
 *
 * Stat widget: a single big number for unread email matching a
 * configurable Gmail search query. Refresh button + optional
 * auto-refresh interval. Publishes `unreadCountUpdated` so paired
 * widgets (notifications, status bars) can react.
 *
 * Stat-style display intentionally uses Heading2 for the count — the
 * widget conventions allow Heading2 / Heading3 for numeric display
 * (it's the section-title Heading we ban inside widgets, not numeric
 * display). The widget's title above the number stays SubHeading2 as
 * usual.
 *
 * Calls the Gmail MCP `search_emails` tool with whatever query the
 * user configured (default `is:unread in:inbox` — the canonical
 * "inbox unread" count). Parses the result list and reports its
 * length as the count.
 *
 * @package Gmail
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Panel, SubHeading2, Heading2 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import {
    extractMcpText,
    safeParse,
    parseSearchResults,
} from "../utils/mcpUtils";

function GmailUnreadCountContent({ title, query, autoRefreshSeconds, label }) {
    const { isConnected, isConnecting, error, callTool, status } =
        useMcpProvider("gmail");
    const { publishEvent } = useWidgetEvents();

    const [count, setCount] = useState(null);
    const [loading, setLoading] = useState(false);
    const [lastFetchedAt, setLastFetchedAt] = useState(null);
    const [fetchError, setFetchError] = useState(null);

    // re-render every 30s so the relative timestamp stays current
    // without re-fetching the data.
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((n) => n + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    const effectiveQuery = (query && query.trim()) || "is:unread in:inbox";

    // Keep publishEvent in a ref so the fetch callback doesn't list
    // it as a dep — otherwise the auto-refresh effect would re-arm
    // on every render.
    const publishRef = useRef(publishEvent);
    publishRef.current = publishEvent;

    const fetchUnread = useCallback(async () => {
        if (!isConnected) return;
        setLoading(true);
        setFetchError(null);
        try {
            const res = await callTool("search_emails", {
                query: effectiveQuery,
            });
            const text = extractMcpText(res);
            const parsed = safeParse(text);
            // Gmail MCP returns either a JSON array of message objects
            // (typed servers) or the legacy text-block format the other
            // Gmail widgets in this package decode via parseSearchResults.
            // Both yield a list whose .length is the count we want.
            let list = Array.isArray(parsed)
                ? parsed
                : parsed?.messages || parsed?.emails || null;
            if (
                !list ||
                (typeof parsed === "string" && parsed.includes("ID:"))
            ) {
                list = parseSearchResults(text);
            }
            const next = Array.isArray(list) ? list.length : 0;
            setCount(next);
            setLastFetchedAt(new Date());
            publishRef.current("unreadCountUpdated", {
                count: next,
                query: effectiveQuery,
                fetchedAt: new Date().toISOString(),
            });
        } catch (err) {
            setFetchError(err?.message || "Failed to load unread count");
        } finally {
            setLoading(false);
        }
    }, [isConnected, callTool, effectiveQuery]);

    // Initial fetch + re-fetch on query / connection change.
    useEffect(() => {
        if (isConnected) fetchUnread();
    }, [isConnected, effectiveQuery, fetchUnread]);

    // Auto-refresh — interval guarded by autoRefreshSeconds. 0 / falsy
    // disables. Cleanup runs on unmount AND on every dep change so we
    // never leave a stale timer behind.
    useEffect(() => {
        const seconds = Number(autoRefreshSeconds) || 0;
        if (seconds <= 0 || !isConnected) return undefined;
        const id = setInterval(() => fetchUnread(), seconds * 1000);
        return () => clearInterval(id);
    }, [autoRefreshSeconds, isConnected, fetchUnread]);

    const relativeTime = (date) => {
        if (!date) return "";
        const sec = Math.max(
            0,
            Math.round((Date.now() - date.getTime()) / 1000)
        );
        if (sec < 5) return "just now";
        if (sec < 60) return `${sec}s ago`;
        const min = Math.round(sec / 60);
        if (min < 60) return `${min}m ago`;
        const hr = Math.round(min / 60);
        return `${hr}h ago`;
    };

    // The dominant visual is the number. We render it in three
    // states: not-yet-loaded ("—"), loaded zero ("0" with subtle
    // "inbox zero ✓" hint), loaded non-zero. The Heading2 sizing is
    // intentional — stat widgets are exactly the case the
    // conventions' allowedNumericDisplay was carved out for.
    const renderNumber = () => {
        if (count == null && loading) {
            return (
                <Heading2 title="—" className="text-gray-500 animate-pulse" />
            );
        }
        if (count == null) {
            return <Heading2 title="—" className="text-gray-500" />;
        }
        if (count === 0) {
            return <Heading2 title="0" className="text-emerald-400" />;
        }
        return <Heading2 title={String(count)} className="text-gray-100" />;
    };

    return (
        <div className="flex flex-col gap-4 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

            {/* Connection status — one-line, same shape as the other
                Gmail widgets so the dashboard looks consistent. */}
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
            </div>

            {/* Provider-level error — visible feedback, not just
                console. Per-fetch errors render below the number so
                the user sees what the last refresh actually did. */}
            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {/* The number + label block — flex-1 so it dominates the
                widget's vertical space. */}
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1">
                {renderNumber()}
                <div className="text-xs text-gray-400">
                    {count === 0 ? "inbox zero ✓" : label}
                </div>
                <div className="text-[11px] text-gray-500 font-mono mt-1">
                    query: {effectiveQuery}
                </div>
            </div>

            {/* Per-fetch error — distinct from the provider error
                above. */}
            {fetchError && (
                <div className="text-xs text-red-400 text-center">
                    Last refresh failed: {fetchError}
                </div>
            )}

            {/* Footer: last-checked + refresh. Render the refresh
                button regardless of state (disabled when not
                connectable) so the user always has a clear action. */}
            <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                <span>
                    {lastFetchedAt
                        ? `updated ${relativeTime(lastFetchedAt)}`
                        : "not yet loaded"}
                </span>
                <button
                    type="button"
                    onClick={() => fetchUnread()}
                    disabled={!isConnected || loading}
                    className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                >
                    {loading ? "Loading…" : "Refresh"}
                </button>
            </div>
        </div>
    );
}

export const GmailUnreadCount = ({
    title = "Unread Email",
    query = "",
    autoRefreshSeconds = 60,
    label = "unread email",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GmailUnreadCountContent
                    title={title}
                    query={query}
                    autoRefreshSeconds={Number(autoRefreshSeconds) || 0}
                    label={label || "unread email"}
                />
            </Panel>
        </Widget>
    );
};
