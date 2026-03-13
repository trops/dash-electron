import React, { useState, useEffect, useRef, useCallback } from "react";
import DebugEntry from "./DebugEntry";
import "./DebugConsole.css";

const LEVEL_FILTERS = ["all", "info", "warn", "error"];

function DebugConsole() {
    const [entries, setEntries] = useState([]);
    const [levelFilter, setLevelFilter] = useState("all");
    const [apiFilter, setApiFilter] = useState("all");
    const [autoScroll, setAutoScroll] = useState(true);
    const listRef = useRef(null);

    // Collect unique API names from entries
    const apiNames = React.useMemo(() => {
        const names = new Set();
        for (const e of entries) {
            if (e.api) names.add(e.api);
        }
        return Array.from(names).sort();
    }, [entries]);

    // Subscribe to log entries from main process
    useEffect(() => {
        if (!window.mainApi || !window.mainApi.debug) return;

        const removeListener = window.mainApi.debug.onLogEntry((entry) => {
            setEntries((prev) => {
                const next = [...prev, entry];
                // Cap at 2000 entries in the UI to prevent memory issues
                if (next.length > 2000) {
                    return next.slice(next.length - 1500);
                }
                return next;
            });
        });

        return () => {
            if (removeListener) removeListener();
        };
    }, []);

    // Auto-scroll to bottom when new entries arrive
    useEffect(() => {
        if (autoScroll && listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [entries, autoScroll]);

    const handleClear = useCallback(() => {
        setEntries([]);
    }, []);

    // Filter entries
    const filtered = React.useMemo(() => {
        return entries.filter((e) => {
            if (levelFilter !== "all" && e.level !== levelFilter) return false;
            if (apiFilter !== "all" && e.api !== apiFilter) return false;
            return true;
        });
    }, [entries, levelFilter, apiFilter]);

    return (
        <div className="debug-console">
            <div className="debug-toolbar">
                <div className="debug-toolbar-group">
                    {LEVEL_FILTERS.map((level) => (
                        <button
                            key={level}
                            className={`debug-filter-btn ${
                                level !== "all" ? `level-${level}` : ""
                            } ${levelFilter === level ? "active" : ""}`}
                            onClick={() => setLevelFilter(level)}
                        >
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                        </button>
                    ))}
                </div>

                <select
                    className="debug-api-select"
                    value={apiFilter}
                    onChange={(e) => setApiFilter(e.target.value)}
                >
                    <option value="all">All APIs</option>
                    {apiNames.map((api) => (
                        <option key={api} value={api}>
                            {api}
                        </option>
                    ))}
                </select>

                <button
                    className={`debug-filter-btn ${autoScroll ? "active" : ""}`}
                    onClick={() => setAutoScroll(!autoScroll)}
                    title="Auto-scroll to latest"
                >
                    {autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
                </button>

                <button className="debug-action-btn" onClick={handleClear}>
                    Clear
                </button>
            </div>

            <div className="debug-log-list" ref={listRef}>
                {filtered.length === 0 ? (
                    <div className="debug-empty">
                        {entries.length === 0
                            ? "Waiting for log entries..."
                            : "No entries match current filters"}
                    </div>
                ) : (
                    filtered.map((entry) => (
                        <DebugEntry key={entry.id} entry={entry} />
                    ))
                )}
            </div>

            <div className="debug-status-bar">
                <span>
                    {filtered.length} / {entries.length} entries
                </span>
                <span>Debug Console</span>
            </div>
        </div>
    );
}

export default DebugConsole;
