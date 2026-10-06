import { useState, useContext } from "react";
import { Caption2, ThemeContext, useStatusTokens } from "@trops/dash-react";

function formatTime(date) {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function JsonBlock({ data }) {
    const { currentTheme } = useContext(ThemeContext);
    const text =
        typeof data === "string" ? data : JSON.stringify(data, null, 2);
    return (
        <pre
            className={`p-1.5 rounded mt-1 whitespace-pre-wrap break-words overflow-hidden font-mono ${
                currentTheme?.["bg-primary-dark"] || ""
            } ${currentTheme?.["text-primary-medium"] || ""}`}
        >
            {text}
        </pre>
    );
}

function DebugEntry({ entry }) {
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();
    const [open, setOpen] = useState(false);
    const isError = !!entry.error;

    return (
        <div
            className={`border-b last:border-b-0 ${
                currentTheme?.["border-primary-dark"] || ""
            }`}
        >
            <button
                onClick={() => setOpen(!open)}
                className={`w-full flex items-center gap-1.5 py-1 px-1 text-left transition-colors ${
                    currentTheme?.["hover-bg-primary-dark"] || ""
                }`}
            >
                <span
                    className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        isError
                            ? statusTokens.error.solidBg
                            : statusTokens.success.solidBg
                    }`}
                />
                <Caption2 className="font-mono">
                    {formatTime(entry.timestamp)}
                </Caption2>
                <span
                    className={`truncate ${
                        currentTheme?.["text-primary-medium"] || ""
                    }`}
                >
                    {entry.toolName}
                </span>
                <Caption2 className="font-mono opacity-70 ml-auto flex-shrink-0">
                    {entry.duration}ms
                </Caption2>
                <Caption2 className="opacity-70 flex-shrink-0">
                    {open ? "▴" : "▾"}
                </Caption2>
            </button>
            {open && (
                <div className="px-1 pb-2 space-y-1.5">
                    <div>
                        <Caption2 className="font-mono">Request:</Caption2>
                        <JsonBlock data={entry.args} />
                    </div>
                    <div>
                        {isError ? (
                            <span className={statusTokens.error.icon}>
                                Error:
                            </span>
                        ) : (
                            <Caption2 className="font-mono">Response:</Caption2>
                        )}
                        <JsonBlock
                            data={isError ? entry.error : entry.response}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

export function McpDebugLog({ entries }) {
    const { currentTheme } = useContext(ThemeContext);
    const [open, setOpen] = useState(false);

    if (entries.length === 0) return null;

    return (
        <div
            className={`border-t mt-2 pt-1 text-xs font-mono ${
                currentTheme?.["border-primary-dark"] || ""
            }`}
        >
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 w-full text-left py-1 transition-colors"
            >
                <Caption2 className="font-mono">{open ? "▴" : "▾"}</Caption2>
                <Caption2 className="font-mono">
                    Debug ({entries.length})
                </Caption2>
            </button>
            {open && (
                <div className="max-h-60 overflow-y-auto">
                    {entries.map((entry) => (
                        <DebugEntry key={entry.id} entry={entry} />
                    ))}
                </div>
            )}
        </div>
    );
}
