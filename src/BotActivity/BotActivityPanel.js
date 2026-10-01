import React, { useEffect, useState, useCallback } from "react";
import {
    Button,
    Button2,
    Button3,
    EmptyState,
    FontAwesomeIcon,
} from "@trops/dash-react";
import { reduceFeed } from "./runFeed";

/**
 * BotActivityPanel — a right slide-over (mirrors AiAssistantPanel) for watching
 * and steering bots: a pending-approvals queue, a "Run now" control, and a live
 * feed of the current run's streamed BotEvents. Talks to the main process over
 * window.mainApi.bots (list/run/stop/approve/listApprovals + onStream /
 * onApprovalPending). Self-contained collapse/expand; no external navbar state.
 */
export const BotActivityPanel = ({
    collapsed: collapsedProp,
    onCollapsedChange,
    docked = false,
    onApprovalsCount,
} = {}) => {
    const bgDark = "chrome-glass";
    const borderColor = "border-neutral-800";

    const bots = window.mainApi && window.mainApi.bots;

    // Collapsed state is controllable (by AssistantDock) but falls back to
    // internal state so the panel still works standalone.
    const [collapsedInternal, setCollapsedInternal] = useState(true);
    const collapsed =
        collapsedProp !== undefined ? collapsedProp : collapsedInternal;
    const setCollapsed = (next) => {
        if (onCollapsedChange) onCollapsedChange(next);
        else setCollapsedInternal(next);
    };
    const [botList, setBotList] = useState([]);
    const [selectedBotId, setSelectedBotId] = useState("");
    const [prompt, setPrompt] = useState("");
    const [feed, setFeed] = useState([]);
    const [running, setRunning] = useState(false);
    const [approvals, setApprovals] = useState([]);

    const refreshBots = useCallback(async () => {
        if (!bots) return;
        try {
            const list = await bots.list();
            setBotList(Array.isArray(list) ? list : []);
        } catch (e) {
            /* transient */
        }
    }, [bots]);

    const refreshApprovals = useCallback(async () => {
        if (!bots) return;
        try {
            const list = await bots.listApprovals();
            setApprovals(Array.isArray(list) ? list : []);
        } catch (e) {
            /* transient */
        }
    }, [bots]);

    // Load lists when the panel opens.
    useEffect(() => {
        if (!collapsed) {
            refreshBots();
            refreshApprovals();
        }
    }, [collapsed, refreshBots, refreshApprovals]);

    // Keep the approvals badge accurate even while docked/collapsed: load once
    // on mount and report the count up to the dock rail.
    useEffect(() => {
        refreshApprovals();
    }, [refreshApprovals]);

    useEffect(() => {
        if (onApprovalsCount) onApprovalsCount(approvals.length);
    }, [approvals, onApprovalsCount]);

    // Subscribe to streamed run events + pending approvals for the lifetime of
    // the panel (so the badge stays live even while collapsed).
    useEffect(() => {
        if (!bots) return undefined;
        const streamId = bots.onStream(({ botId, event }) => {
            if (botId !== selectedBotId) return;
            setFeed((prev) => reduceFeed(prev, event));
            if (event.type === "done" || event.type === "error")
                setRunning(false);
        });
        const approvalId = bots.onApprovalPending((approval) => {
            setApprovals((prev) => [...prev, approval]);
        });
        return () => {
            bots.removeListener(streamId);
            bots.removeListener(approvalId);
        };
    }, [bots, selectedBotId]);

    const handleRun = async () => {
        if (!bots || !selectedBotId) return;
        setFeed([]);
        setRunning(true);
        try {
            await bots.run(selectedBotId, prompt);
        } catch (e) {
            setFeed((prev) =>
                reduceFeed(prev, { type: "error", message: e.message })
            );
        } finally {
            setRunning(false);
        }
    };

    const handleStop = async () => {
        if (bots && selectedBotId) await bots.stop(selectedBotId);
        setRunning(false);
    };

    // remember=true ("Always allow") saves the approval for this bot +
    // provider + tool so later runs use it without asking.
    const decide = async (approvalId, allow, remember = false) => {
        if (bots) {
            await bots.approve(
                approvalId,
                remember ? { allow, remember: true } : { allow }
            );
        }
        setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
    };

    if (collapsed) {
        // When docked, AssistantDock renders the shared rail + toggle button.
        if (docked) return null;
        return (
            <div
                className={`flex flex-col items-center w-10 border-l ${borderColor} ${bgDark} shrink-0 h-screen`}
            >
                <button
                    onClick={() => setCollapsed(false)}
                    className="mt-3 p-2 rounded-lg text-gray-400 relative"
                    title="Open Bot Activity"
                >
                    <FontAwesomeIcon icon="robot" className="h-4 w-4" />
                    {approvals.length > 0 ? (
                        <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                            {approvals.length}
                        </span>
                    ) : null}
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-row shrink-0 h-screen" style={{ width: 384 }}>
            <div
                className={`flex flex-col flex-1 min-w-0 ${bgDark} overflow-hidden border-l ${borderColor}`}
            >
                <div
                    className={`flex items-center justify-between px-3 py-1.5 border-b ${borderColor} shrink-0`}
                >
                    <div className="flex items-center gap-2">
                        <FontAwesomeIcon
                            icon="robot"
                            className="h-3.5 w-3.5 text-gray-400"
                        />
                        <span className="text-xs font-medium tracking-wide text-gray-300">
                            BOT ACTIVITY
                        </span>
                    </div>
                    <button
                        onClick={() => setCollapsed(true)}
                        className="p-1 rounded text-gray-500"
                        title="Collapse"
                    >
                        <FontAwesomeIcon
                            icon="chevron-right"
                            className="h-3 w-3"
                        />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto flex flex-col">
                    {/* Approvals */}
                    {approvals.length > 0 ? (
                        <div
                            className={`border-b ${borderColor} p-3 flex flex-col gap-2`}
                        >
                            <span className="text-xs font-medium text-gray-400">
                                Pending approvals
                            </span>
                            {approvals.map((a) => (
                                <div
                                    key={a.id}
                                    className={`rounded border ${borderColor} p-2 flex flex-col gap-2`}
                                >
                                    <span className="text-sm text-gray-200">
                                        {(a.request && a.request.toolName) ||
                                            "tool"}{" "}
                                        {a.request && a.request.serverName
                                            ? `on ${a.request.serverName}`
                                            : "(built-in)"}
                                    </span>
                                    <div className="flex flex-row flex-wrap gap-2">
                                        <Button2
                                            title="Allow once"
                                            size="xs"
                                            onClick={() => decide(a.id, true)}
                                        />
                                        {/* Only provider tools can be
                                            remembered; built-ins always ask. */}
                                        {a.request && a.request.serverName ? (
                                            <Button
                                                title="Always allow"
                                                size="xs"
                                                tooltip="Let this bot use this tool without asking again (revoke in Settings › Bots)"
                                                onClick={() =>
                                                    decide(a.id, true, true)
                                                }
                                            />
                                        ) : null}
                                        <Button3
                                            title="Deny"
                                            size="xs"
                                            danger
                                            onClick={() => decide(a.id, false)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    {/* Run control */}
                    <div
                        className={`border-b ${borderColor} p-3 flex flex-col gap-2`}
                    >
                        <span className="text-xs font-medium text-gray-400">
                            Run a bot
                        </span>
                        <select
                            value={selectedBotId}
                            onChange={(e) => setSelectedBotId(e.target.value)}
                            className="bg-gray-800 text-gray-200 text-sm rounded p-1.5"
                        >
                            <option value="">Select a bot…</option>
                            {botList.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                        <input
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Prompt (optional)"
                            className="bg-gray-800 text-gray-200 text-sm rounded p-1.5"
                        />
                        <div className="flex flex-row gap-2">
                            <button
                                onClick={handleRun}
                                disabled={!selectedBotId || running}
                                className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
                            >
                                {running ? "Running…" : "Run"}
                            </button>
                            {running ? (
                                <button
                                    onClick={handleStop}
                                    className="px-3 py-1 rounded bg-gray-700 text-white text-sm"
                                >
                                    Stop
                                </button>
                            ) : null}
                        </div>
                    </div>

                    {/* Feed */}
                    <div className="flex-1 p-3 flex flex-col gap-2">
                        {feed.length === 0 ? (
                            <EmptyState
                                icon="robot"
                                title="No run yet"
                                description="Pick a bot and press Run to watch it work."
                            />
                        ) : (
                            feed.map((item, i) => (
                                <FeedItem
                                    key={i}
                                    item={item}
                                    borderColor={borderColor}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const FeedItem = ({ item, borderColor }) => {
    if (item.type === "text") {
        return <div className="text-sm text-gray-200">{item.text}</div>;
    }
    if (item.type === "tool") {
        return (
            <div
                className={`rounded border ${borderColor} p-2 flex flex-col gap-1`}
            >
                <div className="flex items-center gap-2">
                    <FontAwesomeIcon
                        icon={item.status === "running" ? "spinner" : "wrench"}
                        className="h-3 w-3 text-gray-400"
                    />
                    <span className="text-xs text-gray-300">{item.name}</span>
                </div>
                {item.output ? (
                    <span
                        className={`text-xs ${
                            item.isError ? "text-red-400" : "text-gray-400"
                        }`}
                    >
                        {item.output}
                    </span>
                ) : null}
            </div>
        );
    }
    if (item.type === "error") {
        return <div className="text-sm text-red-400">{item.message}</div>;
    }
    if (item.type === "warning") {
        return <div className="text-xs text-amber-400">{item.message}</div>;
    }
    if (item.type === "skipped") {
        return (
            <div className="text-xs text-gray-500">Skipped: {item.reason}</div>
        );
    }
    if (item.type === "done") {
        return <div className="text-xs text-gray-500">Run complete.</div>;
    }
    return null;
};
