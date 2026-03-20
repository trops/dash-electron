/**
 * GmailInbox
 *
 * Displays inbox emails via the Gmail MCP provider.
 * Publishes emailSelected events when an email is clicked.
 *
 * @package Gmail
 */
import { useState, useEffect } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { McpDebugLog } from "../components/McpDebugLog";
import { McpReauthBanner } from "../components/McpReauthBanner";

function extractMcpText(res) {
    if (typeof res === "string") return res;
    if (res?.content && Array.isArray(res.content)) {
        return res.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n");
    }
    return JSON.stringify(res, null, 2);
}

function safeParse(text) {
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function parseSearchResults(text) {
    if (typeof text !== "string") return [];
    const entries = [];
    let current = null;
    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("ID:")) {
            if (current) entries.push(current);
            current = { id: trimmed.replace("ID:", "").trim() };
        } else if (current && trimmed.startsWith("Subject:")) {
            current.subject = trimmed.replace("Subject:", "").trim();
        } else if (current && trimmed.startsWith("From:")) {
            current.from = trimmed.replace("From:", "").trim();
        } else if (current && trimmed.startsWith("Date:")) {
            current.date = trimmed.replace("Date:", "").trim();
        }
    }
    if (current) entries.push(current);
    return entries;
}

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

            {/* Refresh */}
            <div className="flex items-center justify-between">
                <SubHeading3 title="Inbox" />
                <button
                    onClick={fetchInbox}
                    disabled={!isConnected || loading}
                    className="px-3 py-1 text-xs rounded bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                >
                    {loading ? "Loading..." : "Refresh"}
                </button>
            </div>

            {/* Email List */}
            {emails.length > 0 && (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                    {emails.map((email, i) => (
                        <button
                            key={email.id || i}
                            onClick={() => handleSelectEmail(email)}
                            className="w-full text-left px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded text-xs transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                {email.unread && (
                                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                                )}
                                <span className="text-gray-300 font-medium truncate">
                                    {email.from || email.sender || "Unknown"}
                                </span>
                                {email.date && (
                                    <span className="text-gray-600 text-[10px] ml-auto flex-shrink-0">
                                        {email.date}
                                    </span>
                                )}
                            </div>
                            <div className="text-gray-400 truncate">
                                {email.subject || "(no subject)"}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {emails.length === 0 && !loading && !result && (
                <div className="text-xs text-gray-500 text-center py-4">
                    No inbox emails loaded yet.
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
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {result.text}
                </div>
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
