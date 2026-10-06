/**
 * GmailWidget
 *
 * Search and read emails via the Gmail MCP provider.
 * Requires a Gmail MCP provider to be configured.
 *
 * @package Gmail
 */
import { useState, useContext } from "react";
import {
    Button,
    Button3,
    Panel,
    SubHeading2,
    SubHeading3,
    AlertBanner,
    Caption2,
    ThemeContext,
    useStatusTokens,
    InputText,
} from "@trops/dash-react";
import { Widget, useMcpProvider } from "@trops/dash-core";
import { McpDebugLog } from "../components/McpDebugLog";
import { McpReauthBanner } from "../components/McpReauthBanner";
import {
    extractMcpText,
    safeParse,
    parseSearchResults,
    parseEmailBody,
} from "../utils/mcpUtils";

function GmailContent({ title, defaultQuery }) {
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

    const [query, setQuery] = useState(defaultQuery || "is:unread");
    const [emails, setEmails] = useState([]);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [emailBody, setEmailBody] = useState(null);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [debugLog, setDebugLog] = useState([]);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setResult(null);
        setSelectedEmail(null);
        setEmailBody(null);
        const entry = {
            id: Date.now(),
            timestamp: new Date(),
            toolName: "search_emails",
            args: { query: query.trim() },
            response: null,
            error: null,
            duration: 0,
        };
        const start = Date.now();
        try {
            const res = await callTool("search_emails", {
                query: query.trim(),
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

    const handleReadEmail = async (email) => {
        setSelectedEmail(email);
        setEmailBody(null);
        setLoading(true);
        const id = email.id || email.messageId;
        const entry = {
            id: Date.now(),
            timestamp: new Date(),
            toolName: "read_email",
            args: { messageId: id },
            response: null,
            error: null,
            duration: 0,
        };
        const start = Date.now();
        try {
            const res = await callTool("read_email", {
                messageId: id,
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

            if (typeof parsed === "string") {
                setEmailBody(parseEmailBody(parsed));
            } else {
                setEmailBody(parsed);
            }
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

            {/* Search */}
            <div className="space-y-2">
                <SubHeading3 title="Search Emails" />
                <div className="flex flex-wrap items-center gap-2">
                    <InputText
                        type="text"
                        value={query}
                        onChange={(value) => setQuery(value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="Gmail search query..."
                        className="flex-1 min-w-0"
                        height="h-7"
                        padding="px-2 py-1"
                        inputClassName="text-xs"
                    />
                    <Button
                        size="sm"
                        onClick={handleSearch}
                        disabled={!isConnected || loading}
                    >
                        Search
                    </Button>
                </div>
            </div>

            {/* Email List */}
            {emails.length > 0 && !emailBody && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                    {emails.map((email, i) => (
                        <button
                            key={email.id || i}
                            onClick={() => handleReadEmail(email)}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                currentTheme?.["bg-primary-dark"] || ""
                            } ${currentTheme?.["hover-bg-primary-dark"] || ""}`}
                        >
                            <div className="flex items-center gap-2">
                                <span
                                    className={`font-medium truncate ${
                                        currentTheme?.["text-primary-medium"] ||
                                        ""
                                    }`}
                                >
                                    {email.from || email.sender || "Unknown"}
                                </span>
                            </div>
                            <div
                                className={`truncate opacity-80 ${
                                    currentTheme?.["text-primary-medium"] || ""
                                }`}
                            >
                                {email.subject || "(no subject)"}
                            </div>
                            {email.snippet && (
                                <Caption2 block className="truncate mt-0.5">
                                    {email.snippet}
                                </Caption2>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Email Body */}
            {emailBody && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <SubHeading3
                            title={
                                emailBody.subject ||
                                selectedEmail?.subject ||
                                "Message"
                            }
                        />
                        <Button3
                            size="sm"
                            onClick={() => {
                                setEmailBody(null);
                                setSelectedEmail(null);
                            }}
                        >
                            Back
                        </Button3>
                    </div>
                    <Caption2 block>
                        From: {emailBody.from || selectedEmail?.from || "—"}
                    </Caption2>
                    <div
                        className={`p-2 rounded text-xs overflow-auto max-h-48 whitespace-pre-wrap ${
                            currentTheme?.["bg-primary-dark"] || ""
                        } ${currentTheme?.["text-primary-medium"] || ""}`}
                    >
                        {emailBody.body ||
                            emailBody.text ||
                            JSON.stringify(emailBody, null, 2)}
                    </div>
                </div>
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

export const GmailWidget = ({
    title = "Gmail",
    defaultQuery = "is:unread",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GmailContent title={title} defaultQuery={defaultQuery} />
            </Panel>
        </Widget>
    );
};
