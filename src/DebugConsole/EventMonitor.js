import React, { useState, useEffect, useRef, useCallback } from "react";
import { DashboardPublisher } from "@trops/dash-core";

const MAX_ENTRIES = 500;

function formatTs(ts) {
    if (!ts) return "";
    try {
        const d = new Date(ts);
        return (
            d.toLocaleTimeString("en-US", { hour12: false }) +
            "." +
            String(d.getMilliseconds()).padStart(3, "0")
        );
    } catch {
        return String(ts);
    }
}

function parseEventType(eventType) {
    const match = eventType.match(/^(.+)\[(\d+)\]\.(.+)$/);
    if (match) {
        return { widget: match[1], id: match[2], event: match[3] };
    }
    return { widget: "", id: "", event: eventType };
}

function EventEntry({ entry }) {
    const [expanded, setExpanded] = useState(false);
    const parsed = parseEventType(entry.eventType);

    return (
        <div
            style={{
                borderBottom: "1px solid #1e293b",
                padding: "4px 8px",
                fontFamily:
                    "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
                fontSize: "12px",
                lineHeight: "1.5",
                backgroundColor: "transparent",
                cursor: "pointer",
            }}
            onClick={() => setExpanded(!expanded)}
        >
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span
                    style={{
                        color: "#64748b",
                        minWidth: "85px",
                        flexShrink: 0,
                    }}
                >
                    {formatTs(entry.timestamp)}
                </span>
                <span
                    style={{
                        color: "#818cf8",
                        fontWeight: 600,
                        flexShrink: 0,
                    }}
                >
                    {parsed.widget}
                    <span style={{ color: "#64748b" }}>[{parsed.id}]</span>
                </span>
                <span style={{ color: "#facc15" }}>.{parsed.event}</span>
                <span
                    style={{
                        color: "#64748b",
                        marginLeft: "auto",
                        flexShrink: 0,
                    }}
                >
                    {entry.subscriberCount} sub
                    {entry.subscriberCount !== 1 ? "s" : ""}
                </span>
                <span style={{ color: "#475569", flexShrink: 0 }}>
                    {expanded ? "▼" : "▶"}
                </span>
            </div>

            {expanded && (
                <div
                    style={{
                        marginTop: "4px",
                        padding: "6px 8px",
                        backgroundColor: "#0f172a",
                        borderRadius: "4px",
                        fontSize: "11px",
                        color: "#94a3b8",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        maxHeight: "300px",
                        overflow: "auto",
                    }}
                >
                    <div style={{ marginBottom: "4px" }}>
                        <span style={{ color: "#818cf8" }}>event: </span>
                        {entry.eventType}
                    </div>
                    <div>
                        <span style={{ color: "#4ade80" }}>payload: </span>
                        {JSON.stringify(entry.content, null, 2)}
                    </div>
                </div>
            )}
        </div>
    );
}

function SubscriptionList() {
    const [subs, setSubs] = useState([]);

    useEffect(() => {
        const refresh = () => {
            const listenerMap = DashboardPublisher.listeners();
            const items = [];
            listenerMap.forEach((subscribers, eventType) => {
                items.push({
                    eventType,
                    parsed: parseEventType(eventType),
                    count: subscribers.length,
                    uuids: subscribers.map((s) => s.uuid),
                });
            });
            setSubs(items);
        };
        refresh();
        const interval = setInterval(refresh, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="debug-log-list">
            {subs.length === 0 ? (
                <div className="debug-empty">No active subscriptions</div>
            ) : (
                subs.map((sub, i) => (
                    <div
                        key={i}
                        style={{
                            borderBottom: "1px solid #1e293b",
                            padding: "4px 8px",
                            fontSize: "12px",
                            lineHeight: "1.5",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                gap: "8px",
                                alignItems: "center",
                            }}
                        >
                            <span style={{ color: "#818cf8", fontWeight: 600 }}>
                                {sub.parsed.widget}
                                <span style={{ color: "#64748b" }}>
                                    [{sub.parsed.id}]
                                </span>
                            </span>
                            <span style={{ color: "#facc15" }}>
                                .{sub.parsed.event}
                            </span>
                            <span
                                style={{
                                    color: "#64748b",
                                    marginLeft: "auto",
                                    flexShrink: 0,
                                }}
                            >
                                {sub.count} listener
                                {sub.count !== 1 ? "s" : ""}
                            </span>
                        </div>
                        <div
                            style={{
                                color: "#475569",
                                fontSize: "10px",
                                paddingLeft: "16px",
                            }}
                        >
                            {sub.uuids.join(", ")}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}

function EventMonitor() {
    const [view, setView] = useState("stream");
    const [entries, setEntries] = useState([]);
    const [autoScroll, setAutoScroll] = useState(true);
    const listRef = useRef(null);

    useEffect(() => {
        const unsub = DashboardPublisher.onMonitor((data) => {
            setEntries((prev) => {
                const next = [...prev, data];
                return next.length > MAX_ENTRIES
                    ? next.slice(next.length - MAX_ENTRIES)
                    : next;
            });
        });
        return unsub;
    }, []);

    useEffect(() => {
        if (autoScroll && listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [entries, autoScroll]);

    const handleClear = useCallback(() => setEntries([]), []);

    return (
        <>
            <div className="debug-toolbar">
                <div className="debug-toolbar-group">
                    <button
                        className={`debug-filter-btn ${
                            view === "stream" ? "active" : ""
                        }`}
                        onClick={() => setView("stream")}
                    >
                        Event Stream
                    </button>
                    <button
                        className={`debug-filter-btn ${
                            view === "subs" ? "active" : ""
                        }`}
                        onClick={() => setView("subs")}
                    >
                        Subscriptions
                    </button>
                </div>

                {view === "stream" && (
                    <>
                        <button
                            className={`debug-filter-btn ${
                                autoScroll ? "active" : ""
                            }`}
                            onClick={() => setAutoScroll(!autoScroll)}
                        >
                            {autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
                        </button>
                        <button
                            className="debug-action-btn"
                            onClick={handleClear}
                        >
                            Clear
                        </button>
                    </>
                )}
            </div>

            {view === "stream" ? (
                <>
                    <div className="debug-log-list" ref={listRef}>
                        {entries.length === 0 ? (
                            <div className="debug-empty">
                                Waiting for widget events...
                            </div>
                        ) : (
                            entries.map((entry, i) => (
                                <EventEntry key={i} entry={entry} />
                            ))
                        )}
                    </div>
                    <div className="debug-status-bar">
                        <span>{entries.length} events</span>
                        <span>Widget Event Monitor</span>
                    </div>
                </>
            ) : (
                <SubscriptionList />
            )}
        </>
    );
}

export default EventMonitor;
