import React, { useState, useEffect, useCallback } from "react";
import {
    Panel,
    SubHeading2,
    Menu,
    MenuItem,
    StatusBadge,
    Alert2,
    EmptyState,
    Skeleton,
    Button2,
    Caption,
    Paragraph3,
} from "@trops/dash-react";
import {
    useMcpProvider,
    useWidgetEvents,
    useScheduler,
} from "@trops/dash-core";

// GitHub MCP servers return tool results in several shapes. Normalize them.
function extractPrs(raw) {
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.items)) return raw.items;
    if (raw && Array.isArray(raw.pull_requests)) return raw.pull_requests;
    if (raw && Array.isArray(raw.content)) {
        const textPart = raw.content.find(
            (c) => c && c.type === "text" && typeof c.text === "string"
        );
        if (textPart) {
            try {
                const parsed = JSON.parse(textPart.text);
                if (Array.isArray(parsed)) return parsed;
                if (Array.isArray(parsed?.items)) return parsed.items;
                if (Array.isArray(parsed?.pull_requests))
                    return parsed.pull_requests;
            } catch {
                return [];
            }
        }
    }
    return [];
}

function mapPrBadgeState(pr) {
    if (pr?.draft === true) return "warning";
    if (pr?.merged_at) return "success";
    if (pr?.state === "open") return "open";
    if (pr?.state === "closed") return "closed";
    return "pending";
}

function prStateLabel(pr) {
    if (pr?.draft === true) return "draft";
    if (pr?.merged_at) return "merged";
    return typeof pr?.state === "string" ? pr.state : "unknown";
}

export default function GitHubOpenPRs({
    owner = "trops",
    repo = "dash-electron",
    maxResults = 25,
}) {
    const {
        callTool,
        tools,
        isConnected,
        error: mcpError,
    } = useMcpProvider("github");
    const { publishEvent } = useWidgetEvents();

    const [prs, setPrs] = useState(null);
    const [fetchError, setFetchError] = useState(null);

    const loadPrs = useCallback(async () => {
        if (!isConnected || !Array.isArray(tools) || tools.length === 0) return;
        try {
            const safeMax =
                typeof maxResults === "number" && maxResults > 0
                    ? Math.min(maxResults, 100)
                    : 25;
            const raw = await callTool("list_pull_requests", {
                owner,
                repo,
                state: "open",
                perPage: safeMax,
            });
            setPrs(extractPrs(raw));
            setFetchError(null);
        } catch (err) {
            setFetchError(err);
            setPrs([]);
        }
    }, [isConnected, tools, callTool, owner, repo, maxResults]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!isConnected || !Array.isArray(tools) || tools.length === 0)
                return;
            try {
                const safeMax =
                    typeof maxResults === "number" && maxResults > 0
                        ? Math.min(maxResults, 100)
                        : 25;
                const raw = await callTool("list_pull_requests", {
                    owner,
                    repo,
                    state: "open",
                    perPage: safeMax,
                });
                if (cancelled) return;
                setPrs(extractPrs(raw));
                setFetchError(null);
            } catch (err) {
                if (cancelled) return;
                setFetchError(err);
                setPrs([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isConnected, tools, callTool, owner, repo, maxResults]);

    useScheduler({
        refreshPullRequests: () => {
            loadPrs();
        },
    });

    const headerTitle = `Open PRs — ${owner}/${repo}`;

    if (mcpError) {
        return (
            <Panel>
                <SubHeading2 title={headerTitle} />
                <Alert2
                    title="GitHub provider error"
                    message={mcpError.message || String(mcpError)}
                />
            </Panel>
        );
    }

    if (fetchError) {
        return (
            <Panel>
                <SubHeading2 title={headerTitle} />
                <Alert2
                    title="Failed to load pull requests"
                    message={fetchError.message || String(fetchError)}
                />
                <div className="mt-2">
                    <Button2 title="Retry" onClick={loadPrs} size="sm" />
                </div>
            </Panel>
        );
    }

    if (!isConnected || prs === null) {
        return (
            <Panel>
                <SubHeading2 title={headerTitle} />
                <Skeleton.Text lines={5} />
            </Panel>
        );
    }

    if (prs.length === 0) {
        return (
            <Panel>
                <SubHeading2 title={headerTitle} />
                <EmptyState
                    title="No open pull requests"
                    description={`There are no open pull requests in ${owner}/${repo}.`}
                >
                    <Button2 title="Refresh" onClick={loadPrs} size="sm" />
                </EmptyState>
            </Panel>
        );
    }

    return (
        <Panel>
            <SubHeading2 title={headerTitle} />
            <Menu>
                {prs.map((pr, idx) => {
                    const number = pr?.number ?? pr?.id ?? idx;
                    const prTitle =
                        typeof pr?.title === "string" && pr.title.length > 0
                            ? pr.title
                            : "(untitled)";
                    const author =
                        pr?.user?.login || pr?.author?.login || "unknown";
                    const url = pr?.html_url || pr?.url || null;
                    return (
                        <MenuItem
                            key={`${number}-${idx}`}
                            onClick={() =>
                                publishEvent("pullRequestSelected", {
                                    number,
                                    title: prTitle,
                                    url,
                                    state: prStateLabel(pr),
                                    author,
                                    owner,
                                    repo,
                                })
                            }
                        >
                            <div className="flex items-center justify-between gap-3 w-full">
                                <div className="flex flex-col min-w-0 flex-1">
                                    <Paragraph3
                                        text={`#${number} ${prTitle}`}
                                    />
                                    <Caption text={`by ${author}`} />
                                </div>
                                <StatusBadge
                                    state={mapPrBadgeState(pr)}
                                    label={prStateLabel(pr)}
                                    compact
                                />
                            </div>
                        </MenuItem>
                    );
                })}
            </Menu>
            <div className="mt-2">
                <Button2 title="Refresh" onClick={loadPrs} size="sm" />
            </div>
        </Panel>
    );
}
