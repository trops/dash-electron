<!-- scenario: 01-slack-channels -->
<!-- userPrompt: Build me a Slack channel browser. List channels, click to select, refresh button. -->
<!-- exitCode: 0 -->
<!-- durationMs: 99346 -->

I'll build a Slack channel browser widget. It uses the `slack` MCP provider, calls `slack_list_channels`, renders selectable rows, and publishes a `channelSelected` event so a sibling widget (e.g., a message viewer) can react.

**File: SlackChannelBrowser.js**

```jsx
import React, { useState, useEffect, useCallback } from "react";
import {
    Panel,
    SubHeading2,
    Menu,
    MenuItem,
    Alert2,
    EmptyState,
    Skeleton,
    Button2,
    Tag2,
    Caption,
} from "@trops/dash-react";
import { useMcpProvider, useWidgetEvents } from "@trops/dash-core";

// Slack MCP servers return tool output in a few different shapes.
// Normalize them all into a plain array of channel objects.
function parseChannels(res) {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.channels)) return res.channels;
    if (Array.isArray(res?.content)) {
        for (const part of res.content) {
            if (part?.type === "text" && typeof part.text === "string") {
                try {
                    const parsed = JSON.parse(part.text);
                    if (Array.isArray(parsed?.channels)) return parsed.channels;
                    if (Array.isArray(parsed)) return parsed;
                } catch {
                    // not JSON — fall through
                }
            }
        }
    }
    return [];
}

export default function SlackChannelBrowser({ title = "Slack channels" }) {
    const {
        callTool,
        tools,
        isConnected,
        error: connError,
    } = useMcpProvider("slack");
    const { publishEvent } = useWidgetEvents();

    const [channels, setChannels] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [reloadCounter, setReloadCounter] = useState(0);

    useEffect(() => {
        if (!isConnected || !Array.isArray(tools) || tools.length === 0) return;
        let cancelled = false;
        setChannels(null);
        setLoadError(null);
        callTool("slack_list_channels", { limit: 200 })
            .then((res) => {
                if (cancelled) return;
                setChannels(parseChannels(res));
            })
            .catch((err) => {
                if (cancelled) return;
                setLoadError(err);
                setChannels([]);
            });
        return () => {
            cancelled = true;
        };
    }, [isConnected, tools, callTool, reloadCounter]);

    const handleRefresh = useCallback(() => {
        setReloadCounter((n) => n + 1);
    }, []);

    const handleSelect = useCallback(
        (channel) => {
            setSelectedId(channel.id);
            publishEvent("channelSelected", {
                id: channel.id,
                name: channel.name,
                isPrivate: channel.isPrivate,
            });
        },
        [publishEvent]
    );

    const errMsg = connError
        ? connError.message || String(connError)
        : loadError
        ? loadError.message || String(loadError)
        : null;

    const ready = isConnected && Array.isArray(tools) && tools.length > 0;

    return (
        <Panel>
            <div className="flex items-center justify-between mb-3">
                <SubHeading2 title={title} />
                <Button2
                    title="Refresh"
                    onClick={handleRefresh}
                    size="sm"
                    disabled={!ready}
                />
            </div>

            {errMsg && (
                <Alert2 title="Failed to load channels" message={errMsg} />
            )}

            {!errMsg && !ready && <Skeleton.Text lines={5} />}

            {!errMsg && ready && channels === null && (
                <Skeleton.Text lines={5} />
            )}

            {!errMsg && ready && channels && channels.length === 0 && (
                <EmptyState
                    title="No channels"
                    description="No Slack channels were returned. Try refreshing, or check that the Slack provider has the conversations:read scope."
                />
            )}

            {!errMsg && ready && channels && channels.length > 0 && (
                <>
                    <Caption text={`${channels.length} channels`} />
                    <Menu>
                        {channels.map((ch) => {
                            const id = ch?.id || ch?.channel_id || ch?.name;
                            const name = ch?.name || id || "unknown";
                            const isPrivate = !!(ch?.is_private || ch?.private);
                            return (
                                <MenuItem
                                    key={id}
                                    selected={selectedId === id}
                                    onClick={() =>
                                        handleSelect({ id, name, isPrivate })
                                    }
                                >
                                    <div className="flex items-center justify-between w-full gap-2">
                                        <span>{`# ${name}`}</span>
                                        {isPrivate && <Tag2 title="private" />}
                                    </div>
                                </MenuItem>
                            );
                        })}
                    </Menu>
                </>
            )}
        </Panel>
    );
}
```

**File: SlackChannelBrowser.dash.js**

```javascript
import SlackChannelBrowser from "./SlackChannelBrowser";

export default {
    component: SlackChannelBrowser,
    canHaveChildren: false,
    workspace: "ai-built",
    type: "widget",
    userConfig: {
        title: {
            type: "text",
            defaultValue: "Slack channels",
            displayName: "Title",
            instructions: "The title shown at the top of the widget.",
            required: false,
        },
    },
    providers: [{ type: "slack", providerClass: "mcp", required: true }],
    events: ["channelSelected"],
};
```

**What it does**

-   On mount (and after every Refresh click), calls the Slack MCP tool `slack_list_channels` with `limit: 200`. Result parsing is defensive — handles raw `{ channels: [...] }`, plain arrays, and the MCP `{ content: [{ type: "text", text: "..." }] }` wrapping.
-   Renders rows in a `Menu` / `MenuItem`. Clicking a row sets `selected` on that row and fires the event.
-   Loading → `Skeleton.Text`, errors → `Alert2`, empty list → `EmptyState`, refresh → `Button2` (disabled until the MCP connection is ready).
-   Private channels get a `Tag2` chip; public channels show just `# name`.

**Events emitted**

-   `channelSelected` — fires when a channel row is clicked. Payload: `{ id, name, isPrivate }`. Wire a sibling widget (e.g., a Slack message-history widget) to it via Settings → Configure → Event Handlers to make it react to selection.

**Permissions to expect at install time**

-   None for `window.mainApi.*` — this is a pure MCP widget. The install modal will only confirm the Slack provider binding, not IPC method consent.
