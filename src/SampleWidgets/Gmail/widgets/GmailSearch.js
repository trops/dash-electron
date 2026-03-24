/**
 * GmailSearch
 *
 * Search emails via the Gmail MCP provider.
 * Publishes emailSelected events when a result is clicked.
 *
 * @package Gmail
 */
import { useState } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { McpDebugLog } from "../components/McpDebugLog";
import { McpReauthBanner } from "../components/McpReauthBanner";
import {
    extractMcpText,
    safeParse,
    parseSearchResults,
} from "../utils/mcpUtils";

function GmailSearchContent({ title }) {
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

    const [query, setQuery] = useState("");
    const [emails, setEmails] = useState([]);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [debugLog, setDebugLog] = useState([]);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setResult(null);
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

            {/* Search */}
            <div className="space-y-2">
                <SubHeading3 title="Search Emails" />
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="Gmail search query..."
                        className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-red-500"
                    />
                    <button
                        onClick={handleSearch}
                        disabled={!isConnected || loading}
                        className="px-3 py-1 text-xs rounded bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        Search
                    </button>
                </div>
            </div>

            {/* Results */}
            {emails.length > 0 && (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                    {emails.map((email, i) => (
                        <button
                            key={email.id || i}
                            onClick={() => handleSelectEmail(email)}
                            className="w-full text-left px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded text-xs transition-colors"
                        >
                            <div className="flex items-center gap-2">
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
                    Enter a search query to find emails.
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

export const GmailSearch = ({ title = "Gmail Search", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GmailSearchContent title={title} />
            </Panel>
        </Widget>
    );
};
