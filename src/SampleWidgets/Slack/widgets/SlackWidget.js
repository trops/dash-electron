/**
 * SlackWidget
 *
 * List channels and send messages via the Slack MCP provider.
 * Requires a Slack MCP provider to be configured.
 *
 * @package Slack
 */
import { useState } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider } from "@trops/dash-core";
import {
    parseMcpResponse,
    extractMcpText,
    isMcpError,
    parseSlackTextEntries,
} from "../utils/mcpUtils";

function SlackContent({ title }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("slack");

    const [channels, setChannels] = useState([]);
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [message, setMessage] = useState("");
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleListChannels = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await callTool("slack_list_channels", {});
            const { data, error: mcpError } = parseMcpResponse(res, {
                arrayKeys: ["channels"],
                textParser: parseSlackTextEntries,
            });
            if (mcpError) {
                setResult({ type: "error", text: mcpError });
                return;
            }
            const list = Array.isArray(data) ? data : [];
            setChannels(list);
            setResult({
                type: list.length > 0 ? "success" : "error",
                text:
                    list.length > 0
                        ? `${list.length} channel(s) loaded`
                        : "No channels found",
            });
        } catch (err) {
            setResult({ type: "error", text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!selectedChannel || !message.trim()) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await callTool("slack_post_message", {
                channel_id: selectedChannel,
                text: message.trim(),
            });
            const text = extractMcpText(res);
            const errorMsg = isMcpError(res, text);
            if (errorMsg) {
                setResult({ type: "error", text: errorMsg });
                return;
            }
            setResult({ type: "success", text });
            setMessage("");
        } catch (err) {
            setResult({ type: "error", text: err.message });
        } finally {
            setLoading(false);
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

            {/* List Channels */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <SubHeading3 title="Channels" />
                    <button
                        onClick={handleListChannels}
                        disabled={!isConnected || loading}
                        className="px-3 py-1 text-xs rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        {loading ? "Loading..." : "List Channels"}
                    </button>
                </div>
                {channels.length > 0 && (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                        {channels.map((ch, i) => (
                            <button
                                key={ch.id || i}
                                onClick={() => setSelectedChannel(ch.id || ch)}
                                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                                    selectedChannel === (ch.id || ch)
                                        ? "bg-purple-900/50 border border-purple-500"
                                        : "bg-white/5 hover:bg-white/10"
                                }`}
                            >
                                <span className="text-gray-300">
                                    #{ch.name || ch.id || ch}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Send Message */}
            <div className="space-y-2">
                <SubHeading3 title="Send Message" />
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) =>
                            e.key === "Enter" && handleSendMessage()
                        }
                        placeholder={
                            selectedChannel
                                ? "Type a message..."
                                : "Select a channel first"
                        }
                        disabled={!selectedChannel}
                        className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={
                            !isConnected ||
                            loading ||
                            !selectedChannel ||
                            !message.trim()
                        }
                        className="px-3 py-1 text-xs rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        Send
                    </button>
                </div>
            </div>

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

export const SlackWidget = ({ title = "Slack", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <SlackContent title={title} />
            </Panel>
        </Widget>
    );
};
