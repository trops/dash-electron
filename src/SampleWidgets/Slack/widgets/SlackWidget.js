/**
 * SlackWidget
 *
 * List channels and send messages via the Slack MCP provider.
 * Requires a Slack MCP provider to be configured.
 *
 * @package Slack
 */
import { useState, useContext } from "react";
import {
    AlertBanner,
    Button,
    Button2,
    Caption2,
    InputText,
    Panel,
    SubHeading2,
    SubHeading3,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
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
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();

    const [channels, setChannels] = useState([]);
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [message, setMessage] = useState("");
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleListChannels = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await callTool("channels_list", {});
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
            const res = await callTool("conversations_add_message", {
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

    const rowSurface = `${currentTheme?.["bg-primary-dark"] || ""} ${
        currentTheme?.["hover-bg-primary-dark"] || ""
    }`;
    const selectedSurface = `border ${
        currentTheme?.["bg-secondary-dark"] || ""
    } ${currentTheme?.["text-secondary-light"] || ""} ${
        currentTheme?.["border-secondary-medium"] || ""
    }`;
    const bodyText = currentTheme?.["text-primary-medium"] || "";

    return (
        <div className="flex flex-col gap-4 h-full text-sm overflow-y-auto">
            <SubHeading2 title={title} />

            {/* Connection Status */}
            <div className="flex items-center gap-2 text-xs">
                <span
                    className={`inline-block w-2 h-2 rounded-full ${
                        isConnected
                            ? statusTokens.success.solidBg
                            : isConnecting
                            ? `${statusTokens.warning.solidBg} animate-pulse`
                            : error
                            ? statusTokens.error.solidBg
                            : currentTheme?.["bg-primary-medium"] || ""
                    }`}
                />
                <Caption2 className="font-mono">{status}</Caption2>
                <Caption2 className="opacity-70">
                    ({tools.length} tools)
                </Caption2>
            </div>

            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
            )}

            {/* List Channels */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <SubHeading3 title="Channels" />
                    <Button2
                        size="sm"
                        onClick={handleListChannels}
                        disabled={!isConnected || loading}
                    >
                        {loading ? "Loading..." : "List Channels"}
                    </Button2>
                </div>
                {channels.length > 0 && (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                        {channels.map((ch, i) => (
                            <button
                                key={ch.id || i}
                                onClick={() => setSelectedChannel(ch.id || ch)}
                                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                                    selectedChannel === (ch.id || ch)
                                        ? selectedSurface
                                        : `${rowSurface} ${bodyText}`
                                }`}
                            >
                                <span>#{ch.name || ch.id || ch}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Send Message */}
            <div className="space-y-2">
                <SubHeading3 title="Send Message" />
                <div className="flex flex-wrap items-center gap-2">
                    <InputText
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
                        className="flex-1 min-w-0"
                        height="h-7"
                        padding="px-2 py-1"
                        inputClassName="text-xs disabled:opacity-50"
                    />
                    <Button
                        size="sm"
                        onClick={handleSendMessage}
                        disabled={
                            !isConnected ||
                            loading ||
                            !selectedChannel ||
                            !message.trim()
                        }
                    >
                        Send
                    </Button>
                </div>
            </div>

            {/* Result */}
            {result && (
                <AlertBanner variant={result.type} size="compact">
                    <pre className="whitespace-pre-wrap overflow-auto max-h-32">
                        {result.text}
                    </pre>
                </AlertBanner>
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
