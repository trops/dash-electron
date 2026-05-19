/**
 * GitHubPRList
 *
 * List pull requests for a GitHub repository via the GitHub MCP provider.
 * Listens for repoSelected events and publishes prSelected events.
 *
 * Exemplar widget (post-cohesion rubric): every UI element is a
 * `@trops/dash-react` primitive that reads ThemeContext.
 *
 * @package GitHub
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
    Panel,
    SubHeading2,
    SubHeading3,
    Caption,
    Caption2,
    Button2,
    Menu,
    MenuItem,
    StatusBadge,
    EmptyState,
    Alert2,
    Skeleton,
} from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { parseMcpResponse } from "../utils/mcpUtils";

function connectionState({ isConnected, isConnecting, error }) {
    if (isConnected) return "success";
    if (isConnecting) return "pending";
    if (error) return "error";
    return "neutral";
}

function prState(pr) {
    if (pr.merged || pr.merged_at) return "closed";
    if (pr.state === "closed") return "error";
    return "open";
}

function prStateLabel(pr) {
    if (pr.merged || pr.merged_at) return "merged";
    return pr.state || "open";
}

function reviewState(decision) {
    if (decision === "APPROVED") return "success";
    if (decision === "CHANGES_REQUESTED") return "error";
    return "neutral";
}

function GitHubPRListContent({ title, configRepo, stateFilter }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("github");
    const { publishEvent, listen, listeners } = useWidgetEvents();

    const [repo, setRepo] = useState(configRepo || null);
    const [prs, setPrs] = useState([]);
    const [selectedPR, setSelectedPR] = useState(null);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);

    const configRepoRef = useRef(configRepo);
    useEffect(() => {
        if (configRepo !== configRepoRef.current) {
            configRepoRef.current = configRepo;
            setRepo(configRepo || null);
            setPrs([]);
            setSelectedPR(null);
        }
    }, [configRepo]);

    const fetchPRs = useCallback(
        async (fullName) => {
            if (!fullName || !isConnected) return;
            setLoading(true);
            setFetchError(null);
            try {
                const [owner, name] = fullName.split("/");
                const args = { owner, repo: name };
                if (stateFilter && stateFilter !== "open") {
                    args.state = stateFilter;
                }
                const res = await callTool("list_pull_requests", args);
                const { data, error: mcpError } = parseMcpResponse(res, {
                    arrayKeys: ["pull_requests", "items", "pulls"],
                });
                if (mcpError) {
                    setFetchError(mcpError);
                    return;
                }
                setPrs(Array.isArray(data) ? data : []);
            } catch (err) {
                setFetchError(err.message);
            } finally {
                setLoading(false);
            }
        },
        [isConnected, callTool, stateFilter]
    );

    useEffect(() => {
        if (isConnected && repo) {
            fetchPRs(repo);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected, repo, stateFilter]);

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
                listen(listeners, {
                    repoSelected: (data) => handlerRef.current(data),
                });
            }
        }
    }, [listeners, listen]);

    const handleSelectPR = (pr) => {
        setSelectedPR(pr.number);
        publishEvent("prSelected", {
            id: pr.id || null,
            number: pr.number,
            title: pr.title,
            repo: repo,
        });
    };

    return (
        <div className="flex flex-col gap-4 h-full overflow-y-auto">
            <SubHeading2 title={title} />

            <div className="flex items-center gap-2">
                <StatusBadge
                    state={connectionState({
                        isConnected,
                        isConnecting,
                        error,
                    })}
                    label={status}
                    compact
                />
                <Caption2 text={`(${tools.length} tools)`} />
            </div>

            {error && (
                <Alert2 title="GitHub connection error" message={error} />
            )}
            {fetchError && (
                <Alert2
                    title="Failed to load pull requests"
                    message={fetchError}
                />
            )}

            {!repo && (
                <EmptyState
                    title="No repository configured"
                    description="Set the Repository in this widget's settings, or pair it with a widget that publishes a repoSelected event."
                />
            )}

            {repo && (
                <>
                    <div className="flex items-center justify-between">
                        <SubHeading3 title={`Pull Requests: ${repo}`} />
                        <Button2
                            title={loading ? "Loading..." : "Refresh"}
                            onClick={() => fetchPRs(repo)}
                            disabled={!isConnected || loading}
                            size="sm"
                        />
                    </div>

                    {loading && <Skeleton.Text lines={4} />}

                    {!loading && prs.length === 0 && !fetchError && (
                        <EmptyState
                            title="No pull requests"
                            description={`No ${
                                stateFilter || "open"
                            } PRs in ${repo}.`}
                        />
                    )}

                    {!loading && prs.length > 0 && (
                        <Menu className="flex-1 overflow-y-auto space-y-1">
                            {prs.map((pr, i) => (
                                <MenuItem
                                    key={pr.number || i}
                                    onClick={() => handleSelectPR(pr)}
                                    selected={selectedPR === pr.number}
                                >
                                    <div className="flex flex-col gap-1 w-full">
                                        <div className="flex items-center gap-2 w-full">
                                            <StatusBadge
                                                state={prState(pr)}
                                                label={prStateLabel(pr)}
                                            />
                                            <Caption2 text={`#${pr.number}`} />
                                            <span className="truncate">
                                                {pr.title || JSON.stringify(pr)}
                                            </span>
                                        </div>
                                        {pr.review_decision && (
                                            <StatusBadge
                                                state={reviewState(
                                                    pr.review_decision
                                                )}
                                                label={pr.review_decision}
                                            />
                                        )}
                                    </div>
                                </MenuItem>
                            ))}
                        </Menu>
                    )}
                </>
            )}
        </div>
    );
}

export const GitHubPRList = ({
    title = "GitHub PRs",
    repo = "",
    stateFilter = "open",
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <GitHubPRListContent
                    title={title}
                    configRepo={repo}
                    stateFilter={stateFilter || "open"}
                />
            </Panel>
        </Widget>
    );
};
