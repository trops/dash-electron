/**
 * GmailUnreadCount
 *
 * Stat widget: a single big number for unread email matching a
 * configurable Gmail search query. Refresh button + optional
 * auto-refresh interval. Publishes `unreadCountUpdated` so paired
 * widgets (notifications, status bars) can react.
 *
 * Exemplar widget (post-cohesion rubric): the stat tile is a
 * `StatCard` from @trops/dash-react, every other element is also a
 * dash-react primitive. The numeric value carries an inline-zero
 * "inbox zero ✓" hint via the StatCard.helpText slot.
 *
 * @package Gmail
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
    Panel,
    SubHeading2,
    Caption2,
    Button2,
    StatCard,
    StatusBadge,
    Alert2,
} from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import {
    extractMcpText,
    safeParse,
    parseSearchResults,
} from "../utils/mcpUtils";

function connectionState({ isConnected, isConnecting, error, loading }) {
    if (loading) return "info";
    if (isConnected) return "success";
    if (isConnecting) return "pending";
    if (error) return "error";
    return "neutral";
}

function GmailUnreadCountContent({ title, query, autoRefreshSeconds, label }) {
    const { isConnected, isConnecting, error, callTool, status } =
        useMcpProvider("gmail");
    const { publishEvent } = useWidgetEvents();

    const [count, setCount] = useState(null);
    const [loading, setLoading] = useState(false);
    const [lastFetchedAt, setLastFetchedAt] = useState(null);
    const [fetchError, setFetchError] = useState(null);

    // re-render every 30s so the relative timestamp stays current
    // without re-fetching.
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((n) => n + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    const effectiveQuery = (query && query.trim()) || "is:unread in:inbox";

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

    useEffect(() => {
        if (isConnected) fetchUnread();
    }, [isConnected, effectiveQuery, fetchUnread]);

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

    const displayValue = count == null ? "—" : String(count);
    const displayHelp = count === 0 ? "inbox zero ✓" : label || "unread email";

    return (
        <div className="flex flex-col gap-4 h-full overflow-y-auto">
            <SubHeading2 title={title} />

            <div className="flex items-center gap-2">
                <StatusBadge
                    state={connectionState({
                        isConnected,
                        isConnecting,
                        error,
                        loading,
                    })}
                    label={loading ? "loading" : status}
                    compact
                />
            </div>

            {error && <Alert2 title="Gmail connection error" message={error} />}

            <div className="flex-1 min-h-0 flex flex-col items-center justify-center">
                <StatCard
                    label="unread"
                    value={displayValue}
                    helpText={displayHelp}
                />
                <Caption2 text={`query: ${effectiveQuery}`} className="mt-2" />
            </div>

            {fetchError && (
                <Alert2 title="Last refresh failed" message={fetchError} />
            )}

            <div className="flex items-center justify-between gap-2">
                <Caption2
                    text={
                        lastFetchedAt
                            ? `updated ${relativeTime(lastFetchedAt)}`
                            : "not yet loaded"
                    }
                />
                <Button2
                    title={loading ? "Loading…" : "Refresh"}
                    onClick={() => fetchUnread()}
                    disabled={!isConnected || loading}
                    size="sm"
                />
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
