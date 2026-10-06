/**
 * GitHubIssueList
 *
 * List GitHub issues for a repository via the GitHub MCP provider.
 * Listens for repoSelected events and publishes issueSelected events.
 *
 * @package GitHub
 */
import { useState, useEffect, useCallback, useRef, useContext } from "react";
import {
    AlertBanner,
    Button2,
    Caption2,
    Panel,
    StatusBadge,
    SubHeading2,
    SubHeading3,
    Tag3,
    ThemeContext,
    useStatusTokens,
} from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { parseMcpResponse } from "../utils/mcpUtils";

function GitHubIssueListContent({ title }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("github");
    const { publishEvent, listen, listeners } = useWidgetEvents();
    const { currentTheme } = useContext(ThemeContext);
    const statusTokens = useStatusTokens();
    const bodyText = currentTheme?.["text-primary-medium"] || "";
    const rowSurface = `${currentTheme?.["bg-primary-dark"] || ""} ${
        currentTheme?.["hover-bg-primary-dark"] || ""
    } ${bodyText}`;
    const selectedSurface = `border ${
        currentTheme?.["bg-secondary-dark"] || ""
    } ${currentTheme?.["text-secondary-light"] || ""} ${
        currentTheme?.["border-secondary-medium"] || ""
    }`;

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

    const [listenerStatus, setListenerStatus] = useState("not configured");

    const handlerRef = useRef(null);
    handlerRef.current = useCallback(
        (data) => {
            const payload = data.message || data;
            const fullName =
                payload.fullName || payload.full_name || payload.name;
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
                        ? "Listening for repoSelected"
                        : "No event listeners configured"}
                </Caption2>
            </div>

            {error && (
                <AlertBanner variant="error" size="compact" message={error} />
            )}

            {/* Repo Context */}
            {repo ? (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <SubHeading3 title={`Issues: ${repo}`} />
                        <Button2
                            size="sm"
                            onClick={() => fetchIssues(repo)}
                            disabled={!isConnected || loading}
                        >
                            {loading ? "..." : "Refresh"}
                        </Button2>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                        {issues.length === 0 && !loading ? (
                            <Caption2 block className="italic">
                                No issues found.
                            </Caption2>
                        ) : (
                            issues.map((issue, i) => (
                                <button
                                    key={issue.number || i}
                                    onClick={() => handleSelectIssue(issue)}
                                    className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                        selectedIssue === issue.number
                                            ? selectedSurface
                                            : rowSurface
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <StatusBadge
                                            state={
                                                (issue.state || "open") ===
                                                "open"
                                                    ? "open"
                                                    : "closed"
                                            }
                                            label={issue.state || "open"}
                                        />
                                        <Caption2 className="font-mono">
                                            #{issue.number}
                                        </Caption2>
                                        <span className="truncate">
                                            {issue.title ||
                                                JSON.stringify(issue)}
                                        </span>
                                    </div>
                                    {issue.labels?.length > 0 && (
                                        <div className="flex gap-1 mt-1">
                                            {issue.labels.map((l, j) => (
                                                <Tag3
                                                    key={j}
                                                    text={l.name || l}
                                                    padding="px-1 py-0.5"
                                                />
                                            ))}
                                        </div>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <Caption2 block className="italic">
                    {listenerStatus === "no listeners assigned"
                        ? "No event listeners configured. Wire repoSelected from a GitHubRepoList widget."
                        : "Select a repository from the GitHubRepoList widget to view issues."}
                </Caption2>
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

export const GitHubIssueList = ({ title = "GitHub Issues", ...props }) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GitHubIssueListContent title={title} />
            </Panel>
        </Widget>
    );
};
