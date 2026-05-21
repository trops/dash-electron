<!-- scenario: 02-github-prs -->
<!-- userPrompt: I want to see open pull requests in trops/dash-electron with their state. -->
<!-- exitCode: 0 -->
<!-- durationMs: 106732 -->

I'll build a `GitHubOpenPRs` widget that lists open pull requests for a configured repository (defaulting to `trops/dash-electron`) and shows each PR's state (open vs. draft) via a `StatusBadge`. Row clicks publish a `pullRequestSelected` event so you can wire it to a sibling widget later, and there's a scheduled task so the dashboard can auto-refresh on a cadence you set.

A few design notes up front:

-   **Provider:** `github` / `providerClass: "mcp"` — uses `useMcpProvider("github")` and calls the GitHub MCP tool `list_pull_requests`.
-   **Single-purpose:** lists open PRs only. No inline edit / merge / comment — those would be separate widgets that listen for `pullRequestSelected`.
-   **Defensive parsing:** GitHub MCP servers can return either a JSON array directly or a wrapped `{ content: [{ type: "text", text: "..." }] }` envelope. The widget normalizes both.
-   **No destructive IPC.** This widget only reads — the install-time permission gate should show only the read tool.
-   **Defaults match your request:** `owner = "trops"`, `repo = "dash-electron"`. Both are editable via Settings → Configure.

---

**File: `widgets/GitHubOpenPRs.js`**

```jsx
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
```

---

**File: `widgets/GitHubOpenPRs.dash.js`**

```javascript
import GitHubOpenPRs from "./GitHubOpenPRs";

export default {
    component: GitHubOpenPRs,
    canHaveChildren: false,
    workspace: "ai-built",
    type: "widget",
    userConfig: {
        owner: {
            type: "text",
            defaultValue: "trops",
            displayName: "Owner",
            instructions:
                "GitHub organization or user that owns the repository.",
            required: true,
        },
        repo: {
            type: "text",
            defaultValue: "dash-electron",
            displayName: "Repository",
            instructions: "Repository name (without the owner prefix).",
            required: true,
        },
        maxResults: {
            type: "number",
            defaultValue: 25,
            displayName: "Max results",
            instructions:
                "Maximum number of pull requests to fetch (1-100). GitHub's API caps this at 100 per page.",
            required: false,
        },
    },
    providers: [{ type: "github", providerClass: "mcp", required: true }],
    events: ["pullRequestSelected"],
    scheduledTasks: [
        {
            key: "refreshPullRequests",
            handler: "refreshPullRequests",
            displayName: "Refresh pull requests",
            description: "Re-fetch the open pull request list from GitHub.",
        },
    ],
};
```

---

**File: `index.js`**

```javascript
export { default as GitHubOpenPRs } from "./widgets/GitHubOpenPRs";
export { default as GitHubOpenPRsConfig } from "./widgets/GitHubOpenPRs.dash.js";
```

---

**File: `dash.json`**

```json
{
    "name": "@ai-built/githubopenprs",
    "displayName": "GitHub Open PRs",
    "version": "1.0.0",
    "description": "Lists open pull requests for a configured GitHub repository with per-PR state badges (open / draft).",
    "author": "AI Assistant",
    "widgets": [
        {
            "name": "GitHubOpenPRs",
            "displayName": "GitHub Open PRs",
            "description": "Shows open pull requests for trops/dash-electron (or any configured repo) with state badges and click-to-emit pullRequestSelected events."
        }
    ],
    "createdAt": "2026-05-20T00:00:00.000Z"
}
```

---

### What this widget exposes

-   **Event emitted:** `pullRequestSelected` — published when you click a PR row. Payload: `{ number, title, url, state, author, owner, repo }`. Wire it to a sibling widget (e.g. a "PR Details" or "PR Checks" widget) via Settings → Configure → Event Handlers.
-   **Scheduled task:** `refreshPullRequests` — re-fetches the PR list. Open Settings → Schedule on the installed widget to set a cadence (e.g. every 5 min).
-   **GitHub MCP method used:** `list_pull_requests` (read-only). The install-time permission modal will list it; granting it is enough.

Click **Install** below to add the widget to your registry, then drop it on a dashboard.
