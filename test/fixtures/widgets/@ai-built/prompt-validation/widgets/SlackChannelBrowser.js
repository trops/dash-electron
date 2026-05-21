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
    StatusBadge,
    Caption,
} from "@trops/dash-react";
import { useMcpProvider, useWidgetEvents } from "@trops/dash-core";

export default function SlackChannelBrowser({ title = "Slack Channels" }) {
    const {
        callTool,
        tools,
        isConnected,
        error: mcpError,
    } = useMcpProvider("slack");
    const { publishEvent } = useWidgetEvents();

    const [channels, setChannels] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [selectedId, setSelectedId] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = useCallback(() => {
        setRefreshKey((k) => k + 1);
    }, []);

    useEffect(() => {
        if (!isConnected || !Array.isArray(tools) || tools.length === 0) return;
        let cancelled = false;
        setChannels(null);
        setLoadError(null);
        callTool("slack_search_channels", { query: "" })
            .then((response) => {
                if (cancelled) return;
                // Defensive: tool responses vary in shape.
                const raw =
                    response?.channels ??
                    response?.results ??
                    response?.items ??
                    response;
                const list = Array.isArray(raw) ? raw : [];
                setChannels(list);
            })
            .catch((err) => {
                if (cancelled) return;
                setLoadError(err);
            });
        return () => {
            cancelled = true;
        };
    }, [isConnected, tools, refreshKey, callTool]);

    const handleSelect = useCallback(
        (channel) => {
            const id =
                channel?.id || channel?.channel_id || channel?.name || null;
            if (!id) return;
            setSelectedId(id);
            publishEvent("channelSelected", {
                id,
                name: typeof channel?.name === "string" ? channel.name : null,
                isPrivate: Boolean(channel?.is_private),
            });
        },
        [publishEvent]
    );

    const renderBody = () => {
        if (mcpError) {
            return (
                <Alert2
                    title="Slack connection error"
                    message={mcpError.message || String(mcpError)}
                />
            );
        }
        if (loadError) {
            return (
                <Alert2
                    title="Failed to load channels"
                    message={loadError.message || String(loadError)}
                />
            );
        }
        if (!isConnected) {
            return (
                <EmptyState
                    title="Slack not connected"
                    description="Waiting for the Slack provider to connect."
                />
            );
        }
        if (channels === null) {
            return <Skeleton.Text lines={6} />;
        }
        if (channels.length === 0) {
            return (
                <EmptyState
                    title="No channels found"
                    description="The Slack workspace returned no channels."
                />
            );
        }
        return (
            <Menu>
                {channels.map((channel) => {
                    const id =
                        channel?.id || channel?.channel_id || channel?.name;
                    const name =
                        typeof channel?.name === "string"
                            ? channel.name
                            : "(unnamed)";
                    const isPrivate = Boolean(channel?.is_private);
                    return (
                        <MenuItem
                            key={id}
                            selected={selectedId === id}
                            onClick={() => handleSelect(channel)}
                        >
                            <div className="flex items-center justify-between w-full gap-2">
                                <Caption text={`#${name}`} />
                                <StatusBadge
                                    state={isPrivate ? "warning" : "success"}
                                    label={isPrivate ? "private" : "public"}
                                    compact
                                />
                            </div>
                        </MenuItem>
                    );
                })}
            </Menu>
        );
    };

    return (
        <Panel>
            <div className="flex items-center justify-between mb-3 gap-2">
                <SubHeading2 title={title} />
                <Button2
                    title="Refresh"
                    onClick={refresh}
                    size="sm"
                    disabled={!isConnected}
                />
            </div>
            {renderBody()}
        </Panel>
    );
}
