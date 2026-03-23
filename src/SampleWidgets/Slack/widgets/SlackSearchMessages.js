/**
 * SlackSearchMessages
 *
 * Search Slack messages across channels.
 * Publishes messageSelected when a result is clicked.
 *
 * @package Slack
 */
import { useState } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { parseMcpResponse } from "../../_shared/mcpResponseParser";

function SlackSearchMessagesContent({ title, widgetId }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("slack");
    const { publishEvent } = useWidgetEvents();

    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [selectedTs, setSelectedTs] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await callTool("slack_search_messages", {
                query: query.trim(),
            });
            const { data, error: mcpError } = parseMcpResponse(res, {
                arrayKeys: ["messages.matches", "matches", "messages"],
            });
            if (mcpError) {
                setResult({ type: "error", text: mcpError });
                return;
            }
            const matches = Array.isArray(data) ? data : [];
            setResults(matches);
            setResult({
                type: "success",
                text: `${matches.length} result(s) found`,
            });
        } catch (err) {
            setResult({ type: "error", text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleSelectMessage = (msg) => {
        const ts = msg.ts || msg.timestamp;
        setSelectedTs(ts);
        publishEvent("messageSelected", {
            ts,
            channel: msg.channel?.id || msg.channel || "",
            text: msg.text || "",
            user: msg.user || msg.username || "unknown",
        });
    };

    const formatTimestamp = (ts) => {
        if (!ts) return "";
        try {
            const date = new Date(parseFloat(ts) * 1000);
            return date.toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return ts;
        }
    };

    return (
        <div className="flex flex-col gap-4 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

            {/* Connection Status */}
            <div className="flex items-center gap-2 text-xs">
                <span
                    className={`inline-block w-2 h-2 rounded-full ${
                        isConnected
                            ? "bg-green-500"
                            : isConnecting
                            ? "bg-yellow-500 animate-pulse"
                            : error
                            ? "bg-red-500"
                            : "bg-gray-500"
                    }`}
                />
                <span className="text-gray-400 font-mono">{status}</span>
                <span className="text-gray-600">({tools.length} tools)</span>
            </div>

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {/* Search Input */}
            <div className="space-y-2">
                <SubHeading3 title="Search Messages" />
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="Search Slack messages..."
                        className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={!isConnected || loading || !query.trim()}
                        className="px-3 py-1 text-xs rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        {loading ? "Searching..." : "Search"}
                    </button>
                </div>
            </div>

            {/* Results */}
            {results.length > 0 && (
                <div className="flex-1 overflow-y-auto space-y-2">
                    {results.map((msg, i) => (
                        <button
                            key={msg.ts || i}
                            onClick={() => handleSelectMessage(msg)}
                            className={`w-full text-left px-2 py-2 rounded text-xs transition-colors ${
                                selectedTs === (msg.ts || msg.timestamp)
                                    ? "bg-purple-900/50 border border-purple-500"
                                    : "bg-white/5 hover:bg-white/10"
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-purple-300 font-semibold">
                                    {msg.user || msg.username || "unknown"}
                                </span>
                                <span className="text-gray-600">in</span>
                                <span className="text-gray-400">
                                    #{msg.channel?.name || msg.channel || ""}
                                </span>
                                <span className="text-gray-500">
                                    {formatTimestamp(msg.ts || msg.timestamp)}
                                </span>
                            </div>
                            <div className="text-gray-300 whitespace-pre-wrap break-words">
                                {msg.text || ""}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {!loading && results.length === 0 && query && (
                <div className="text-xs text-gray-500">
                    No results. Try a different search query.
                </div>
            )}

            {/* Result */}
            {result && (
                <div
                    className={`p-2 rounded text-xs border ${
                        result.type === "error"
                            ? "bg-red-900/30 border-red-700 text-red-300"
                            : "bg-green-900/30 border-green-700 text-green-300"
                    }`}
                >
                    <pre className="whitespace-pre-wrap overflow-auto max-h-32">
                        {result.text}
                    </pre>
                </div>
            )}
        </div>
    );
}

export const SlackSearchMessages = ({
    title = "Search Messages",
    widgetId,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <SlackSearchMessagesContent title={title} widgetId={widgetId} />
            </Panel>
        </Widget>
    );
};
