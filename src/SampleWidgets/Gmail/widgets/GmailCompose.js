/**
 * GmailCompose
 *
 * Compose and send emails via the Gmail MCP provider.
 * Listens for emailSelected events to pre-fill reply-to.
 *
 * @package Gmail
 */
import { useState, useEffect, useContext } from "react";
import {
    Button,
    Panel,
    SubHeading2,
    SubHeading3,
    AlertBanner,
    Caption2,
    InputText,
    TextArea,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { McpDebugLog } from "../components/McpDebugLog";
import { McpReauthBanner } from "../components/McpReauthBanner";
import { extractMcpText, safeParse } from "../utils/mcpUtils";

function GmailComposeContent({ title }) {
    const {
        isConnected,
        isConnecting,
        error,
        tools,
        callTool,
        status,
        provider,
        connect,
        disconnect,
    } = useMcpProvider("gmail");
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();

    const { listen } = useWidgetEvents();

    const [to, setTo] = useState("");
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [debugLog, setDebugLog] = useState([]);

    useEffect(() => {
        const unsubscribe = listen("emailSelected", (payload) => {
            if (payload) {
                setTo(payload.from || "");
                setSubject(
                    payload.subject
                        ? `Re: ${payload.subject.replace(/^Re:\s*/i, "")}`
                        : ""
                );
            }
        });
        return unsubscribe;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSend = async () => {
        if (!to.trim() || !subject.trim()) return;
        setLoading(true);
        setResult(null);
        const entry = {
            id: Date.now(),
            timestamp: new Date(),
            toolName: "send_email",
            args: { to: to.trim(), subject: subject.trim(), body: body.trim() },
            response: null,
            error: null,
            duration: 0,
        };
        const start = Date.now();
        try {
            const res = await callTool("send_email", {
                to: to.trim(),
                subject: subject.trim(),
                body: body.trim(),
            });
            entry.response = res;
            entry.duration = Date.now() - start;
            const text = extractMcpText(res);
            const parsed = safeParse(text);

            if (
                res?.isError ||
                (typeof parsed === "string" &&
                    parsed.toLowerCase().startsWith("error"))
            ) {
                setResult({
                    type: "error",
                    text: typeof parsed === "string" ? parsed : text,
                });
                return;
            }

            setResult({ type: "success", text: "Email sent successfully." });
            setTo("");
            setSubject("");
            setBody("");
        } catch (err) {
            entry.error = err.message;
            entry.duration = Date.now() - start;
            setResult({ type: "error", text: err.message });
        } finally {
            setDebugLog((prev) => [entry, ...prev]);
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
                <SubHeading3 title="Compose Email" />
                <InputText
                    type="text"
                    value={to}
                    onChange={(value) => setTo(value)}
                    placeholder="To..."
                    height="h-7"
                    padding="px-2 py-1"
                    inputClassName="text-xs"
                />
                <InputText
                    type="text"
                    value={subject}
                    onChange={(value) => setSubject(value)}
                    placeholder="Subject..."
                    height="h-7"
                    padding="px-2 py-1"
                    inputClassName="text-xs"
                />
                <TextArea
                    value={body}
                    onChange={(value) => setBody(value)}
                    placeholder="Message body..."
                    rows={6}
                    padding="px-2 py-1"
                    inputClassName="text-xs rounded resize-none"
                />
                <Button
                    size="sm"
                    onClick={handleSend}
                    disabled={
                        !isConnected || loading || !to.trim() || !subject.trim()
                    }
                >
                    {loading ? "Sending..." : "Send"}
                </Button>
            </div>

            {/* Success */}
            {result?.type === "success" && (
                <AlertBanner
                    variant="success"
                    size="compact"
                    message={result.text}
                />
            )}

            <McpReauthBanner
                error={result?.type === "error" ? result.text : null}
                provider={provider}
                catalogId="gmail"
                connect={connect}
                disconnect={disconnect}
                onReauthComplete={() => setResult(null)}
            />

            {/* Error */}
            {result?.type === "error" && (
                <AlertBanner
                    variant="error"
                    size="compact"
                    message={result.text}
                />
            )}

            <McpDebugLog entries={debugLog} />
        </div>
    );
}

export const GmailCompose = ({ title = "Compose Email", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GmailComposeContent title={title} />
            </Panel>
        </Widget>
    );
};
