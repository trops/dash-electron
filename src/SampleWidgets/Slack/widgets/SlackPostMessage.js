/**
 * SlackPostMessage
 *
 * Compose and send messages to a Slack channel.
 * Listens for channelSelected events to pre-fill the target channel.
 *
 * @package Slack
 */
import { useState, useEffect, useContext } from "react";
import {
    AlertBanner,
    Button,
    Caption2,
    Panel,
    SubHeading2,
    SubHeading3,
    TextArea,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { extractMcpText, isMcpError } from "../utils/mcpUtils";

function SlackPostMessageContent({ title, widgetId }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("slack");
    const { listen, listeners } = useWidgetEvents();
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();

    const [channelId, setChannelId] = useState("");
    const [channelName, setChannelName] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        listen(listeners, {
            // DashboardPublisher wraps the published value in
            // { message, event, uuid } — unwrap before reading fields,
            // otherwise payload.id / payload.name come back undefined.
            channelSelected: (envelope) => {
                const payload = envelope?.message || envelope;
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
            const res = await callTool("conversations_add_message", {
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

            {/* Compose Form */}
            <div className="space-y-2">
                <SubHeading3 title="Compose Message" />

                {/* Channel Display */}
                <div className="flex items-center gap-2">
                    <Caption2>To:</Caption2>
                    {channelName ? (
                        <span
                            className={`text-xs font-semibold ${
                                currentTheme?.["text-secondary-medium"] || ""
                            }`}
                        >
                            #{channelName}
                        </span>
                    ) : (
                        <Caption2>No channel selected</Caption2>
                    )}
                </div>

                {/* Message Input */}
                <TextArea
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
                    padding="px-2 py-1"
                    inputClassName="text-xs rounded disabled:opacity-50 resize-none"
                />

                {/* Send Button */}
                <div className="flex justify-end">
                    <Button
                        size="sm"
                        onClick={handleSendMessage}
                        disabled={
                            !isConnected ||
                            loading ||
                            !channelId ||
                            !message.trim()
                        }
                    >
                        {loading ? "Sending..." : "Send Message"}
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
