/**
 * SlackSearchMessages
 *
 * Search Slack messages across channels.
 * Publishes messageSelected when a result is clicked.
 *
 * @package Slack
 */
import { useState, useContext } from "react";
import {
    AlertBanner,
    Button,
    Caption2,
    InputText,
    Panel,
    SubHeading2,
    SubHeading3,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { parseMcpResponse } from "../utils/mcpUtils";

function SlackSearchMessagesContent({ title, widgetId }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("slack");
    const { publishEvent } = useWidgetEvents();
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();

    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [selectedTs, setSelectedTs] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await callTool("conversations_search_messages", {
                search_query: query.trim(),
            });
            const { data, error: mcpError } = parseMcpResponse(res, {
                arrayKeys: ["messages.matches", "matches", "messages"],
            });
            if (mcpError) {
                setResult({ type: "error", text: mcpError });
                return;
            }
            const matches = Array.isArray(data) ? data : [];
            setResults(matches);
            setResult({
                type: "success",
                text: `${matches.length} result(s) found`,
            });
        } catch (err) {
            setResult({ type: "error", text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleSelectMessage = (msg) => {
        const ts = msg.ts || msg.timestamp;
        setSelectedTs(ts);
        publishEvent("messageSelected", {
            ts,
            channel: msg.channel?.id || msg.channel || "",
            text: msg.text || "",
            user: msg.user || msg.username || "unknown",
        });
    };

    const formatTimestamp = (ts) => {
        if (!ts) return "";
        try {
            const date = new Date(parseFloat(ts) * 1000);
            return date.toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return ts;
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
    const accentText = currentTheme?.["text-secondary-medium"] || "";

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

            {/* Search Input */}
            <div className="space-y-2">
                <SubHeading3 title="Search Messages" />
                <div className="flex flex-wrap items-center gap-2">
                    <InputText
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        placeholder="Search Slack messages..."
                        className="flex-1 min-w-0"
                        height="h-7"
                        padding="px-2 py-1"
                        inputClassName="text-xs"
                    />
                    <Button
                        size="sm"
                        onClick={handleSearch}
                        disabled={!isConnected || loading || !query.trim()}
                    >
                        {loading ? "Searching..." : "Search"}
                    </Button>
                </div>
            </div>

            {/* Results */}
            {results.length > 0 && (
                <div className="flex-1 overflow-y-auto space-y-2">
                    {results.map((msg, i) => (
                        <button
                            key={msg.ts || i}
                            onClick={() => handleSelectMessage(msg)}
                            className={`w-full text-left px-2 py-2 rounded text-xs transition-colors ${
                                selectedTs === (msg.ts || msg.timestamp)
                                    ? selectedSurface
                                    : `${rowSurface} ${bodyText}`
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`font-semibold ${accentText}`}>
                                    {msg.user || msg.username || "unknown"}
                                </span>
                                <Caption2 className="opacity-70">in</Caption2>
                                <Caption2>
                                    #{msg.channel?.name || msg.channel || ""}
                                </Caption2>
                                <Caption2>
                                    {formatTimestamp(msg.ts || msg.timestamp)}
                                </Caption2>
                            </div>
                            <div className="whitespace-pre-wrap break-words">
                                {msg.text || ""}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {!loading && results.length === 0 && query && (
                <Caption2 block>
                    No results. Try a different search query.
                </Caption2>
            )}

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

export const SlackSearchMessages = ({
    title = "Search Messages",
    widgetId,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <SlackSearchMessagesContent title={title} widgetId={widgetId} />
            </Panel>
        </Widget>
    );
};
