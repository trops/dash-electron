/**
 * SlackChannelMessages
 *
 * Displays message history for a Slack channel.
 * Listens for channelSelected events to auto-refresh.
 * Publishes messageSelected when a message is clicked.
 *
 * @package Slack
 */
import { useState, useEffect } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { parseMcpResponse } from "../utils/mcpUtils";

function SlackChannelMessagesContent({ title, widgetId }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("slack");
    const { publishEvent, listen, listeners } = useWidgetEvents();

    const [channelId, setChannelId] = useState(null);
    const [channelName, setChannelName] = useState(null);
    const [messages, setMessages] = useState([]);
    const [selectedTs, setSelectedTs] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        listen(listeners, {
            channelSelected: (payload) => {
                setChannelId(payload.id);
                setChannelName(payload.name);
            },
        });
    }, [listen, listeners]);

    const fetchMessages = async (id) => {
        if (!id) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await callTool("slack_get_channel_history", {
                channel_id: id,
            });
            const { data, error: mcpError } = parseMcpResponse(res, {
                arrayKeys: ["messages"],
            });
            if (mcpError) {
                setResult({ type: "error", text: mcpError });
                return;
            }
            const list = Array.isArray(data) ? data : [];
            setMessages(list);
            setResult({
                type: list.length > 0 ? "success" : "error",
                text:
                    list.length > 0
                        ? `${list.length} message(s) loaded`
                        : "No messages found",
            });
        } catch (err) {
            setResult({ type: "error", text: err.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isConnected && channelId) {
            fetchMessages(channelId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected, channelId]);

    const handleSelectMessage = (msg) => {
        const ts = msg.ts || msg.timestamp;
        setSelectedTs(ts);
        publishEvent("messageSelected", {
            ts,
            channel: channelId,
            text: msg.text || "",
            user: msg.user || msg.username || "unknown",
        });
    };

    const formatTimestamp = (ts) => {
        if (!ts) return "";
        try {
            const date = new Date(parseFloat(ts) * 1000);
            return date.toLocaleTimeString([], {
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

            {/* Channel Info */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <SubHeading3
                        title={
                            channelName
                                ? `#${channelName}`
                                : "No channel selected"
                        }
                    />
                    <button
                        onClick={() => fetchMessages(channelId)}
                        disabled={!isConnected || loading || !channelId}
                        className="px-3 py-1 text-xs rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        {loading ? "Loading..." : "Refresh"}
                    </button>
                </div>
            </div>

            {/* Messages */}
            {messages.length > 0 && (
                <div className="flex-1 overflow-y-auto space-y-2">
                    {messages.map((msg, i) => (
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

            {!loading && !channelId && (
                <div className="text-xs text-gray-500">
                    Select a channel to view messages.
                </div>
            )}

            {!loading && channelId && messages.length === 0 && (
                <div className="text-xs text-gray-500">No messages found.</div>
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

export const SlackChannelMessages = ({
    title = "Channel Messages",
    widgetId,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <SlackChannelMessagesContent
                    title={title}
                    widgetId={widgetId}
                />
            </Panel>
        </Widget>
    );
};
