/**
 * GmailMessageView
 *
 * Displays full email content via the Gmail MCP provider.
 * Listens for emailSelected events to load the selected email.
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

function parseEmailBody(text) {
    if (typeof text !== "string") return text;
    const lines = text.split("\n");
    const headers = {};
    let bodyStart = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === "") {
            bodyStart = i + 1;
            break;
        }
        if (line.startsWith("Subject:"))
            headers.subject = line.replace("Subject:", "").trim();
        else if (line.startsWith("From:"))
            headers.from = line.replace("From:", "").trim();
        else if (line.startsWith("To:"))
            headers.to = line.replace("To:", "").trim();
        else if (line.startsWith("Date:"))
            headers.date = line.replace("Date:", "").trim();
        else if (line.startsWith("Thread ID:"))
            headers.threadId = line.replace("Thread ID:", "").trim();
    }
    headers.body = lines.slice(bodyStart).join("\n").trim();
    return headers;
}

function GmailMessageViewContent({ title }) {
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

    const { listen } = useWidgetEvents();

    const [selectedEmail, setSelectedEmail] = useState(null);
    const [emailBody, setEmailBody] = useState(null);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [debugLog, setDebugLog] = useState([]);

    const handleReadEmail = async (emailData) => {
        setSelectedEmail(emailData);
        setEmailBody(null);
        setLoading(true);
        setResult(null);
        const id = emailData.id || emailData.messageId;
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

    useEffect(() => {
        const unsubscribe = listen("emailSelected", (payload) => {
            if (payload?.id && isConnected) {
                handleReadEmail(payload);
            }
        });
        return unsubscribe;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected]);

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

            {/* No Email Selected */}
            {!selectedEmail && !loading && (
                <div className="text-xs text-gray-500 text-center py-8">
                    No email selected. Click an email in the Inbox or Search
                    widget to view it here.
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="text-xs text-gray-400 text-center py-4 animate-pulse">
                    Loading email...
                </div>
            )}

            {/* Email Body */}
            {emailBody && (
                <div className="space-y-2">
                    <SubHeading3
                        title={
                            emailBody.subject ||
                            selectedEmail?.subject ||
                            "Message"
                        }
                    />
                    <div className="space-y-1 text-xs text-gray-500">
                        <div>
                            From: {emailBody.from || selectedEmail?.from || "—"}
                        </div>
                        <div>To: {emailBody.to || "—"}</div>
                        <div>
                            Date: {emailBody.date || selectedEmail?.date || "—"}
                        </div>
                    </div>
                    <div className="p-2 bg-white/5 rounded text-xs text-gray-300 overflow-auto max-h-64 whitespace-pre-wrap">
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
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {result.text}
                </div>
            )}

            <McpDebugLog entries={debugLog} />
        </div>
    );
}

export const GmailMessageView = ({ title = "Email Viewer", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GmailMessageViewContent title={title} />
            </Panel>
        </Widget>
    );
};
