import React, { useState } from "react";

const LEVEL_COLORS = {
    info: "#4ade80",
    warn: "#facc15",
    error: "#f87171",
};

const LEVEL_BG = {
    info: "rgba(74, 222, 128, 0.08)",
    warn: "rgba(250, 204, 21, 0.08)",
    error: "rgba(248, 113, 113, 0.12)",
};

function formatTs(ts) {
    if (!ts) return "";
    try {
        const d = new Date(ts);
        return d.toLocaleTimeString("en-US", { hour12: false }) + "." + String(d.getMilliseconds()).padStart(3, "0");
    } catch {
        return ts;
    }
}

function DebugEntry({ entry }) {
    const [expanded, setExpanded] = useState(false);
    const level = entry.level || "info";
    const color = LEVEL_COLORS[level] || "#94a3b8";
    const bg = LEVEL_BG[level] || "transparent";

    const hasDetail = entry.args !== undefined || entry.result !== undefined || entry.error;

    return (
        <div
            style={{
                borderBottom: "1px solid #1e293b",
                padding: "4px 8px",
                fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
                fontSize: "12px",
                lineHeight: "1.5",
                backgroundColor: bg,
                cursor: hasDetail ? "pointer" : "default",
            }}
            onClick={() => hasDetail && setExpanded(!expanded)}
        >
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span style={{ color: "#64748b", minWidth: "85px", flexShrink: 0 }}>
                    {formatTs(entry.ts)}
                </span>
                <span
                    style={{
                        color,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        minWidth: "42px",
                        fontSize: "10px",
                    }}
                >
                    {level}
                </span>
                <span
                    style={{
                        color: "#818cf8",
                        minWidth: "72px",
                        flexShrink: 0,
                    }}
                >
                    {entry.api || "—"}
                </span>
                <span style={{ color: "#e2e8f0", flex: 1 }}>
                    {entry.method || entry.channel || entry.action || "—"}
                </span>
                {entry.durationMs != null && (
                    <span style={{ color: "#64748b", flexShrink: 0 }}>
                        {entry.durationMs}ms
                    </span>
                )}
                {entry.success === false && (
                    <span style={{ color: "#f87171", flexShrink: 0 }}>FAIL</span>
                )}
                {hasDetail && (
                    <span style={{ color: "#475569", flexShrink: 0 }}>
                        {expanded ? "▼" : "▶"}
                    </span>
                )}
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
                    {entry.args !== undefined && (
                        <div style={{ marginBottom: "4px" }}>
                            <span style={{ color: "#818cf8" }}>args: </span>
                            {JSON.stringify(entry.args, null, 2)}
                        </div>
                    )}
                    {entry.result !== undefined && (
                        <div style={{ marginBottom: "4px" }}>
                            <span style={{ color: "#4ade80" }}>result: </span>
                            {JSON.stringify(entry.result, null, 2)}
                        </div>
                    )}
                    {entry.error && (
                        <div>
                            <span style={{ color: "#f87171" }}>error: </span>
                            {entry.error}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default DebugEntry;
