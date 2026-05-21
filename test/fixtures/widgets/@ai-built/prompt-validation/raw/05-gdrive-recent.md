<!-- scenario: 05-gdrive-recent -->
<!-- userPrompt: List my recently modified Google Drive files. -->
<!-- exitCode: 0 -->
<!-- durationMs: 99182 -->

I'll build a single-purpose widget that lists recently modified Google Drive files via the `google-drive` MCP provider. It uses the standard Drive search syntax (`orderBy: "modifiedTime desc"`) to get the most-recent results, publishes a `fileSelected` event when a row is clicked (so a sibling widget can react), and exposes a `refreshFiles` scheduled task so you can configure how often it re-fetches.

```jsx
// File: GoogleDriveRecentFiles.js
import React, { useState, useEffect, useMemo } from "react";
import {
    Panel,
    SubHeading2,
    Menu,
    MenuItem,
    Alert2,
    EmptyState,
    Skeleton,
    Caption2,
    Button2,
    StatusBadge,
} from "@trops/dash-react";
import {
    useMcpProvider,
    useWidgetEvents,
    useScheduler,
} from "@trops/dash-core";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

// Pick the best-matching tool from whatever the connected google-drive MCP
// server exposes. Different servers name it differently (gdrive_search,
// search, list_files...) so we probe rather than hardcode.
function pickListTool(tools) {
    if (!Array.isArray(tools)) return null;
    const preferred = [
        "gdrive_search",
        "search_files",
        "list_files",
        "search",
        "files_list",
        "recent_files",
    ];
    for (const name of preferred) {
        const match = tools.find((t) => t && t.name === name);
        if (match) return match.name;
    }
    const fuzzy = tools.find((t) => {
        if (!t || typeof t.name !== "string") return false;
        const lower = t.name.toLowerCase();
        return lower.includes("search") || lower.includes("list");
    });
    return fuzzy ? fuzzy.name : null;
}

// MCP tool responses arrive in several shapes — handle each defensively.
function extractFiles(response) {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.files)) return response.files;
    if (Array.isArray(response.results)) return response.results;
    if (Array.isArray(response.items)) return response.items;
    if (Array.isArray(response.content)) {
        for (const block of response.content) {
            if (
                block &&
                block.type === "text" &&
                typeof block.text === "string"
            ) {
                try {
                    const parsed = JSON.parse(block.text);
                    if (Array.isArray(parsed)) return parsed;
                    if (Array.isArray(parsed?.files)) return parsed.files;
                    if (Array.isArray(parsed?.results)) return parsed.results;
                    if (Array.isArray(parsed?.items)) return parsed.items;
                } catch (_) {
                    // Not JSON — fall through.
                }
            }
        }
    }
    return [];
}

function formatRelativeTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 0) return date.toLocaleString();
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diffMs < minute) return "just now";
    if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
    if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
    if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d ago`;
    return date.toLocaleDateString();
}

