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
import { useState, useCallback, useContext } from "react";
import {
    Panel,
    SubHeading2,
    Button,
    Button2,
    SectionLabel,
    AlertBanner,
    Caption2,
    InputText,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useWebSocketProvider } from "@trops/dash-core";

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
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();

    const STATUS_STYLES = {
        disconnected: currentTheme?.["bg-primary-medium"] || "",
        connecting: statusTokens.warning.solidBg,
        connected: statusTokens.success.solidBg,
        error: statusTokens.error.solidBg,
    };

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
                    <Caption2>{displayStatus}</Caption2>
                </div>
            </div>

            {serverName && (
                <Caption2 block className="font-mono truncate">
                    Provider: {serverName}
                </Caption2>
            )}

            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
            )}

            <div className="flex items-center gap-2">
                <Button
                    onClick={connect}
                    disabled={isConnected || isConnecting}
                >
                    Connect
                </Button>
                <Button2
                    onClick={disconnect}
                    disabled={!isConnected && !isConnecting}
                    danger
                >
                    Disconnect
                </Button2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <InputText
                    type="text"
                    value={input}
                    onChange={(value) => setInput(value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    disabled={!isConnected}
                    className="flex-1 min-w-0"
                    inputClassName="text-sm"
                />
                <Button
                    onClick={handleSend}
                    disabled={!isConnected || !input.trim()}
                >
                    Send
                </Button>
            </div>

            <div className="flex-1 min-h-0">
                <SectionLabel className="mb-1">Messages</SectionLabel>
                <div className="overflow-y-auto max-h-48 space-y-1">
                    {allMessages.length === 0 ? (
                        <Caption2 block className="italic">
                            No messages yet. Connect and send a message.
                        </Caption2>
                    ) : (
                        allMessages.map((entry, i) => (
                            <div
                                key={i}
                                className={`text-xs font-mono ${
                                    currentTheme?.["bg-primary-dark"] || ""
                                } ${
                                    currentTheme?.["text-primary-medium"] || ""
                                } rounded px-2 py-1`}
                            >
                                <Caption2 className="font-mono">
                                    {entry.timestamp}
                                </Caption2>{" "}
                                <span
                                    className={
                                        entry.direction === "sent"
                                            ? currentTheme?.[
                                                  "text-secondary-medium"
                                              ] || ""
                                            : statusTokens.success.icon
                                    }
                                >
                                    {entry.direction === "sent" ? "→" : "←"}
                                </span>{" "}
                                <span>{entry.text}</span>
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
