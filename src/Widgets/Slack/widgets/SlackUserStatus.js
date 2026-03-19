/**
 * SlackUserStatus
 *
 * View and update your Slack user status.
 * Uses slack_get_users to fetch current status and slack_set_user_status to update.
 *
 * @package Slack
 */
import { useState, useEffect } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider } from "@trops/dash-core";

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

function SlackUserStatusContent({ title, widgetId }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("slack");

    const [currentStatus, setCurrentStatus] = useState(null);
    const [statusText, setStatusText] = useState("");
    const [statusEmoji, setStatusEmoji] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const fetchStatus = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await callTool("slack_get_users", {});
            const text = extractMcpText(res);
            let parsed;
            try {
                parsed = JSON.parse(text);
            } catch {
                parsed = text;
            }
            // Try to find the current user's profile/status
            const users = Array.isArray(parsed)
                ? parsed
                : parsed?.members || parsed?.users || [];
            // Look for the authed user (usually first or marked)
            const self =
                users.find(
                    (u) => u.is_primary_owner || u.is_owner || u.is_admin
                ) || users[0];
            if (self) {
                const profile = self.profile || self;
                setCurrentStatus({
                    text: profile.status_text || "",
                    emoji: profile.status_emoji || "",
                    displayName:
                        profile.display_name ||
                        profile.real_name ||
                        self.name ||
                        "You",
                });
                setStatusText(profile.status_text || "");
                setStatusEmoji(profile.status_emoji || "");
            }
            setResult({ type: "success", text: "Status loaded" });
        } catch (err) {
            setResult({ type: "error", text: err.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isConnected) {
            fetchStatus();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected]);

    const handleUpdateStatus = async () => {
        setLoading(true);
        setResult(null);
        try {
            const res = await callTool("slack_set_user_status", {
                status_text: statusText.trim(),
                status_emoji: statusEmoji.trim(),
            });
            setResult({
                type: "success",
                text: extractMcpText(res),
            });
            setCurrentStatus((prev) => ({
                ...prev,
                text: statusText.trim(),
                emoji: statusEmoji.trim(),
            }));
        } catch (err) {
            setResult({ type: "error", text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleClearStatus = async () => {
        setStatusText("");
        setStatusEmoji("");
        setLoading(true);
        setResult(null);
        try {
            await callTool("slack_set_user_status", {
                status_text: "",
                status_emoji: "",
            });
            setResult({
                type: "success",
                text: "Status cleared",
            });
            setCurrentStatus((prev) => ({
                ...prev,
                text: "",
                emoji: "",
            }));
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

            {/* Current Status */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <SubHeading3 title="Current Status" />
                    <button
                        onClick={fetchStatus}
                        disabled={!isConnected || loading}
                        className="px-3 py-1 text-xs rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        {loading ? "Loading..." : "Refresh"}
                    </button>
                </div>
                {currentStatus && (
                    <div className="p-2 bg-white/5 rounded text-xs">
                        <div className="text-gray-400 mb-1">
                            {currentStatus.displayName}
                        </div>
                        <div className="text-gray-200">
                            {currentStatus.emoji && (
                                <span className="mr-1">
                                    {currentStatus.emoji}
                                </span>
                            )}
                            {currentStatus.text || (
                                <span className="text-gray-500 italic">
                                    No status set
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Status */}
            <div className="space-y-2">
                <SubHeading3 title="Update Status" />
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={statusEmoji}
                        onChange={(e) => setStatusEmoji(e.target.value)}
                        placeholder=":emoji:"
                        className="w-20 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500"
                    />
                    <input
                        type="text"
                        value={statusText}
                        onChange={(e) => setStatusText(e.target.value)}
                        onKeyDown={(e) =>
                            e.key === "Enter" && handleUpdateStatus()
                        }
                        placeholder="What's your status?"
                        className="flex-1 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500"
                    />
                </div>
                <div className="flex gap-2 justify-end">
                    <button
                        onClick={handleClearStatus}
                        disabled={!isConnected || loading}
                        className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        Clear
                    </button>
                    <button
                        onClick={handleUpdateStatus}
                        disabled={!isConnected || loading}
                        className="px-3 py-1 text-xs rounded bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                        {loading ? "Updating..." : "Update"}
                    </button>
                </div>
            </div>

            {/* Result */}
            {result && (
                <div
                    className={`p-2 rounded text-xs border ${
                        result.type === "error"
                            ? "bg-red-900/30 border-red-700 text-red-300"
                            : "bg-green-900/30 border-green-700 text-green-300"
                    }`}
                >
                    <pre className="whitespace-pre-wrap overflow-auto max-h-32">
                        {result.text}
                    </pre>
                </div>
            )}
        </div>
    );
}

export const SlackUserStatus = ({
    title = "User Status",
    widgetId,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <SlackUserStatusContent title={title} widgetId={widgetId} />
            </Panel>
        </Widget>
    );
};
