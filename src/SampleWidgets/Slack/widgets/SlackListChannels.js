/**
 * SlackListChannels
 *
 * Scrollable list of Slack channels with search filter.
 * Publishes channelSelected event when a channel is clicked.
 *
 * Exemplar widget (post-cohesion rubric): every UI element is a
 * `@trops/dash-react` primitive that reads ThemeContext. No
 * hardcoded Tailwind color utilities — theme switches propagate.
 *
 * @package Slack
 */
import { useState, useEffect } from "react";
import {
    Panel,
    SubHeading2,
    SubHeading3,
    Caption,
    Caption2,
    Button2,
    Menu,
    MenuItem,
    InputText,
    StatusBadge,
    EmptyState,
    Alert2,
    Skeleton,
} from "@trops/dash-react";
import { Widget, useMcpProvider, useWidgetEvents } from "@trops/dash-core";
import { parseMcpResponse, parseSlackTextEntries } from "../utils/mcpUtils";

function connectionState({ isConnected, isConnecting, error }) {
    if (isConnected) return "success";
    if (isConnecting) return "pending";
    if (error) return "error";
    return "neutral";
}

function SlackListChannelsContent({ title, widgetId }) {
    const { isConnected, isConnecting, error, tools, callTool, status } =
        useMcpProvider("slack");
    const { publishEvent } = useWidgetEvents();

    const [channels, setChannels] = useState([]);
    const [filter, setFilter] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);

    const handleListChannels = async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const res = await callTool("slack_list_channels", {});
            const { data, error: mcpError } = parseMcpResponse(res, {
                arrayKeys: ["channels"],
                textParser: parseSlackTextEntries,
            });
            if (mcpError) {
                setFetchError(mcpError);
                return;
            }
            setChannels(Array.isArray(data) ? data : []);
        } catch (err) {
            setFetchError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isConnected) {
            handleListChannels();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected]);

    const handleSelect = (ch) => {
        const id = ch.id || ch;
        const name = ch.name || ch.id || ch;
        setSelectedId(id);
        publishEvent("channelSelected", { id, name });
    };

    const filtered = channels.filter((ch) => {
        const name = (ch.name || ch.id || String(ch)).toLowerCase();
        return name.includes(filter.toLowerCase());
    });

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

            {fetchError && (
                <Alert2 title="Failed to load channels" message={fetchError} />
            )}

            <div className="flex items-center justify-between">
                <SubHeading3 title="Channels" />
                <Button2
                    title={loading ? "Loading..." : "Refresh"}
                    onClick={handleListChannels}
                    disabled={!isConnected || loading}
                    size="sm"
                />
            </div>

            <InputText
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter channels..."
            />

            {loading && <Skeleton.Text lines={4} />}

            {!loading && filtered.length > 0 && (
                <Menu className="flex-1 overflow-y-auto space-y-1">
                    {filtered.map((ch, i) => (
                        <MenuItem
                            key={ch.id || i}
                            onClick={() => handleSelect(ch)}
                            selected={selectedId === (ch.id || ch)}
                        >
                            #{ch.name || ch.id || ch}
                        </MenuItem>
                    ))}
                </Menu>
            )}

            {!loading && !fetchError && channels.length === 0 && (
                <EmptyState
                    title={
                        isConnected ? "No channels yet" : "Slack not connected"
                    }
                    description={
                        isConnected
                            ? "Click Refresh to retry."
                            : "Connect the Slack provider in Settings to load channels."
                    }
                />
            )}

            {!loading &&
                channels.length > 0 &&
                filtered.length === 0 &&
                filter.length > 0 && (
                    <EmptyState
                        title="No matches"
                        description={`No channels match "${filter}".`}
                    />
                )}
        </div>
    );
}

export const SlackListChannels = ({
    title = "Slack Channels",
    widgetId,
    ...props
}) => {
    return (
        <Widget {...props} width="w-full" height="h-full">
            <Panel>
                <SlackListChannelsContent title={title} widgetId={widgetId} />
            </Panel>
        </Widget>
    );
};
