/**
 * WidgetConsolePane — Console-tab body for the AI Builder.
 *
 * Renders captured console.* + window.error + unhandledrejection
 * events from the widget under preview. Severities color-coded; each
 * row shows timestamp + source + serialized args. A small toolbar
 * lets the user clear or filter to errors only.
 */
import React, { useMemo, useState } from "react";

function severityClasses(sev) {
    switch (sev) {
        case "error":
            return "text-red-300 border-l-2 border-red-500";
        case "warn":
            return "text-amber-300 border-l-2 border-amber-500";
        case "info":
            return "text-sky-300 border-l-2 border-sky-500";
        case "debug":
            return "text-gray-400 border-l-2 border-gray-500";
        default:
            return "text-gray-200 border-l-2 border-gray-700";
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

export const WidgetConsolePane = ({ events = [], onClear }) => {
    const [errorsOnly, setErrorsOnly] = useState(false);
    const filtered = useMemo(
        () =>
            errorsOnly ? events.filter((e) => e.severity === "error") : events,
        [events, errorsOnly]
    );

    return (
        <div className="flex flex-col h-full bg-gray-950 text-gray-200">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800 shrink-0">
                <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-400">
                        {events.length} event{events.length === 1 ? "" : "s"}
                        {errorsOnly && events.length > 0 ? (
                            <>
                                {" "}
                                ·{" "}
                                <span className="text-red-300">
                                    {filtered.length} error
                                    {filtered.length === 1 ? "" : "s"}
                                </span>
                            </>
                        ) : null}
                    </span>
                    <label className="flex items-center gap-1.5 text-gray-400 cursor-pointer hover:text-gray-200">
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
                    className="px-2 py-1 text-xs rounded bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors"
                    data-testid="console-clear"
                >
                    Clear
                </button>
            </div>
            {filtered.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-500 text-xs">
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
                                evt.severity
                            )} hover:bg-gray-900`}
                            data-testid="console-row"
                        >
                            <div className="flex items-baseline gap-2">
                                <span className="text-gray-500 flex-shrink-0">
                                    {formatTime(evt.timestamp)}
                                </span>
                                <span className="uppercase text-[10px] font-semibold flex-shrink-0">
                                    {evt.severity}
                                </span>
                                {evt.source && evt.source !== "console" && (
                                    <span className="text-[10px] text-gray-500 flex-shrink-0">
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
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default WidgetConsolePane;
