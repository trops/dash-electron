/**
 * WidgetMcpConsentModal
 *
 * Per-widget MCP allowlist. Subscribes to `widget:mcp-consent-required`
 * via `window.mainApi.widgetMcp.onConsentRequired` — emitted by
 * dash-core's widgetRegistry after a widget is installed and declares
 * `dash.permissions.mcp` in its package.json.
 *
 * Aggregates events into a single review modal: during a batch update,
 * the registry fires one event per package, but the user should review
 * ALL pending grants in one place rather than getting prompted N
 * times for N installs (each previous prompt previously got
 * overwritten by the next event, so only the last package's grants
 * were visible). The modal stays open as more events arrive and grows
 * its list; Grant / Decline iterate over the full queue.
 *
 * Cross-widget warning: paths granted here become readable/writable by ANY
 * widget on the same dashboard that uses the same MCP server, because Slice 1
 * shares MCP servers per process. Slice 3 will move to per-dashboard server
 * scope reconfiguration; until then, the modal makes the implication explicit.
 */
import React, { useEffect, useState, useContext } from "react";
import {
    Modal,
    Button,
    ThemeContext,
    FontAwesomeIcon,
} from "@trops/dash-react";

const buildInitialSelectionForRequest = (payload) => {
    const servers = payload.declared?.servers || {};
    const sel = {};
    for (const [name, perms] of Object.entries(servers)) {
        sel[name] = {
            tools: Object.fromEntries(
                (perms.tools || []).map((t) => [t, true])
            ),
            readPaths: Object.fromEntries(
                (perms.readPaths || []).map((p) => [p, true])
            ),
            writePaths: Object.fromEntries(
                (perms.writePaths || []).map((p) => [p, true])
            ),
        };
    }
    return sel;
};

