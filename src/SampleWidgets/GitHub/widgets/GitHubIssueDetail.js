/**
 * GitHubIssueDetail
 *
 * Display full details of a GitHub issue via the GitHub MCP provider.
 * Listens for issueSelected events to load issue detail.
 *
 * @package GitHub
 */
import { useState, useEffect, useCallback, useRef, useContext } from "react";
import {
    Panel,
    SubHeading2,
    SubHeading3,
    SectionLabel,
    AlertBanner,
    Caption2,
    StatusBadge,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { parseMcpResponse } from "../utils/mcpUtils";

function GitHubIssueDetailContent({ title }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("github");
    const { listen, listeners } = useWidgetEvents();
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();
    const bodyText = currentTheme?.["text-primary-medium"] || "";

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

    const [listenerStatus, setListenerStatus] = useState("not configured");

    const handlerRef = useRef(null);
    handlerRef.current = useCallback(
        (data) => {
            const payload = data.message || data;
            const repo = payload.repo;
            const issueNumber = payload.number;
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
                setListenerStatus("listening");
                const handlers = {
                    issueSelected: (data) => handlerRef.current(data),
                };
                listen(listeners, handlers);
            } else {
                setListenerStatus("no listeners assigned");
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

            <div className="flex items-center gap-2 text-xs">
                <span
                    className={`inline-block w-2 h-2 rounded-full ${
                        listenerStatus === "listening"
                            ? statusTokens.success.solidBg
                            : statusTokens.warning.solidBg
                    }`}
                />
                <Caption2>
                    {listenerStatus === "listening"
                        ? "Listening for issueSelected"
                        : "No event listeners configured"}
                </Caption2>
            </div>

            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
            )}

            {loading && (
                <Caption2 block className="animate-pulse">
                    Loading issue...
                </Caption2>
            )}

            {/* Issue Detail */}
            {issue ? (
                <div className="space-y-3">
                    {/* Title & Number */}
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <StatusBadge
                                state={
                                    (issue.state || "open") === "open"
                                        ? "open"
                                        : "closed"
                                }
                                label={issue.state || "open"}
                            />
                            {issue.number && (
                                <Caption2 className="font-mono">
                                    #{issue.number}
                                </Caption2>
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
                                    className={`px-1.5 py-0.5 rounded border text-xs ${
                                        currentTheme?.["bg-primary-dark"] || ""
                                    } ${
                                        currentTheme?.["border-primary-dark"] ||
                                        ""
                                    } ${bodyText}`}
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
                            <Caption2 className="font-medium">
                                Assignees:{" "}
                            </Caption2>
                            <span className={bodyText}>
                                {issue.assignees
                                    .map((a) => a.login || a)
                                    .join(", ")}
                            </span>
                        </div>
                    )}

                    {/* Body */}
                    {issue.body && (
                        <div className="space-y-1">
                            <SectionLabel>Description</SectionLabel>
                            <div
                                className={`text-xs rounded p-2 whitespace-pre-wrap max-h-64 overflow-y-auto ${
                                    currentTheme?.["bg-primary-dark"] || ""
                                } ${bodyText}`}
                            >
                                {issue.body}
                            </div>
                        </div>
                    )}

                    {/* Meta */}
                    <Caption2 block className="space-y-0.5">
                        {issue.user?.login && (
                            <div>
                                Created by:{" "}
                                <span className={bodyText}>
                                    {issue.user.login}
                                </span>
                            </div>
                        )}
                        {issue.created_at && (
                            <div>
                                Created:{" "}
                                <span className={bodyText}>
                                    {new Date(
                                        issue.created_at
                                    ).toLocaleDateString()}
                                </span>
                            </div>
                        )}
                        {issue.comments != null && (
                            <div>
                                Comments:{" "}
                                <span className={bodyText}>
                                    {issue.comments}
                                </span>
                            </div>
                        )}
                    </Caption2>
                </div>
            ) : (
                !loading && (
                    <Caption2 block className="italic">
                        {listenerStatus === "no listeners assigned"
                            ? "No event listeners configured. Wire issueSelected from a GitHubIssueList widget."
                            : "Select an issue from the GitHubIssueList widget to view details."}
                    </Caption2>
                )
            )}

            {/* Error */}
            {result?.type === "error" && (
                <AlertBanner
                    variant="error"
                    size="compact"
                    message={result.text}
                />
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
