import { useState } from "react";

function formatTime(date) {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function JsonBlock({ data }) {
    const text =
        typeof data === "string" ? data : JSON.stringify(data, null, 2);
    return (
        <pre className="p-1.5 bg-black/30 rounded mt-1 whitespace-pre-wrap break-words overflow-hidden">
            {text}
        </pre>
    );
}

function DebugEntry({ entry }) {
    const [open, setOpen] = useState(false);
    const isError = !!entry.error;

    return (
        <div className="border-b border-gray-800 last:border-b-0">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center gap-1.5 py-1 px-1 text-left hover:bg-white/5 transition-colors"
            >
                <span
                    className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        isError ? "bg-red-500" : "bg-green-500"
                    }`}
                />
                <span className="text-gray-500">
                    {formatTime(entry.timestamp)}
                </span>
                <span className="text-gray-300 truncate">{entry.toolName}</span>
                <span className="text-gray-600 ml-auto flex-shrink-0">
                    {entry.duration}ms
                </span>
                <span className="text-gray-600 flex-shrink-0">
                    {open ? "\u25B4" : "\u25BE"}
                </span>
            </button>
            {open && (
                <div className="px-1 pb-2 space-y-1.5">
                    <div>
                        <span className="text-gray-500">Request:</span>
                        <JsonBlock data={entry.args} />
                    </div>
                    <div>
                        <span
                            className={
                                isError ? "text-red-400" : "text-gray-500"
                            }
                        >
                            {isError ? "Error:" : "Response:"}
                        </span>
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
    const [open, setOpen] = useState(false);

    if (entries.length === 0) return null;

    return (
        <div className="border-t border-gray-700/50 mt-2 pt-1 text-[10px] font-mono">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 w-full text-left py-1 text-gray-500 hover:text-gray-400 transition-colors"
            >
                <span>{open ? "\u25B4" : "\u25BE"}</span>
                <span>Debug ({entries.length})</span>
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
