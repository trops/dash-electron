/**
 * PreflightConsentModal
 *
 * Shown once per workspace open when one or more widgets on the
 * dashboard have declared permissions that aren't yet granted. Lists
 * every missing permission across the dashboard in one consolidated
 * modal so the user makes their decisions ONCE instead of dripping
 * runtime JIT prompts.
 *
 * Layout: left sidebar lists widgets needing permissions (with a
 * badge count); right detail panel shows that widget's permissions
 * with per-line checkboxes (default checked). "Approve all visible"
 * batch-writes the user's selections via `widgetMcp.setGrant`.
 *
 * Not shown when:
 *   - No workspace mounted
 *   - workspaceData.layout has no widgets
 *   - All widgets' declared permissions are already granted
 *   - All widgets on the dashboard lack a manifest (drips through to
 *     runtime JIT, same as today)
 */
import React, { useContext, useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
    Button,
    FontAwesomeIcon,
    computeDashboardPreflight,
    humanizeAction,
    WorkspaceContext,
} from "@trops/dash-core";

// Build the keyed list of permission lines for a widget's `missing`
// blob — each line is selectable independently. Stable string keys so
// React state stays referenced across re-renders.
function flattenMissingToLines(missing) {
    const lines = [];
    if (!missing) return lines;
    if (missing.servers) {
        for (const [serverName, perms] of Object.entries(missing.servers)) {
            for (const tool of perms.tools || []) {
                lines.push({
                    key: `mcp:${serverName}:tool:${tool}`,
                    label: `${humanizeAction(
                        "mcp",
                        "callTool"
                    )} ${tool} on ${serverName}`,
                    apply: (acc) => {
                        acc.servers = acc.servers || {};
                        acc.servers[serverName] = acc.servers[serverName] || {
                            tools: [],
                            readPaths: [],
                            writePaths: [],
                        };
                        acc.servers[serverName].tools.push(tool);
                    },
                });
            }
            for (const p of perms.readPaths || []) {
                lines.push({
                    key: `mcp:${serverName}:readPath:${p}`,
                    label: `read files at ${p} (${serverName})`,
                    apply: (acc) => {
                        acc.servers = acc.servers || {};
                        acc.servers[serverName] = acc.servers[serverName] || {
                            tools: [],
                            readPaths: [],
                            writePaths: [],
                        };
                        acc.servers[serverName].readPaths.push(p);
                    },
                });
            }
            for (const p of perms.writePaths || []) {
                lines.push({
                    key: `mcp:${serverName}:writePath:${p}`,
                    label: `save files at ${p} (${serverName})`,
                    apply: (acc) => {
                        acc.servers = acc.servers || {};
                        acc.servers[serverName] = acc.servers[serverName] || {
                            tools: [],
                            readPaths: [],
                            writePaths: [],
                        };
                        acc.servers[serverName].writePaths.push(p);
                    },
                });
            }
        }
    }
    if (missing.domains?.fs) {
        const fs = missing.domains.fs;
        for (const action of fs.actions || []) {
            lines.push({
                key: `fs:action:${action}`,
                label: humanizeAction("fs", action),
                apply: (acc) => {
                    acc.domains = acc.domains || {};
                    acc.domains.fs = acc.domains.fs || {
                        actions: [],
                        readPaths: [],
                        writePaths: [],
                    };
                    acc.domains.fs.actions.push(action);
                },
            });
        }
        for (const p of fs.readPaths || []) {
            lines.push({
                key: `fs:readPath:${p}`,
                label: `read file ${p}`,
                apply: (acc) => {
                    acc.domains = acc.domains || {};
                    acc.domains.fs = acc.domains.fs || {
                        actions: [],
                        readPaths: [],
                        writePaths: [],
                    };
                    acc.domains.fs.readPaths.push(p);
                },
            });
        }
        for (const p of fs.writePaths || []) {
            lines.push({
                key: `fs:writePath:${p}`,
                label: `save file ${p}`,
                apply: (acc) => {
                    acc.domains = acc.domains || {};
                    acc.domains.fs = acc.domains.fs || {
                        actions: [],
                        readPaths: [],
                        writePaths: [],
                    };
                    acc.domains.fs.writePaths.push(p);
                },
            });
        }
    }
    if (missing.domains?.network) {
        const net = missing.domains.network;
        for (const host of net.hosts || []) {
            lines.push({
                key: `net:host:${host}`,
                label: `${humanizeAction(
                    "network",
                    "readDataFromURL"
                )} ${host}`,
                apply: (acc) => {
                    acc.domains = acc.domains || {};
                    acc.domains.network = acc.domains.network || {
                        actions: [],
                        hosts: [],
                    };
                    acc.domains.network.hosts.push(host);
                },
            });
        }
        for (const action of net.actions || []) {
            lines.push({
                key: `net:action:${action}`,
                label: humanizeAction("network", action),
                apply: (acc) => {
                    acc.domains = acc.domains || {};
                    acc.domains.network = acc.domains.network || {
                        actions: [],
                        hosts: [],
                    };
                    acc.domains.network.actions.push(action);
                },
            });
        }
    }
    return lines;
}

