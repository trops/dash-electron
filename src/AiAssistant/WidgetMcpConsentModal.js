/**
 * WidgetMcpConsentModal
 *
 * Slice 2 of the per-widget MCP allowlist. Subscribes to
 * `widget:mcp-consent-required` via `window.mainApi.widgetMcp.onConsentRequired`
 * — emitted by dash-core's widgetRegistry after a widget is installed and
 * declares `dash.permissions.mcp` in its package.json.
 *
 * The user reviews the requested tool names and read/write paths per server,
 * unchecks anything they don't want to grant, and submits. The selection is
 * persisted via `window.mainApi.widgetMcp.setGrant(widgetId, perms)` and the
 * runtime gate enforces it from then on. A widget without a grant is denied
 * — fail-closed.
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

export const WidgetMcpConsentModal = () => {
    const { currentTheme } = useContext(ThemeContext);
    const borderColor =
        currentTheme?.["border-primary-dark"] || "border-gray-700/50";

    // request: { widgetId, declared } | null
    const [request, setRequest] = useState(null);
    // selection: mirrors declared.servers shape but with each tool/path
    // toggled; user submits the truthy subset.
    const [selection, setSelection] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!window.mainApi?.widgetMcp?.onConsentRequired) return;
        const cleanup = window.mainApi.widgetMcp.onConsentRequired(
            (payload) => {
                if (!payload?.widgetId || !payload?.declared) return;
                const initial = {};
                const servers = payload.declared.servers || {};
                for (const [name, perms] of Object.entries(servers)) {
                    initial[name] = {
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
                setSelection(initial);
                setRequest(payload);
                setError(null);
                setIsSubmitting(false);
            }
        );
        return cleanup;
    }, []);

    if (!request) return null;

    const { widgetId, declared } = request;
    const declaredServers = declared.servers || {};

    const toggleEntry = (serverName, kind, key) => {
        setSelection((prev) => ({
            ...prev,
            [serverName]: {
                ...prev[serverName],
                [kind]: {
                    ...prev[serverName][kind],
                    [key]: !prev[serverName][kind][key],
                },
            },
        }));
    };

    const buildGrantedPerms = () => {
        const servers = {};
        for (const [name, decl] of Object.entries(declaredServers)) {
            const sel = selection[name] || {};
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
        return { servers };
    };

    const handleGrant = async () => {
        setError(null);
        setIsSubmitting(true);
        try {
            const ok = await window.mainApi?.widgetMcp?.setGrant?.(
                widgetId,
                buildGrantedPerms()
            );
            if (ok === false) {
                setError("Could not save grant. See main-process logs.");
                setIsSubmitting(false);
                return;
            }
            setRequest(null);
        } catch (err) {
            setError(err?.message || "Could not save grant.");
            setIsSubmitting(false);
        }
    };

    const handleDecline = async () => {
        setError(null);
        setIsSubmitting(true);
        try {
            // Write an empty-servers grant so the widget is clearly "user
            // decided no" — the gate denies (no servers entry) AND the
            // install flow doesn't re-prompt.
            await window.mainApi?.widgetMcp?.setGrant?.(widgetId, {
                servers: {},
            });
            setRequest(null);
        } catch (err) {
            setError(err?.message || "Could not record decline.");
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        // No grant write — modal will re-appear on next install hook /
        // launch retroactive prompt.
        setRequest(null);
    };

    return (
        <Modal isOpen={!!request} setIsOpen={(open) => !open && handleCancel()}>
            <div className="flex flex-col w-full max-w-xl">
                <div
                    className={`flex items-center gap-3 px-5 py-4 border-b ${borderColor}`}
                >
                    <FontAwesomeIcon
                        icon="shield-halved"
                        className="h-4 w-4 text-amber-400"
                    />
                    <div>
                        <div className="text-base font-semibold text-gray-100">
                            Grant MCP permissions: {widgetId}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                            This widget requests access to the MCP servers
                            below. Only granted items are enforced — uncheck
                            anything you don't want to allow.
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-4 px-5 py-4 max-h-96 overflow-y-auto">
                    <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700/40 rounded px-3 py-2">
                        Granted paths become visible to any widget on this
                        dashboard that uses the same MCP server. You can revoke
                        at any time in Settings → Privacy & Security.
                    </div>

                    {Object.entries(declaredServers).map(
                        ([serverName, decl]) => {
                            const sel = selection[serverName] || {};
                            return (
                                <div
                                    key={serverName}
                                    className="rounded-md bg-gray-900/40 border border-gray-700/40 p-3 space-y-3"
                                >
                                    <div className="text-xs uppercase tracking-wider text-gray-400">
                                        {serverName}
                                    </div>

                                    {(decl.tools || []).length > 0 && (
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
                                                            !!sel.tools?.[t]
                                                        }
                                                        onChange={() =>
                                                            toggleEntry(
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

                                    {(decl.readPaths || []).length > 0 && (
                                        <div className="space-y-1">
                                            <div className="text-[11px] text-gray-500">
                                                Read paths
                                            </div>
                                            {decl.readPaths.map((p) => (
                                                <label
                                                    key={p}
                                                    className="flex items-center gap-2 text-xs text-gray-300"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            !!sel.readPaths?.[p]
                                                        }
                                                        onChange={() =>
                                                            toggleEntry(
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
                                            ))}
                                        </div>
                                    )}

                                    {(decl.writePaths || []).length > 0 && (
                                        <div className="space-y-1">
                                            <div className="text-[11px] text-gray-500">
                                                Write paths
                                            </div>
                                            {decl.writePaths.map((p) => (
                                                <label
                                                    key={p}
                                                    className="flex items-center gap-2 text-xs text-gray-300"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            !!sel.writePaths?.[
                                                                p
                                                            ]
                                                        }
                                                        onChange={() =>
                                                            toggleEntry(
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
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        }
                    )}

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
                        title="Decline all"
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
                        title="Grant selected"
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