export default function GoogleDriveRecentFiles({
    title = "Recent Google Drive files",
    limit = DEFAULT_LIMIT,
}) {
    const {
        callTool,
        tools,
        isConnected,
        error: providerError,
    } = useMcpProvider("google-drive");
    const { publishEvent } = useWidgetEvents();

    const [files, setFiles] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [refreshNonce, setRefreshNonce] = useState(0);

    const safeLimit = useMemo(() => {
        const parsed = Number(limit);
        if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
        return Math.min(Math.max(Math.floor(parsed), 1), MAX_LIMIT);
    }, [limit]);

    const toolName = useMemo(() => pickListTool(tools), [tools]);

    useEffect(() => {
        if (!isConnected) return;
        if (!Array.isArray(tools) || tools.length === 0) return;

        if (!toolName) {
            setLoadError(
                new Error(
                    "Google Drive provider is connected but no compatible search/list tool was found."
                )
            );
            setFiles([]);
            return;
        }

        let cancelled = false;
        setLoadError(null);

        // Google Drive search syntax: filter out trashed items, order by
        // most-recently-modified first.
        const args = {
            query: "trashed=false",
            orderBy: "modifiedTime desc",
            pageSize: safeLimit,
        };

        Promise.resolve(callTool(toolName, args))
            .then((response) => {
                if (cancelled) return;
                const list = extractFiles(response);
                setFiles(list.slice(0, safeLimit));
            })
            .catch((err) => {
                if (cancelled) return;
                setLoadError(err);
                setFiles([]);
            });

        return () => {
            cancelled = true;
        };
    }, [isConnected, tools, toolName, safeLimit, callTool, refreshNonce]);

    const refresh = () => setRefreshNonce((n) => n + 1);

    useScheduler({
        refreshFiles: refresh,
    });

    const handleSelect = (file) => {
        publishEvent("fileSelected", {
            id: file?.id || file?.fileId || null,
            name: file?.name || file?.title || "Untitled",
            url: file?.webViewLink || file?.url || null,
            mimeType: file?.mimeType || null,
            modifiedTime: file?.modifiedTime || file?.modified || null,
        });
    };

    const error = providerError || loadError;
    const showLoading = !error && (!isConnected || files === null);
    const skeletonLines = Math.min(safeLimit, 5);

    return (
        <Panel>
            <div className="flex items-center justify-between gap-2 mb-2">
                <SubHeading2 title={title} />
                <div className="flex items-center gap-2">
                    <StatusBadge
                        state={isConnected ? "success" : "pending"}
                        label={isConnected ? "connected" : "connecting"}
                        compact
                    />
                    <Button2
                        title="Refresh"
                        size="sm"
                        onClick={refresh}
                        disabled={!isConnected}
                    />
                </div>
            </div>

            {error && (
                <Alert2
                    title="Failed to load Drive files"
                    message={
                        (error && error.message) ||
                        String(error) ||
                        "Unknown error"
                    }
                />
            )}

            {showLoading && <Skeleton.Text lines={skeletonLines} />}

            {!error && !showLoading && files && files.length === 0 && (
                <EmptyState
                    title="No recent files"
                    description="Google Drive returned no recently modified files."
                />
            )}

            {!error && !showLoading && files && files.length > 0 && (
                <Menu>
                    {files.map((file, idx) => {
                        const id =
                            file?.id || file?.fileId || `gdrive-item-${idx}`;
                        const name =
                            file?.name || file?.title || "Untitled file";
                        const modified = formatRelativeTime(
                            file?.modifiedTime || file?.modified
                        );
                        return (
                            <MenuItem
                                key={id}
                                onClick={() => handleSelect(file)}
                            >
                                <div className="flex items-center justify-between gap-3 w-full min-w-0">
                                    <span className="truncate">{name}</span>
                                    {modified && <Caption2 text={modified} />}
                                </div>
                            </MenuItem>
                        );
                    })}
                </Menu>
            )}
        </Panel>
    );
}
```

```javascript
// File: GoogleDriveRecentFiles.dash.js
import GoogleDriveRecentFiles from "./GoogleDriveRecentFiles";

export default {
    component: GoogleDriveRecentFiles,
    canHaveChildren: false,
    workspace: "ai-built",
    type: "widget",
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Recent Google Drive files",
            displayName: "Title",
            instructions: "Heading shown at the top of the widget.",
            required: false,
        },
        limit: {
            type: "number",
            defaultValue: 10,
            displayName: "Max files",
            instructions: "How many recently modified files to show (1–50).",
            required: false,
        },
    },
    providers: [{ type: "google-drive", providerClass: "mcp", required: true }],
    events: ["fileSelected"],
    scheduledTasks: [
        {
            key: "refreshFiles",
            handler: "refreshFiles",
            displayName: "Refresh files",
            description:
                "Re-fetch the list of recently modified Google Drive files.",
        },
    ],
};
```

### Notes for you

-   **Emits `fileSelected`** when a row is clicked (payload: `id`, `name`, `url`, `mimeType`, `modifiedTime`). Pair this with a sibling widget — e.g. a "File preview" or "File details" widget — and wire them via Settings → Configure → Event Handlers.
-   **Scheduled task `refreshFiles`** is exposed but does nothing until you set a cadence in Settings → Schedule (cron or interval).
-   **Tool probing**: different `google-drive` MCP servers name the search tool differently (`gdrive_search`, `search`, `search_files`, etc.). The widget probes the connected server's tool list and picks the best match — if none of the known names show up it renders a clear error so you'll know to update the probe list rather than failing silently.
-   **No destructive calls** — read-only. The install permission modal should only ask for the chosen search/list tool.

Click **Install** below to register it; it'll show in the widget picker without any restart.
