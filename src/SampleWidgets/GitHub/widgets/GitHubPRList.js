/**
 * GitHubPRList
 *
 * List pull requests for a GitHub repository via the GitHub MCP provider.
 * Listens for repoSelected events and publishes prSelected events.
 *
 * @package GitHub
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { parseMcpResponse } from "../utils/mcpUtils";

function GitHubPRListContent({ title }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("github");
    const { publishEvent, listen, listeners } = useWidgetEvents();

    const [repo, setRepo] = useState(null);
    const [prs, setPrs] = useState([]);
    const [selectedPR, setSelectedPR] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const fetchPRs = useCallback(
        async (fullName) => {
            if (!fullName || !isConnected) return;
            setLoading(true);
            setResult(null);
            try {
                const [owner, name] = fullName.split("/");
                const res = await callTool("list_pull_requests", {
                    owner,
                    repo: name,
                });
                const { data, error: mcpError } = parseMcpResponse(res, {
                    arrayKeys: ["pull_requests", "items", "pulls"],
                });
                if (mcpError) {
                    setResult({ type: "error", text: mcpError });
                    return;
                }
                setPrs(Array.isArray(data) ? data : []);
            } catch (err) {
                setResult({ type: "error", text: err.message });
            } finally {
                setLoading(false);
            }
        },
        [isConnected, callTool]
    );

    const [listenerStatus, setListenerStatus] = useState("not configured");

    const handlerRef = useRef(null);
    handlerRef.current = useCallback(
        (data) => {
            const payload = data.message || data;
            const fullName =
                payload.fullName || payload.full_name || payload.name;
            if (fullName) {
                setRepo(fullName);
                setPrs([]);
                setSelectedPR(null);
                fetchPRs(fullName);
            }
        },
        [fetchPRs]
    );

    useEffect(() => {
        if (listeners && listen) {
            const hasListeners =
                typeof listeners === "object" &&
                Object.keys(listeners).length > 0;
            if (hasListeners) {
                setListenerStatus("listening");
                const handlers = {
                    repoSelected: (data) => handlerRef.current(data),
                };
                listen(listeners, handlers);
            } else {
                setListenerStatus("no listeners assigned");
            }
        }
    }, [listeners, listen]);

    const handleSelectPR = (pr) => {
        const payload = {
            id: pr.id || null,
            number: pr.number,
            title: pr.title,
            repo: repo,
        };
        setSelectedPR(pr.number);
        publishEvent("prSelected", payload);
    };

    const getStatusColor = (pr) => {
        if (pr.merged || pr.merged_at)
            return "bg-purple-900/50 text-purple-400";
        if (pr.state === "closed") return "bg-red-900/50 text-red-400";
        return "bg-green-900/50 text-green-400";
    };

    const getStatusLabel = (pr) => {
        if (pr.merged || pr.merged_at) return "merged";
        return pr.state || "open";
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

            <div className="flex items-center gap-2 text-xs">
                <span
                    className={`inline-block w-2 h-2 rounded-full ${
                        listenerStatus === "listening"
                            ? "bg-green-500"
                            : "bg-yellow-500"
                    }`}
                />
                <span className="text-gray-500">
                    {listenerStatus === "listening"
                        ? "Listening for repoSelected"
                        : "No event listeners configured"}
                </span>
            </div>

            {error && (
                <div className="p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-xs">
                    {error}
                </div>
            )}

            {/* PR List */}
            {repo ? (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <SubHeading3 title={`Pull Requests: ${repo}`} />
                        <button
                            onClick={() => fetchPRs(repo)}
                            disabled={!isConnected || loading}
                            className="px-2 py-0.5 text-xs rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-40 text-white"
                        >
                            {loading ? "..." : "Refresh"}
                        </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                        {prs.length === 0 && !loading ? (
                            <div className="text-xs text-gray-600 italic">
                                No pull requests found.
                            </div>
                        ) : (
                            prs.map((pr, i) => (
                                <button
                                    key={pr.number || i}
                                    onClick={() => handleSelectPR(pr)}
                                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                        selectedPR === pr.number
                                            ? "bg-gray-700 border border-gray-500"
                                            : "bg-white/5 hover:bg-white/10"
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getStatusColor(
                                                pr
                                            )}`}
                                        >
                                            {getStatusLabel(pr)}
                                        </span>
                                        <span className="text-gray-500 font-mono">
                                            #{pr.number}
                                        </span>
                                        <span className="text-gray-300 truncate">
                                            {pr.title || JSON.stringify(pr)}
                                        </span>
                                    </div>
                                    {pr.review_decision && (
                                        <div className="mt-1">
                                            <span
                                                className={`px-1 py-0.5 rounded text-[10px] ${
                                                    pr.review_decision ===
                                                    "APPROVED"
                                                        ? "bg-green-900/50 text-green-400"
                                                        : pr.review_decision ===
                                                          "CHANGES_REQUESTED"
                                                        ? "bg-red-900/50 text-red-400"
                                                        : "bg-gray-700 text-gray-400"
                                                }`}
                                            >
                                                {pr.review_decision}
                                            </span>
                                        </div>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="text-xs text-gray-600 italic">
                    {listenerStatus === "no listeners assigned"
                        ? "No event listeners configured. Wire repoSelected from a GitHubRepoList widget."
                        : "Select a repository from the GitHubRepoList widget to view pull requests."}
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

export const GitHubPRList = ({ title = "GitHub PRs", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GitHubPRListContent title={title} />
            </Panel>
        </Widget>
    );
};
