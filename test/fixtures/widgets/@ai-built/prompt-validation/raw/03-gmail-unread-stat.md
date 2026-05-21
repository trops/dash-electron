<!-- scenario: 03-gmail-unread-stat -->
<!-- userPrompt: Show my unread email count as one big number, refresh every minute. -->
<!-- exitCode: 0 -->
<!-- durationMs: 87383 -->

I'll build a single-stat Gmail widget that polls unread count every 60s. Provider is pre-selected `gmail` / `mcp`, so I'll use `useMcpProvider("gmail")` and call the Gmail MCP server's search tool with the query `is:unread`. Response parsing is defensive because MCP servers vary in shape.

**File: `widgets/GmailUnreadCount.js`**

```jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
    Panel,
    SubHeading2,
    StatCard,
    Alert2,
    Skeleton,
    Button2,
    Caption3,
    EmptyState,
} from "@trops/dash-react";
import { useMcpProvider } from "@trops/dash-core";

// Defensive: Gmail MCP servers return wildly different shapes. Walk the
// known forms and bail out gracefully if nothing matches.
function extractUnreadCount(response) {
    if (response == null) return null;

    // Form 1: { messages: [...] }
    if (Array.isArray(response.messages)) return response.messages.length;

    // Form 2: { resultSizeEstimate: N }
    if (typeof response.resultSizeEstimate === "number") {
        return response.resultSizeEstimate;
    }

    // Form 3: { results: [...] }
    if (Array.isArray(response.results)) return response.results.length;

    // Form 4: top-level array
    if (Array.isArray(response)) return response.length;

    // Form 5: MCP wrapper { content: [{ type: "text", text: "..." }] }
    if (Array.isArray(response.content)) {
        const text = response.content
            .map((c) => (c && typeof c.text === "string" ? c.text : ""))
            .join("\n");

        // 5a: text is JSON
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed?.messages)) return parsed.messages.length;
            if (typeof parsed?.resultSizeEstimate === "number") {
                return parsed.resultSizeEstimate;
            }
            if (Array.isArray(parsed?.results)) return parsed.results.length;
            if (Array.isArray(parsed)) return parsed.length;
        } catch {
            // 5b: text is human-readable — try to pull a number out of a
            // phrase like "Found 12 messages"
            const m = text.match(/\b(\d+)\b/);
            if (m) return Number(m[1]);
        }
    }

    return null;
}

// Find the search tool by name OR by inspecting tool names that look like
// Gmail search variants. Different Gmail MCP servers name this differently
// (search_emails, gmail_search, search, list_messages, etc.).
function findSearchTool(tools) {
    if (!Array.isArray(tools)) return null;
    const preferred = [
        "search_emails",
        "gmail_search",
        "search_messages",
        "search",
        "list_messages",
        "list_emails",
    ];
    for (const name of preferred) {
        const hit = tools.find((t) => t?.name === name);
        if (hit) return hit.name;
    }
    // Fallback: anything containing "search" or "list" + "message/email"
    const fuzzy = tools.find((t) => {
        const n = (t?.name || "").toLowerCase();
        return (
            n.includes("search") ||
            (n.includes("list") &&
                (n.includes("message") || n.includes("email")))
        );
    });
    return fuzzy?.name || null;
}

export default function GmailUnreadCount({
    title = "Unread Emails",
    query = "is:unread",
}) {
    const {
        callTool,
        tools,
        isConnected,
        error: mcpError,
    } = useMcpProvider("gmail");

    const [count, setCount] = useState(null);
    const [fetchError, setFetchError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [isFetching, setIsFetching] = useState(false);

    // Keep the latest fetch function in a ref so setInterval always sees
    // the current closure without resetting the timer on every render.
    const fetchRef = useRef(() => {});

    const fetchUnreadCount = useCallback(async () => {
        if (!isConnected || !Array.isArray(tools) || tools.length === 0) {
            return;
        }
        const toolName = findSearchTool(tools);
        if (!toolName) {
            setFetchError(
                new Error(
                    "No Gmail search tool found on this MCP server. Expected one of: search_emails, gmail_search, search, list_messages."
                )
            );
            return;
        }

        setIsFetching(true);
        try {
            // Send multiple common arg names — extra keys are ignored by
            // well-behaved MCP servers, and this avoids "wrong arg name"
            // failures across server implementations.
            const response = await callTool(toolName, {
                q: query,
                query,
                maxResults: 500,
                max_results: 500,
                labelIds: ["UNREAD"],
                label_ids: ["UNREAD"],
            });
            const n = extractUnreadCount(response);
            if (n === null) {
                setFetchError(
                    new Error(
                        "Gmail returned a response, but the unread count could not be parsed from it."
                    )
                );
            } else {
                setCount(n);
                setFetchError(null);
                setLastUpdated(new Date());
            }
        } catch (err) {
            setFetchError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setIsFetching(false);
        }
    }, [isConnected, tools, callTool, query]);

    // Keep ref current
    useEffect(() => {
        fetchRef.current = fetchUnreadCount;
    }, [fetchUnreadCount]);

    // Initial fetch + 60s timer
    useEffect(() => {
        if (!isConnected || !Array.isArray(tools) || tools.length === 0) {
            return undefined;
        }
        fetchRef.current();
        const id = setInterval(() => fetchRef.current(), 60000);
        return () => clearInterval(id);
    }, [isConnected, tools]);

    const helpText = lastUpdated
        ? `Refreshes every minute · last ${lastUpdated.toLocaleTimeString()}`
        : "Refreshes every minute";

    return (
        <Panel>
            <SubHeading2 title={title} />

            {mcpError && (
                <Alert2
                    title="Gmail connection error"
                    message={mcpError.message || String(mcpError)}
                />
            )}

            {!mcpError && fetchError && (
                <Alert2
                    title="Failed to fetch unread count"
                    message={fetchError.message || String(fetchError)}
                />
            )}

            {!mcpError && !fetchError && !isConnected && (
                <EmptyState
                    title="Connecting to Gmail"
                    description="Waiting for the Gmail provider to come online."
                />
            )}

            {!mcpError && !fetchError && isConnected && count === null && (
                <Skeleton.Card />
            )}

            {!mcpError && !fetchError && count !== null && (
                <StatCard
                    label={query === "is:unread" ? "Unread" : query}
                    value={String(count)}
                    helpText={helpText}
                />
            )}

            <div className="mt-3 flex items-center gap-2">
                <Button2
                    title={isFetching ? "Refreshing…" : "Refresh now"}
                    onClick={() => fetchRef.current()}
                    size="sm"
                    disabled={isFetching || !isConnected}
                />
                <Caption3 text={`Query: ${query}`} />
            </div>
        </Panel>
    );
}
```

