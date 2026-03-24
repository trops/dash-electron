/**
 * GitHubIssueDetail
 *
 * Display full details of a GitHub issue via the GitHub MCP provider.
 * Listens for issueSelected events to load issue detail.
 *
 * @package GitHub
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Panel, SubHeading2, SubHeading3 } from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { parseMcpResponse } from "../utils/mcpUtils";

function GitHubIssueDetailContent({ title }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("github");
    const { listen, listeners } = useWidgetEvents();

    const [issue, setIssue] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const fetchIssue = useCallback(
        async (repo, issueNumber) => {
            if (!repo || !issueNumber || !isConnected) return;
            setLoading(true);
            setResult(null);
            try {
                const [owner, name] = repo.split("/");
                const res = await callTool("get_issue", {
                    owner,
                    repo: name,
                    issue_number: issueNumber,
                });
                const { data, error: mcpError } = parseMcpResponse(res);
                if (mcpError) {
                    setResult({ type: "error", text: mcpError });
                    return;
                }
                setIssue(typeof data === "string" ? { body: data } : data);
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
            const repo = data.repo;
            const issueNumber = data.number;
            if (repo && issueNumber) {
                setIssue(null);
                fetchIssue(repo, issueNumber);
            }
        },
        [fetchIssue]
    );

    useEffect(() => {
        if (listeners && listen) {
            const hasListeners =
                typeof listeners === "object" &&
                Object.keys(listeners).length > 0;
            if (hasListeners) {
                const handlers = {
                    issueSelected: (data) => handlerRef.current(data),
                };
                listen(listeners, handlers);
            }
        }
    }, [listeners, listen]);

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

            {loading && (
                <div className="text-xs text-gray-400 animate-pulse">
                    Loading issue...
                </div>
            )}

            {/* Issue Detail */}
            {issue ? (
                <div className="space-y-3">
                    {/* Title & Number */}
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    issue.state === "open"
                                        ? "bg-green-900/50 text-green-400"
                                        : "bg-purple-900/50 text-purple-400"
                                }`}
                            >
                                {issue.state || "open"}
                            </span>
                            {issue.number && (
                                <span className="text-gray-500 font-mono text-xs">
                                    #{issue.number}
                                </span>
                            )}
                        </div>
                        <SubHeading3 title={issue.title || "Untitled Issue"} />
                    </div>

                    {/* Labels */}
                    {issue.labels?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {issue.labels.map((l, i) => (
                                <span
                                    key={i}
                                    className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] text-gray-400"
                                    style={
                                        l.color
                                            ? {
                                                  borderLeft: `3px solid #${l.color}`,
                                              }
                                            : {}
                                    }
                                >
                                    {l.name || l}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Assignees */}
                    {issue.assignees?.length > 0 && (
                        <div className="text-xs">
                            <span className="text-gray-500 font-medium">
                                Assignees:{" "}
                            </span>
                            <span className="text-gray-300">
                                {issue.assignees
                                    .map((a) => a.login || a)
                                    .join(", ")}
                            </span>
                        </div>
                    )}

                    {/* Body */}
                    {issue.body && (
                        <div className="space-y-1">
                            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                                Description
                            </div>
                            <div className="text-xs text-gray-300 bg-gray-800/50 rounded p-2 whitespace-pre-wrap max-h-64 overflow-y-auto">
                                {issue.body}
                            </div>
                        </div>
                    )}

                    {/* Meta */}
                    <div className="text-xs text-gray-600 space-y-0.5">
                        {issue.user?.login && (
                            <div>
                                Created by:{" "}
                                <span className="text-gray-400">
                                    {issue.user.login}
                                </span>
                            </div>
                        )}
                        {issue.created_at && (
                            <div>
                                Created:{" "}
                                <span className="text-gray-400">
                                    {new Date(
                                        issue.created_at
                                    ).toLocaleDateString()}
                                </span>
                            </div>
                        )}
                        {issue.comments != null && (
                            <div>
                                Comments:{" "}
                                <span className="text-gray-400">
                                    {issue.comments}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                !loading && (
                    <div className="text-xs text-gray-600 italic">
                        Select an issue from the GitHubIssueList widget to view
                        details.
                    </div>
                )
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

export const GitHubIssueDetail = ({ title = "Issue Detail", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GitHubIssueDetailContent title={title} />
            </Panel>
        </Widget>
    );
};
