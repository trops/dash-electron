/**
 * SampleGmailWidget
 *
 * Demonstrates useMcpProvider("gmail") with email search and reading.
 * Requires a Gmail MCP provider to be configured.
 *
 * @package DashSamples
 */
import { useState } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider } from "@trops/dash-core";

function SampleGmailContent({ title, defaultQuery }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("gmail");

    const [query, setQuery] = useState(defaultQuery || "is:unread");
    const [emails, setEmails] = useState([]);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [emailBody, setEmailBody] = useState(null);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setResult(null);
        setSelectedEmail(null);
        setEmailBody(null);
        try {
            const res = await callTool("search_emails", {
                query: query.trim(),
            });
            const parsed = typeof res === "string" ? JSON.parse(res) : res;
            setEmails(
                Array.isArray(parsed)
                    ? parsed
                    : parsed?.messages || parsed?.emails || []
            );
        } catch (err) {
            setResult({ type: "error", text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleReadEmail = async (email) => {
        setSelectedEmail(email);
        setEmailBody(null);
        setLoading(true);
        try {
            const id = email.id || email.messageId;
            const res = await callTool("read_email", {
                message_id: id,
            });
            const parsed = typeof res === "string" ? JSON.parse(res) : res;
            setEmailBody(parsed);
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

            {/* Email List */}
            {emails.length > 0 && !emailBody && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                    {emails.map((email, i) => (
                        <button
                            key={email.id || i}
                            onClick={() => handleReadEmail(email)}
                            className="w-full text-left px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded text-xs transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-gray-300 font-medium truncate">
                                    {email.from || email.sender || "Unknown"}
                                </span>
                            </div>
                            <div className="text-gray-400 truncate">
                                {email.subject || "(no subject)"}
                            </div>
                            {email.snippet && (
                                <div className="text-gray-600 truncate mt-0.5">
                                    {email.snippet}
                                </div>
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
                        <button
                            onClick={() => {
                                setEmailBody(null);
                                setSelectedEmail(null);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-300"
                        >
                            Back
                        </button>
                    </div>
                    <div className="text-xs text-gray-500">
                        From: {emailBody.from || selectedEmail?.from || "—"}
                    </div>
                    <div className="p-2 bg-white/5 rounded text-xs text-gray-300 overflow-auto max-h-48 whitespace-pre-wrap">
                        {emailBody.body ||
                            emailBody.text ||
                            JSON.stringify(emailBody, null, 2)}
                    </div>
                </div>
            )}

            {/* Error */}
            {result?.type === "error" && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {result.text}
                </div>
            )}
        </div>
    );
}

export const SampleGmailWidget = ({
    title = "Sample Gmail",
    defaultQuery = "is:unread",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <SampleGmailContent title={title} defaultQuery={defaultQuery} />
            </Panel>
        </Widget>
    );
};
