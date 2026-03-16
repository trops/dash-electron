/**
 * SocketWidget
 *
 * WebSocket connection lifecycle and message exchange via the
 * useWebSocketProvider hook. Requires a "websocket" provider to be
 * configured and selected — the same provider can be shared across
 * multiple widgets.
 *
 * @package DashSamples
 */
import { useState, useCallback } from "react";
import { Panel, SubHeading2 } from "@trops/dash-react";
import { Widget, useWebSocketProvider } from "@trops/dash-core";

const STATUS_STYLES = {
    disconnected: "bg-gray-500",
    connecting: "bg-yellow-500",
    connected: "bg-green-500",
    error: "bg-red-500",
};

function SocketWidgetContent({ title }) {
    const {
        isConnected,
        isConnecting,
        isReconnecting,
        retryCount,
        error,
        messages: receivedMessages,
        send,
        connect,
        disconnect,
        status,
        serverName,
    } = useWebSocketProvider("websocket", { autoConnect: false });

    const [sentMessages, setSentMessages] = useState([]);
    const [input, setInput] = useState("");

    // Merge sent + received into a single log, newest first
    const allMessages = [
        ...sentMessages,
        ...receivedMessages.map((msg) => ({
            direction: "received",
            text: typeof msg === "string" ? msg : JSON.stringify(msg),
            timestamp: new Date().toLocaleTimeString(),
        })),
    ]
        .sort((a, b) => b._ts - a._ts)
        .slice(0, 50);

    const handleSend = useCallback(async () => {
        if (!input.trim() || !isConnected) return;
        const text = input.trim();
        try {
            await send(text);
            setSentMessages((prev) => [
                {
                    direction: "sent",
                    text,
                    timestamp: new Date().toLocaleTimeString(),
                    _ts: Date.now(),
                },
                ...prev.slice(0, 49),
            ]);
            setInput("");
        } catch (err) {
            console.error("[SocketWidget] send failed:", err?.message);
        }
    }, [input, isConnected, send]);

    const handleKeyDown = useCallback(
        (e) => {
            if (e.key === "Enter") {
                handleSend();
            }
        },
        [handleSend]
    );

    const displayStatus = isReconnecting
        ? `reconnecting (${retryCount})`
        : status;
    const statusColor =
        STATUS_STYLES[isReconnecting ? "connecting" : status] ||
        STATUS_STYLES.disconnected;

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex items-center justify-between">
                <SubHeading2 title={title} />
                <div className="flex items-center gap-2">
                    <span
                        className={`w-2.5 h-2.5 rounded-full ${statusColor}`}
                    />
                    <span className="text-xs text-gray-400">
                        {displayStatus}
                    </span>
                </div>
            </div>

            {serverName && (
                <div className="text-xs text-gray-500 font-mono truncate">
                    Provider: {serverName}
                </div>
            )}

            {error && (
                <div className="text-xs text-red-400 bg-red-900/30 rounded px-2 py-1">
                    {error}
                </div>
            )}

            <div className="flex items-center gap-2">
                <button
                    onClick={connect}
                    disabled={isConnected || isConnecting}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-md text-sm font-medium transition-colors"
                >
                    Connect
                </button>
                <button
                    onClick={disconnect}
                    disabled={!isConnected && !isConnecting}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-md text-sm font-medium transition-colors"
                >
                    Disconnect
                </button>
            </div>

            <div className="flex items-center gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    disabled={!isConnected}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                />
                <button
                    onClick={handleSend}
                    disabled={!isConnected || !input.trim()}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-md text-sm font-medium transition-colors"
                >
                    Send
                </button>
            </div>

            <div className="flex-1 min-h-0">
                <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">
                    Messages
                </div>
                <div className="overflow-y-auto max-h-48 space-y-1">
                    {allMessages.length === 0 ? (
                        <div className="text-xs text-gray-600 italic">
                            No messages yet. Connect and send a message.
                        </div>
                    ) : (
                        allMessages.map((entry, i) => (
                            <div
                                key={i}
                                className="text-xs font-mono bg-gray-800/50 rounded px-2 py-1"
                            >
                                <span className="text-gray-500">
                                    {entry.timestamp}
                                </span>{" "}
                                <span
                                    className={
                                        entry.direction === "sent"
                                            ? "text-cyan-400"
                                            : "text-green-400"
                                    }
                                >
                                    {entry.direction === "sent" ? "→" : "←"}
                                </span>{" "}
                                <span className="text-gray-300">
                                    {entry.text}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export const SocketWidget = ({ title = "Socket Connection", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <SocketWidgetContent title={title} />
            </Panel>
        </Widget>
    );
};