**File: `widgets/GmailUnreadCount.dash.js`**

```javascript
import GmailUnreadCount from "./GmailUnreadCount";

export default {
    component: GmailUnreadCount,
    canHaveChildren: false,
    workspace: "ai-built",
    type: "widget",
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Unread Emails",
            displayName: "Title",
            instructions: "The label shown above the count.",
            required: true,
        },
        query: {
            type: "text",
            defaultValue: "is:unread",
            displayName: "Gmail search query",
            instructions:
                'Gmail search syntax. Default "is:unread" counts unread mail across all folders. Examples: "is:unread label:INBOX", "is:unread from:boss@example.com".',
            required: true,
        },
    },
    providers: [{ type: "gmail", providerClass: "mcp", required: true }],
};
```

### What this widget does

-   Calls the Gmail MCP server's search tool with `q: "is:unread"` on mount, then every 60 seconds.
-   Renders one big number via `StatCard` (the canonical single-stat primitive — label, value, help text).
-   Surfaces failures explicitly via `Alert2` instead of silently zeroing out (defensive-coding rule).
-   Shows a `Skeleton.Card` on first load and an `EmptyState` while the MCP connection is warming up.
-   Manual `Refresh now` button via `Button2` for impatient checks.

### Notes you'll want to know

-   **Tool name auto-discovery.** Gmail MCP servers don't agree on what to call the search endpoint (`search_emails`, `gmail_search`, `search`, `list_messages`, etc.), so the widget inspects the `tools` array returned by `useMcpProvider` and picks the first match. If your server uses a name not in the preferred list, the widget will fall back to fuzzy matching and report a clear error if nothing matches.
-   **`is:unread` is a Gmail search operator** — it counts mail in any folder that isn't trash/spam. If you only want INBOX unread, change the query to `is:unread label:INBOX` in widget settings.
-   **No events / no scheduled tasks** — this is a passive display widget; nothing to publish to siblings and the cadence is hardcoded to one minute per your request. If you later want the cadence configurable, swap the `setInterval` for `useScheduler({ refreshCount: ... })` and add a `scheduledTasks` entry to the `.dash.js`.

Click **Install** below to add it to your widget picker.
