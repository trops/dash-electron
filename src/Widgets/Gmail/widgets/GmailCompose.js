/**
 * GmailCompose
 *
 * Compose and send emails via the Gmail MCP provider.
 * Listens for emailSelected events to pre-fill reply-to.
 *
 * @package Gmail
 */
import { useState, useEffect } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { McpDebugLog } from "../../Google/components/McpDebugLog";
import { McpReauthBanner } from "../../Google/components/McpReauthBanner";

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

            {/* Compose Form */}
            <div className="space-y-2">
                <SubHeading3 title="Compose Email" />
                <input
                    type="text"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="To..."
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-red-500"
                />
                <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject..."
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-red-500"
                />
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Message body..."
                    rows={6}
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-red-500 resize-none"
                />
                <button
                    onClick={handleSend}
                    disabled={
                        !isConnected || loading || !to.trim() || !subject.trim()
                    }
                    className="px-3 py-1 text-xs rounded bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                >
                    {loading ? "Sending..." : "Send"}
                </button>
            </div>

            {/* Success */}
            {result?.type === "success" && (
                <div className="p-2 bg-green-900/30 border border-green-700 rounded text-green-300 text-xs">
                    {result.text}
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

export const GmailCompose = ({ title = "Compose Email", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GmailComposeContent title={title} />
            </Panel>
        </Widget>
    );
};
