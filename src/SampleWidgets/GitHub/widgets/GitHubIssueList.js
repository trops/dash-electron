/**
 * GitHubIssueList
 *
 * List GitHub issues for a repository via the GitHub MCP provider.
 * Listens for repoSelected events and publishes issueSelected events.
 *
 * @package GitHub
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { parseMcpResponse } from "../utils/mcpUtils";

function GitHubIssueListContent({ title }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("github");
    const { publishEvent, listen, listeners } = useWidgetEvents();

    const [repo, setRepo] = useState(null);
    const [issues, setIssues] = useState([]);
    const [selectedIssue, setSelectedIssue] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const repoRef = useRef(null);

    const fetchIssues = useCallback(
        async (fullName) => {
            if (!fullName || !isConnected) return;
            setLoading(true);
            setResult(null);
            try {
                const [owner, name] = fullName.split("/");
                const res = await callTool("list_issues", {
                    owner,
                    repo: name,
                });
                const { data, error: mcpError } = parseMcpResponse(res, {
                    arrayKeys: ["issues", "items"],
                });
                if (mcpError) {
                    setResult({ type: "error", text: mcpError });
                    return;
                }
                setIssues(Array.isArray(data) ? data : []);
            } catch (err) {
                setResult({ type: "error", text: err.message });
            } finally {
                setLoading(false);
            }
        },
        [isConnected, callTool]
    );

    const handlerRef = useRef(null);
    handlerRef.current = useCallback(
        (data) => {
            const fullName = data.fullName || data.full_name || data.name;
            if (fullName) {
                setRepo(fullName);
                repoRef.current = fullName;
                setIssues([]);
                setSelectedIssue(null);
                fetchIssues(fullName);
            }
        },
        [fetchIssues]
    );

    useEffect(() => {
        if (listeners && listen) {
            const hasListeners =
                typeof listeners === "object" &&
                Object.keys(listeners).length > 0;
            if (hasListeners) {
                const handlers = {
                    repoSelected: (data) => handlerRef.current(data),
                };
                listen(listeners, handlers);
            }
        }
    }, [listeners, listen]);

    const handleSelectIssue = (issue) => {
        const payload = {
            id: issue.id || null,
            number: issue.number,
            title: issue.title,
            repo: repo,
        };
        setSelectedIssue(issue.number);
        publishEvent("issueSelected", payload);
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

            {/* Repo Context */}
            {repo ? (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <SubHeading3 title={`Issues: ${repo}`} />
                        <button
                            onClick={() => fetchIssues(repo)}
                            disabled={!isConnected || loading}
                            className="px-2 py-0.5 text-xs rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-40 text-white"
                        >
                            {loading ? "..." : "Refresh"}
                        </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                        {issues.length === 0 && !loading ? (
                            <div className="text-xs text-gray-600 italic">
                                No issues found.
                            </div>
                        ) : (
                            issues.map((issue, i) => (
                                <button
                                    key={issue.number || i}
                                    onClick={() => handleSelectIssue(issue)}
                                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                        selectedIssue === issue.number
                                            ? "bg-gray-700 border border-gray-500"
                                            : "bg-white/5 hover:bg-white/10"
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                issue.state === "open"
                                                    ? "bg-green-900/50 text-green-400"
                                                    : "bg-purple-900/50 text-purple-400"
                                            }`}
                                        >
                                            {issue.state || "open"}
                                        </span>
                                        <span className="text-gray-500 font-mono">
                                            #{issue.number}
                                        </span>
                                        <span className="text-gray-300 truncate">
                                            {issue.title ||
                                                JSON.stringify(issue)}
                                        </span>
                                    </div>
                                    {issue.labels?.length > 0 && (
                                        <div className="flex gap-1 mt-1">
                                            {issue.labels.map((l, j) => (
                                                <span
                                                    key={j}
                                                    className="px-1 py-0.5 bg-gray-700 rounded text-[10px] text-gray-400"
                                                >
                                                    {l.name || l}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="text-xs text-gray-600 italic">
                    Select a repository from the GitHubRepoList widget to view
                    issues.
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

export const GitHubIssueList = ({ title = "GitHub Issues", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GitHubIssueListContent title={title} />
            </Panel>
        </Widget>
    );
};