export const PreflightConsentModal = () => {
    const workspace = useContext(WorkspaceContext);
    const workspaceId = workspace?.workspaceData?.id;
    const layout = workspace?.workspaceData?.layout;

    // null when no scan has run, [] when scan ran with nothing missing.
    const [needingWidgets, setNeedingWidgets] = useState(null);
    const [selectedWidgetId, setSelectedWidgetId] = useState(null);
    // checked[widgetId][lineKey] = true|false
    const [checked, setChecked] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const runScan = useCallback(async () => {
        if (!layout || !window.mainApi?.widgetMcp?.listAll) {
            setNeedingWidgets([]);
            return;
        }
        try {
            const allRows = await window.mainApi.widgetMcp.listAll();
            const result = computeDashboardPreflight({
                layout,
                allRows: Array.isArray(allRows) ? allRows : [],
            });
            const ws = result.widgets || [];
            setNeedingWidgets(ws);
            if (ws.length > 0) {
                setSelectedWidgetId(ws[0].widgetId);
                // Default every line checked.
                const initialChecked = {};
                for (const w of ws) {
                    const lines = flattenMissingToLines(w.missing);
                    initialChecked[w.widgetId] = {};
                    for (const ln of lines) {
                        initialChecked[w.widgetId][ln.key] = true;
                    }
                }
                setChecked(initialChecked);
            }
        } catch (e) {
            console.error("[PreflightConsentModal] scan failed:", e);
            setNeedingWidgets([]);
        }
    }, [layout]);

    // Re-run scan whenever the active workspace changes.
    useEffect(() => {
        setNeedingWidgets(null);
        if (!workspaceId) return;
        runScan();
    }, [workspaceId, runScan]);

    if (!needingWidgets || needingWidgets.length === 0) return null;

    const selected =
        needingWidgets.find((w) => w.widgetId === selectedWidgetId) ||
        needingWidgets[0];
    const selectedLines = flattenMissingToLines(selected.missing);

    const toggleLine = (widgetId, lineKey) => {
        setChecked((prev) => ({
            ...prev,
            [widgetId]: {
                ...(prev[widgetId] || {}),
                [lineKey]: !(prev[widgetId] && prev[widgetId][lineKey]),
            },
        }));
    };

    const close = () => {
        setNeedingWidgets([]);
        setSelectedWidgetId(null);
        setChecked({});
    };

    const approveAll = async () => {
        if (!window.mainApi?.widgetMcp?.setGrant) {
            close();
            return;
        }
        setIsSubmitting(true);
        try {
            for (const w of needingWidgets) {
                const lines = flattenMissingToLines(w.missing);
                const acc = { grantOrigin: "manual" };
                let any = false;
                for (const ln of lines) {
                    if (checked[w.widgetId]?.[ln.key]) {
                        ln.apply(acc);
                        any = true;
                    }
                }
                if (!any) continue;
                // setGrant overwrites — union with the widget's
                // existing grant (carried on the scan result so we
                // don't need a getGrant IPC) so unrelated grants the
                // user already had (e.g. live JIT additions beyond
                // the manifest) aren't dropped.
                const merged = mergeGrants(w.granted || null, acc);
                await window.mainApi.widgetMcp.setGrant(w.widgetId, merged);
            }
        } catch (e) {
            console.error("[PreflightConsentModal] approveAll failed:", e);
        } finally {
            setIsSubmitting(false);
            close();
        }
    };

    const overlay = (
        <>
            <div
                className="fixed inset-0 bg-black bg-opacity-70 z-50"
                onClick={close}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
                <div
                    className="flex flex-col w-full max-w-4xl h-[80vh] border-2 border-purple-500 rounded bg-gray-900 pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex flex-col gap-1 px-5 py-4 border-b border-gray-700">
                        <div className="flex items-center gap-3">
                            <FontAwesomeIcon
                                icon="bolt"
                                className="h-4 w-4 text-purple-400"
                            />
                            <span className="text-base font-semibold text-gray-100">
                                Review permissions for this dashboard
                            </span>
                        </div>
                        <span className="text-xs text-gray-400 ml-7">
                            {needingWidgets.length}{" "}
                            {needingWidgets.length === 1 ? "widget" : "widgets"}{" "}
                            need permission to function. You can review what
                            each one is asking for and approve them all at once.
                        </span>
                    </div>

                    {/* Body — sidebar + detail */}
                    <div className="flex flex-1 min-h-0">
                        {/* Sidebar */}
                        <div className="flex flex-col w-64 border-r border-gray-800 overflow-y-auto">
                            {needingWidgets.map((w) => {
                                const isActive =
                                    w.widgetId === selected.widgetId;
                                const lineCount = flattenMissingToLines(
                                    w.missing
                                ).length;
                                return (
                                    <button
                                        key={w.widgetId}
                                        onClick={() =>
                                            setSelectedWidgetId(w.widgetId)
                                        }
                                        className={`flex items-center justify-between gap-2 px-4 py-3 text-left text-sm border-b border-gray-800 transition-colors ${
                                            isActive
                                                ? "bg-purple-900/30 text-gray-100"
                                                : "text-gray-300 hover:bg-gray-800/50"
                                        }`}
                                    >
                                        <div className="flex flex-col min-w-0 gap-0.5">
                                            <span className="truncate">
                                                {w.displayName}
                                            </span>
                                            <span className="text-xs opacity-60 truncate">
                                                {w.packageId}
                                            </span>
                                        </div>
                                        <span className="text-xs px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 flex-shrink-0">
                                            {lineCount}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Detail */}
                        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-5">
                            <div className="flex flex-col gap-1 mb-4">
                                <span className="text-base font-semibold text-gray-100">
                                    {selected.displayName}
                                </span>
                                <span className="text-xs text-gray-400">
                                    From{" "}
                                    <span className="font-mono">
                                        {selected.packageId}
                                    </span>
                                </span>
                            </div>
                            <div className="flex flex-col gap-2">
                                {selectedLines.map((ln) => {
                                    const isChecked =
                                        !!checked[selected.widgetId]?.[ln.key];
                                    return (
                                        <label
                                            key={ln.key}
                                            className="flex items-center gap-3 px-3 py-2 rounded bg-gray-950/50 border border-gray-800 cursor-pointer hover:bg-gray-900/50"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() =>
                                                    toggleLine(
                                                        selected.widgetId,
                                                        ln.key
                                                    )
                                                }
                                                className="cursor-pointer"
                                                disabled={isSubmitting}
                                            />
                                            <span className="text-sm text-gray-200">
                                                {ln.label}
                                            </span>
                                        </label>
                                    );
                                })}
                                {selectedLines.length === 0 && (
                                    <span className="text-sm opacity-50">
                                        No permissions to review.
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex flex-row gap-2 justify-end px-5 py-3 border-t border-gray-700">
                        <Button
                            title="Skip — ask me later"
                            onClick={close}
                            backgroundColor="bg-gray-800"
                            textColor="text-gray-200"
                            hoverBackgroundColor="hover:bg-gray-700"
                            disabled={isSubmitting}
                        />
                        <Button
                            title="Approve all checked"
                            onClick={approveAll}
                            backgroundColor="bg-purple-600"
                            textColor="text-white"
                            hoverBackgroundColor="hover:bg-purple-500"
                            disabled={isSubmitting}
                        />
                    </div>
                </div>
            </div>
        </>
    );

    return createPortal(overlay, document.body);
};

// Tiny merge — same shape as the gate's setGrant accepts. Keeps any
// existing grants the user already had on this widget that aren't in
// the addition (e.g. previously-approved JIT grants beyond the
// manifest).
function mergeGrants(existing, addition) {
    const out = {
        grantOrigin: addition.grantOrigin || existing?.grantOrigin || "manual",
        servers: { ...(existing?.servers || {}) },
        domains: { ...(existing?.domains || {}) },
    };
    for (const [name, perms] of Object.entries(addition.servers || {})) {
        const prev = out.servers[name] || {
            tools: [],
            readPaths: [],
            writePaths: [],
        };
        out.servers[name] = {
            tools: [
                ...new Set([...(prev.tools || []), ...(perms.tools || [])]),
            ],
            readPaths: [
                ...new Set([
                    ...(prev.readPaths || []),
                    ...(perms.readPaths || []),
                ]),
            ],
            writePaths: [
                ...new Set([
                    ...(prev.writePaths || []),
                    ...(perms.writePaths || []),
                ]),
            ],
        };
    }
    if (addition.domains?.fs) {
        const prev = out.domains.fs || {
            actions: [],
            readPaths: [],
            writePaths: [],
        };
        const next = addition.domains.fs;
        out.domains.fs = {
            actions: [
                ...new Set([...(prev.actions || []), ...(next.actions || [])]),
            ],
            readPaths: [
                ...new Set([
                    ...(prev.readPaths || []),
                    ...(next.readPaths || []),
                ]),
            ],
            writePaths: [
                ...new Set([
                    ...(prev.writePaths || []),
                    ...(next.writePaths || []),
                ]),
            ],
        };
    }
    if (addition.domains?.network) {
        const prev = out.domains.network || { actions: [], hosts: [] };
        const next = addition.domains.network;
        out.domains.network = {
            actions: [
                ...new Set([...(prev.actions || []), ...(next.actions || [])]),
            ],
            hosts: [...new Set([...(prev.hosts || []), ...(next.hosts || [])])],
        };
    }
    return out;
}

export default PreflightConsentModal;
