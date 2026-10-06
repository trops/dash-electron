/**
 * GmailInbox
 *
 * Displays inbox emails via the Gmail MCP provider.
 * Publishes emailSelected events when an email is clicked.
 *
 * @package Gmail
 */
import { useState, useEffect, useContext } from "react";
import {
    Button2,
    Panel,
    SubHeading2,
    SubHeading3,
    AlertBanner,
    Caption2,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { McpDebugLog } from "../components/McpDebugLog";
import { McpReauthBanner } from "../components/McpReauthBanner";
import {
    extractMcpText,
    safeParse,
    parseSearchResults,
} from "../utils/mcpUtils";

function GmailInboxContent({ title }) {
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

    const { publishEvent } = useWidgetEvents();

    const [emails, setEmails] = useState([]);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [debugLog, setDebugLog] = useState([]);

    const fetchInbox = async () => {
        setLoading(true);
        setResult(null);
        const entry = {
            id: Date.now(),
            timestamp: new Date(),
            toolName: "search_emails",
            args: { query: "is:inbox" },
            response: null,
            error: null,
            duration: 0,
        };
        const start = Date.now();
        try {
            const res = await callTool("search_emails", {
                query: "is:inbox",
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

            let list = Array.isArray(parsed)
                ? parsed
                : parsed?.messages || parsed?.emails || null;
            if (
                !list ||
                (typeof parsed === "string" && parsed.includes("ID:"))
            ) {
                list = parseSearchResults(text);
            }
            setEmails(list || []);
        } catch (err) {
            entry.error = err.message;
            entry.duration = Date.now() - start;
            setResult({ type: "error", text: err.message });
        } finally {
            setDebugLog((prev) => [entry, ...prev]);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isConnected) {
            fetchInbox();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected]);

    const handleSelectEmail = (email) => {
        publishEvent("emailSelected", {
            id: email.id || email.messageId,
            subject: email.subject || "(no subject)",
            from: email.from || email.sender || "Unknown",
            date: email.date || "",
        });
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

            {/* Refresh */}
            <div className="flex items-center justify-between">
                <SubHeading3 title="Inbox" />
                <Button2
                    size="sm"
                    onClick={fetchInbox}
                    disabled={!isConnected || loading}
                >
                    {loading ? "Loading..." : "Refresh"}
                </Button2>
            </div>

            {/* Email List */}
            {emails.length > 0 && (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                    {emails.map((email, i) => (
                        <button
                            key={email.id || i}
                            onClick={() => handleSelectEmail(email)}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                currentTheme?.["bg-primary-dark"] || ""
                            } ${currentTheme?.["hover-bg-primary-dark"] || ""}`}
                        >
                            <div className="flex items-center gap-2">
                                {email.unread && (
                                    <span
                                        className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                                            currentTheme?.[
                                                "bg-secondary-medium"
                                            ] || ""
                                        }`}
                                    />
                                )}
                                <span
                                    className={`font-medium truncate ${
                                        currentTheme?.["text-primary-medium"] ||
                                        ""
                                    }`}
                                >
                                    {email.from || email.sender || "Unknown"}
                                </span>
                                {email.date && (
                                    <Caption2 className="ml-auto flex-shrink-0">
                                        {email.date}
                                    </Caption2>
                                )}
                            </div>
                            <div
                                className={`truncate opacity-80 ${
                                    currentTheme?.["text-primary-medium"] || ""
                                }`}
                            >
                                {email.subject || "(no subject)"}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {emails.length === 0 && !loading && !result && (
                <Caption2 block className="text-center py-4">
                    No inbox emails loaded yet.
                </Caption2>
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

export const GmailInbox = ({ title = "Gmail Inbox", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GmailInboxContent title={title} />
            </Panel>
        </Widget>
    );
};
