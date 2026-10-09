/**
 * WidgetConsolePane — Console-tab body for the AI Builder.
 *
 * Renders captured console.* + window.error + unhandledrejection
 * events from the widget under preview. Severities color-coded; each
 * row shows timestamp + source + serialized args. A small toolbar
 * lets the user clear or filter to errors only.
 */
import React, { useMemo, useState } from "react";
import { useBuilderTheme } from "./useBuilderTheme";

function severityClasses(sev, bt) {
    switch (sev) {
        case "error":
            return `${bt.status.error.icon} border-l-2 ${bt.status.error.border}`;
        case "warn":
            return `${bt.status.warning.icon} border-l-2 ${bt.status.warning.border}`;
        case "info":
            return `${bt.status.info.icon} border-l-2 ${bt.status.info.border}`;
        case "debug":
            return `${bt.muted} border-l-2 ${bt.border}`;
        default:
            return `${bt.text} border-l-2 ${bt.border}`;
    }
}

function formatArg(arg) {
    if (arg === null) return "null";
    if (arg === undefined) return "undefined";
    if (typeof arg === "string") return arg;
    if (typeof arg === "number" || typeof arg === "boolean") return String(arg);
    if (arg instanceof Error)
        return `${arg.name}: ${arg.message}\n${arg.stack || ""}`;
    try {
        return JSON.stringify(arg, null, 2);
    } catch {
        return String(arg);
    }
}

function formatTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    return `${hh}:${mm}:${ss}.${ms}`;
}

export const WidgetConsolePane = ({
    events = [],
    onClear,
    onSendErrorToAI,
}) => {
    const bt = useBuilderTheme();
    const [errorsOnly, setErrorsOnly] = useState(false);
    const filtered = useMemo(
        () =>
            errorsOnly ? events.filter((e) => e.severity === "error") : events,
        [events, errorsOnly]
    );

    return (
        <div className={`flex flex-col h-full ${bt.surface} ${bt.text}`}>
            <div
                className={`flex items-center justify-between px-3 py-2 border-b ${bt.border} shrink-0`}
            >
                <div className="flex items-center gap-3 text-xs">
                    <span className={`${bt.muted}`}>
                        {events.length} event{events.length === 1 ? "" : "s"}
                        {errorsOnly && events.length > 0 ? (
                            <>
                                {" "}
                                ·{" "}
                                <span className={`${bt.status.error.icon}`}>
                                    {filtered.length} error
                                    {filtered.length === 1 ? "" : "s"}
                                </span>
                            </>
                        ) : null}
                    </span>
                    <label
                        className={`flex items-center gap-1.5 ${bt.muted} cursor-pointer hover:opacity-100`}
                    >
                        <input
                            type="checkbox"
                            checked={errorsOnly}
                            onChange={(e) => setErrorsOnly(e.target.checked)}
                            className="h-3 w-3"
                        />
                        Errors only
                    </label>
                </div>
                <button
                    onClick={onClear}
                    className={`px-2 py-1 text-xs rounded ${bt.surface} ${bt.hoverSurface} ${bt.text} transition-colors`}
                    data-testid="console-clear"
                >
                    Clear
                </button>
            </div>
            {filtered.length === 0 ? (
                <div
                    className={`flex-1 flex items-center justify-center ${bt.muted} text-xs`}
                >
                    {events.length === 0
                        ? "No console output yet — interact with the preview to see logs."
                        : "No errors. Toggle off 'Errors only' to see all output."}
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto font-mono text-xs">
                    {filtered.map((evt, idx) => (
                        <div
                            key={idx}
                            className={`px-3 py-1.5 ${severityClasses(
                                evt.severity,
                                bt
                            )} ${bt.hoverSurface}`}
                            data-testid="console-row"
                        >
                            <div className="flex items-baseline gap-2">
                                <span className={`${bt.muted} flex-shrink-0`}>
                                    {formatTime(evt.timestamp)}
                                </span>
                                <span className="uppercase text-[10px] font-semibold flex-shrink-0">
                                    {evt.severity}
                                </span>
                                {evt.source && evt.source !== "console" && (
                                    <span
                                        className={`text-[10px] ${bt.muted} flex-shrink-0`}
                                    >
                                        ({evt.source})
                                    </span>
                                )}
                                <div className="flex-1 min-w-0 whitespace-pre-wrap break-words">
                                    {(evt.args || []).map((arg, i) => (
                                        <span key={i}>
                                            {i > 0 ? " " : ""}
                                            {formatArg(arg)}
                                        </span>
                                    ))}
                                </div>
                                {evt.severity === "error" &&
                                    typeof onSendErrorToAI === "function" && (
                                        <button
                                            type="button"
                                            onClick={() => onSendErrorToAI(evt)}
                                            className={`flex-shrink-0 text-[10px] ${bt.accent} hover:opacity-80 underline cursor-pointer`}
                                            data-testid="console-send-to-ai"
                                            title="Push this error into the chat as a fix request"
                                        >
                                            Send error to AI
                                        </button>
                                    )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default WidgetConsolePane;
