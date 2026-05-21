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

// slack-mcp-server returns channels_list as CSV inside the MCP
// text content. Parse it into channel objects. JSON branches kept
// as fallbacks in case a different Slack MCP server is swapped in.
function parseCsvLine(line) {
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            if (inQ && line[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQ = !inQ;
            }
        } else if (c === "," && !inQ) {
            out.push(cur);
            cur = "";
        } else {
            cur += c;
        }
    }
    out.push(cur);
    return out;
}

function csvToObjects(text) {
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];
    const headers = parseCsvLine(lines[0]).map((h) => h.trim());
    return lines.slice(1).map((line) => {
        const cells = parseCsvLine(line);
        const obj = {};
        headers.forEach((h, i) => {
            obj[h] = cells[i];
        });
        return obj;
    });
}

function parseChannels(res) {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.channels)) return res.channels;
    if (Array.isArray(res?.content)) {
        for (const part of res.content) {
            if (part?.type === "text" && typeof part.text === "string") {
                const text = part.text.trim();
                try {
                    const parsed = JSON.parse(text);
                    if (Array.isArray(parsed?.channels)) return parsed.channels;
                    if (Array.isArray(parsed)) return parsed;
                } catch {
                    // not JSON — fall through to CSV
                }
                if (/^ID,Name(,|$)/i.test(text)) {
                    return csvToObjects(text).map((row) => ({
                        id: row.ID,
                        name: row.Name?.replace(/^#/, ""),
                        topic: row.Topic,
                        purpose: row.Purpose,
                        memberCount: Number(row.MemberCount) || 0,
                    }));
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
        callTool("channels_list", { limit: 200 })
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