export const WidgetMcpConsentModal = () => {
    const { currentTheme } = useContext(ThemeContext);
    const borderColor =
        currentTheme?.["border-primary-dark"] || "border-gray-700/50";

    // Queue of consent requests. Each entry:
    //   { widgetId, declared, discovered }
    // Appended on every incoming event, deduplicated by widgetId so
    // re-emits replace (don't double-list) the same widget.
    const [requests, setRequests] = useState([]);
    // selection is keyed by widgetId, then mirrors the per-server
    // shape so the user can toggle individual tools/paths across all
    // widgets in one pass.
    const [selection, setSelection] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!window.mainApi?.widgetMcp?.onConsentRequired) return;
        const cleanup = window.mainApi.widgetMcp.onConsentRequired(
            (payload) => {
                if (!payload?.widgetId || !payload?.declared) return;
                setSelection((prev) => ({
                    ...prev,
                    [payload.widgetId]:
                        buildInitialSelectionForRequest(payload),
                }));
                setRequests((prev) => {
                    // Dedup: replace existing entry for the same widgetId
                    // (the latest event wins) rather than listing the
                    // same widget twice.
                    const next = prev.filter(
                        (r) => r.widgetId !== payload.widgetId
                    );
                    next.push(payload);
                    return next;
                });
                setError(null);
                setIsSubmitting(false);
            }
        );
        return cleanup;
    }, []);

    if (requests.length === 0) return null;

    const isDiscoveredBatch = requests.some((r) => r.discovered);

    const toggleEntry = (widgetId, serverName, kind, key) => {
        setSelection((prev) => ({
            ...prev,
            [widgetId]: {
                ...prev[widgetId],
                [serverName]: {
                    ...prev[widgetId][serverName],
                    [kind]: {
                        ...prev[widgetId][serverName][kind],
                        [key]: !prev[widgetId][serverName][kind][key],
                    },
                },
            },
        }));
    };

    const buildGrantedPermsForRequest = (req) => {
        const declaredServers = req.declared?.servers || {};
        const widgetSel = selection[req.widgetId] || {};
        const servers = {};
        for (const [name, decl] of Object.entries(declaredServers)) {
            const sel = widgetSel[name] || {};
            const tools = (decl.tools || []).filter((t) => sel.tools?.[t]);
            const readPaths = (decl.readPaths || []).filter(
                (p) => sel.readPaths?.[p]
            );
            const writePaths = (decl.writePaths || []).filter(
                (p) => sel.writePaths?.[p]
            );
            // Drop a server entirely if no tools were granted — there's no
            // way to use it without at least one tool.
            if (tools.length === 0) continue;
            servers[name] = { tools, readPaths, writePaths };
        }
        return {
            servers,
            // Tag the persisted grant with how the user got here:
            //   "discovered" — install-time scan synthesized the manifest
            //   "declared"   — developer's package.json declared it
            grantOrigin: req.discovered ? "discovered" : "declared",
        };
    };

    const handleGrant = async () => {
        setError(null);
        setIsSubmitting(true);
        try {
            for (const req of requests) {
                const grantBody = buildGrantedPermsForRequest(req);
                const ok = await window.mainApi?.widgetMcp?.setGrant?.(
                    req.widgetId,
                    grantBody
                );
                if (ok === false) {
                    setError(
                        `Could not save grant for ${req.widgetId}. See main-process logs.`
                    );
                    setIsSubmitting(false);
                    return;
                }
            }
            setRequests([]);
            setSelection({});
        } catch (err) {
            setError(err?.message || "Could not save grant.");
            setIsSubmitting(false);
        }
    };

    const handleDecline = async () => {
        setError(null);
        setIsSubmitting(true);
        try {
            // Write an empty-servers grant for every queued widget so
            // each is clearly "user decided no" — the gate denies (no
            // servers entry) AND the install flow doesn't re-prompt.
            // Origin tag preserved per request.
            for (const req of requests) {
                await window.mainApi?.widgetMcp?.setGrant?.(req.widgetId, {
                    servers: {},
                    grantOrigin: req.discovered ? "discovered" : "declared",
                });
            }
            setRequests([]);
            setSelection({});
        } catch (err) {
            setError(err?.message || "Could not record decline.");
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        // No grant write — modal will re-appear on next install hook /
        // launch retroactive prompt.
        setRequests([]);
        setSelection({});
    };

    const headerTitle =
        requests.length === 1
            ? isDiscoveredBatch
                ? `Discovered MCP usage: ${requests[0].widgetId}`
                : `Grant MCP permissions: ${requests[0].widgetId}`
            : `${requests.length} widgets request MCP access`;

    const headerSubtitle = isDiscoveredBatch
        ? "Some widgets did not declare their MCP needs. The list below is from a static scan of the source — best-effort guesses, not the developers' declarations. Review carefully before granting."
        : "These widgets request access to the MCP servers below. Only granted items are enforced — uncheck anything you don't want to allow.";

    return (
        <Modal
            isOpen={requests.length > 0}
            setIsOpen={(open) => !open && handleCancel()}
        >
            {/* dash-react's Modal wraps children in a wide container;
                mx-auto + max-w-xl recenters this narrower dialog the
                same way AppUpdatesModal does. */}
            <div
                className={`flex flex-col w-full max-w-xl mx-auto ${
                    isDiscoveredBatch ? "ring-2 ring-amber-500" : ""
                }`}
            >
                <div
                    className={`flex items-start gap-3 px-5 py-4 border-b ${borderColor}`}
                >
                    <FontAwesomeIcon
                        icon={
                            isDiscoveredBatch
                                ? "triangle-exclamation"
                                : "shield-halved"
                        }
                        className={`h-4 w-4 mt-1 ${
                            isDiscoveredBatch
                                ? "text-amber-500"
                                : "text-amber-400"
                        }`}
                    />
                    <div>
                        <div className="text-base font-semibold text-gray-100">
                            {headerTitle}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                            {headerSubtitle}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-4 px-5 py-4 max-h-96 overflow-y-auto">
                    <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700/40 rounded px-3 py-2">
                        Granted paths become visible to any widget on this
                        dashboard that uses the same MCP server. You can revoke
                        at any time in Settings → Privacy & Security.
                    </div>

                    {requests.map((req) => {
                        const declaredServers = req.declared?.servers || {};
                        const widgetSel = selection[req.widgetId] || {};
                        return (
                            <div
                                key={req.widgetId}
                                className="rounded-md bg-gray-900/40 border border-gray-700/40 p-3 space-y-3"
                            >
                                {requests.length > 1 && (
                                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-200">
                                        <FontAwesomeIcon
                                            icon="puzzle-piece"
                                            className="text-xs text-gray-400"
                                        />
                                        <span className="font-mono">
                                            {req.widgetId}
                                        </span>
                                        {req.discovered && (
                                            <span className="text-[10px] uppercase tracking-wider text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded">
                                                discovered
                                            </span>
                                        )}
                                    </div>
                                )}
                                {Object.entries(declaredServers).map(
                                    ([serverName, decl]) => {
                                        const sel = widgetSel[serverName] || {};
                                        return (
                                            <div
                                                key={serverName}
                                                className="space-y-3 pl-2 border-l border-gray-700/50"
                                            >
                                                <div className="text-xs uppercase tracking-wider text-gray-400">
                                                    {serverName}
                                                </div>

                                                {(decl.tools || []).length >
                                                    0 && (
                                                    <div className="space-y-1">
                                                        <div className="text-[11px] text-gray-500">
                                                            Tools
                                                        </div>
                                                        {decl.tools.map((t) => (
                                                            <label
                                                                key={t}
                                                                className="flex items-center gap-2 text-xs text-gray-300"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={
                                                                        !!sel
                                                                            .tools?.[
                                                                            t
                                                                        ]
                                                                    }
                                                                    onChange={() =>
                                                                        toggleEntry(
                                                                            req.widgetId,
                                                                            serverName,
                                                                            "tools",
                                                                            t
                                                                        )
                                                                    }
                                                                />
                                                                <span className="font-mono">
                                                                    {t}
                                                                </span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}

                                                {(decl.readPaths || []).length >
                                                    0 && (
                                                    <div className="space-y-1">
                                                        <div className="text-[11px] text-gray-500">
                                                            Read paths
                                                        </div>
                                                        {decl.readPaths.map(
                                                            (p) => (
                                                                <label
                                                                    key={p}
                                                                    className="flex items-center gap-2 text-xs text-gray-300"
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={
                                                                            !!sel
                                                                                .readPaths?.[
                                                                                p
                                                                            ]
                                                                        }
                                                                        onChange={() =>
                                                                            toggleEntry(
                                                                                req.widgetId,
                                                                                serverName,
                                                                                "readPaths",
                                                                                p
                                                                            )
                                                                        }
                                                                    />
                                                                    <span className="font-mono break-all">
                                                                        {p}
                                                                    </span>
                                                                </label>
                                                            )
                                                        )}
                                                    </div>
                                                )}

                                                {(decl.writePaths || [])
                                                    .length > 0 && (
                                                    <div className="space-y-1">
                                                        <div className="text-[11px] text-gray-500">
                                                            Write paths
                                                        </div>
                                                        {decl.writePaths.map(
                                                            (p) => (
                                                                <label
                                                                    key={p}
                                                                    className="flex items-center gap-2 text-xs text-gray-300"
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={
                                                                            !!sel
                                                                                .writePaths?.[
                                                                                p
                                                                            ]
                                                                        }
                                                                        onChange={() =>
                                                                            toggleEntry(
                                                                                req.widgetId,
                                                                                serverName,
                                                                                "writePaths",
                                                                                p
                                                                            )
                                                                        }
                                                                    />
                                                                    <span className="font-mono break-all">
                                                                        {p}
                                                                    </span>
                                                                </label>
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }
                                )}
                            </div>
                        );
                    })}

                    {error && (
                        <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/40 rounded px-3 py-2">
                            {error}
                        </div>
                    )}
                </div>

                <div
                    className={`flex justify-end gap-2 px-5 py-3 border-t ${borderColor}`}
                >
                    <Button
                        title="Cancel"
                        onClick={handleCancel}
                        textSize="text-sm"
                        padding="py-1.5 px-3"
                        backgroundColor="bg-gray-700"
                        textColor="text-gray-200"
                        hoverTextColor="hover:text-white"
                        hoverBackgroundColor="hover:bg-gray-600"
                        disabled={isSubmitting}
                    />
                    <Button
                        title={
                            requests.length > 1
                                ? `Decline all (${requests.length})`
                                : "Decline all"
                        }
                        onClick={handleDecline}
                        textSize="text-sm"
                        padding="py-1.5 px-3"
                        backgroundColor="bg-gray-800"
                        textColor="text-gray-300"
                        hoverTextColor="hover:text-white"
                        hoverBackgroundColor="hover:bg-gray-700"
                        disabled={isSubmitting}
                    />
                    <Button
                        title={
                            requests.length > 1
                                ? `Grant selected (${requests.length})`
                                : "Grant selected"
                        }
                        onClick={handleGrant}
                        textSize="text-sm"
                        padding="py-1.5 px-3"
                        backgroundColor="bg-indigo-600"
                        textColor="text-white"
                        hoverTextColor="hover:text-white"
                        hoverBackgroundColor="hover:bg-indigo-500"
                        disabled={isSubmitting}
                    />
                </div>
            </div>
        </Modal>
    );
};

export default WidgetMcpConsentModal;
