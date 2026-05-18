/**
 * SlackListChannels
 *
 * Scrollable list of Slack channels with search filter.
 * Publishes channelSelected event when a channel is clicked.
 *
 * @package Slack
 */
import { useState, useEffect } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { parseMcpResponse, parseSlackTextEntries } from "../utils/mcpUtils";

function SlackListChannelsContent({ title, widgetId }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("slack");
    const { publishEvent } = useWidgetEvents();

    const [channels, setChannels] = useState([]);
    const [filter, setFilter] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleListChannels = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await callTool("slack_list_channels", {});
            const { data, error: mcpError } = parseMcpResponse(res, {
                arrayKeys: ["channels"],
                textParser: parseSlackTextEntries,
            });
            if (mcpError) {
                setResult({ type: "error", text: mcpError });
                return;
            }
            const list = Array.isArray(data) ? data : [];
            setChannels(list);
            setResult({
                type: list.length > 0 ? "success" : "error",
                text:
                    list.length > 0
                        ? `${list.length} channel(s) loaded`
                        : "No channels found",
            });
        } catch (err) {
            setResult({ type: "error", text: err.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isConnected) {
            handleListChannels();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected]);

    const handleSelect = (ch) => {
        const id = ch.id || ch;
        const name = ch.name || ch.id || ch;
        setSelectedId(id);
        publishEvent("channelSelected", { id, name });
    };

    const filtered = channels.filter((ch) => {
        const name = (ch.name || ch.id || String(ch)).toLowerCase();
        return name.includes(filter.toLowerCase());
    });

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

            {/* Search & Refresh */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <SubHeading3 title="Channels" />
                    <button
                        onClick={handleListChannels}
                        disabled={!isConnected || loading}
                        className="px-3 py-1 text-xs rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        {loading ? "Loading..." : "Refresh"}
                    </button>
                </div>
                <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter channels..."
                    className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
            </div>

            {/* Channel List */}
            {filtered.length > 0 && (
                <div className="flex-1 overflow-y-auto space-y-1">
                    {filtered.map((ch, i) => (
                        <button
                            key={ch.id || i}
                            onClick={() => handleSelect(ch)}
                            className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                                selectedId === (ch.id || ch)
                                    ? "bg-purple-900/50 border border-purple-500"
                                    : "bg-white/5 hover:bg-white/10"
                            }`}
                        >
                            <span className="text-gray-300">
                                #{ch.name || ch.id || ch}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* Empty state — distinct from loading + connection-error
                so the user knows whether to wait, configure Slack, or
                just refresh. */}
            {!loading && !error && channels.length === 0 && (
                <div className="text-xs text-gray-500 italic">
                    {isConnected
                        ? "No channels found. Click Refresh to retry."
                        : "Connect the Slack provider in Settings to load channels."}
                </div>
            )}

            {/* No-match state for the filter — separate so a typo
                doesn't make it look like there are no channels at all. */}
            {!loading &&
                channels.length > 0 &&
                filtered.length === 0 &&
                filter.length > 0 && (
                    <div className="text-xs text-gray-500 italic">
                        No channels match "{filter}".
                    </div>
                )}

            {/* Last-call status: subtle inline feedback, not a verbose
                panel. Errors already render above; this just confirms
                a successful refresh. */}
            {result && result.type === "error" && (
                <div className="text-xs text-red-400">
                    Last fetch failed: {result.text}
                </div>
            )}
        </div>
    );
}

export const SlackListChannels = ({
    title = "Slack Channels",
    widgetId,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <SlackListChannelsContent title={title} widgetId={widgetId} />
            </Panel>
        </Widget>
    );
};
