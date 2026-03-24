/**
 * SlackPostMessage
 *
 * Compose and send messages to a Slack channel.
 * Listens for channelSelected events to pre-fill the target channel.
 *
 * @package Slack
 */
import { useState, useEffect } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { extractMcpText, isMcpError } from "../utils/mcpUtils";

function SlackPostMessageContent({ title, widgetId }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("slack");
    const { listen, listeners } = useWidgetEvents();

    const [channelId, setChannelId] = useState("");
    const [channelName, setChannelName] = useState("");
    const [message, setMessage] = useState("");
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

    const handleSendMessage = async () => {
        if (!channelId || !message.trim()) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await callTool("slack_post_message", {
                channel_id: channelId,
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

            {/* Compose Form */}
            <div className="space-y-2">
                <SubHeading3 title="Compose Message" />

                {/* Channel Display */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">To:</span>
                    {channelName ? (
                        <span className="text-xs text-purple-300 font-semibold">
                            #{channelName}
                        </span>
                    ) : (
                        <span className="text-xs text-gray-500">
                            No channel selected
                        </span>
                    )}
                </div>

                {/* Message Input */}
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            handleSendMessage();
                        }
                    }}
                    placeholder={
                        channelId
                            ? "Type your message... (Cmd+Enter to send)"
                            : "Select a channel first"
                    }
                    disabled={!channelId}
                    rows={4}
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 disabled:opacity-50 resize-none"
                />

                {/* Send Button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleSendMessage}
                        disabled={
                            !isConnected ||
                            loading ||
                            !channelId ||
                            !message.trim()
                        }
                        className="px-3 py-1 text-xs rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        {loading ? "Sending..." : "Send Message"}
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

export const SlackPostMessage = ({
    title = "Post Message",
    widgetId,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <SlackPostMessageContent title={title} widgetId={widgetId} />
            </Panel>
        </Widget>
    );
};
