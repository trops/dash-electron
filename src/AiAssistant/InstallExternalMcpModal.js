/**
 * InstallExternalMcpModal
 *
 * Confirmation modal triggered by the dash MCP `install_known_mcp_server`
 * tool. Listens for `mcp:install-known-external:confirm` requests, shows
 * the curated allow-list entry to the user (package, command, credential
 * fields), collects credentials, and replies with the user's decision via
 * `sendInstallKnownExternalResult()`.
 *
 * Trust gate: the entry shown here was already validated against the
 * curated `knownExternalMcpServers.json` allow-list in the main process,
 * so this modal trusts the payload to be on the safe-list. The user is
 * the FINAL gate — they review what's about to be installed and confirm.
 */
import React, { useEffect, useState, useContext } from "react";
import {
    Modal,
    Button,
    ThemeContext,
    FontAwesomeIcon,
} from "@trops/dash-react";

export const InstallExternalMcpModal = () => {
    const { currentTheme } = useContext(ThemeContext);
    const borderColor =
        currentTheme?.["border-primary-dark"] || "border-gray-700/50";

    const [request, setRequest] = useState(null);
    const [credentials, setCredentials] = useState({});
    const [isInstalling, setIsInstalling] = useState(false);
    const [error, setError] = useState(null);

    const openWith = (server, mode, requestId = null) => {
        // Pre-fill empty values for each declared credential field.
        const initial = {};
        const schema = server.credentialSchema || {};
        for (const key of Object.keys(schema)) {
            initial[key] = "";
        }
        setRequest({ server, mode, requestId });
        setCredentials(initial);
        setError(null);
        setIsInstalling(false);
    };

    // Subscribe to confirm-install requests from the dash MCP tool.
    // mode === "ai-tool": reply via sendInstallKnownExternalResult so
    // the tool resolves on the AI side. The main process handles the
    // actual provider save.
    useEffect(() => {
        if (!window.mainApi?.mcp?.onInstallKnownExternalConfirm) return;
        const cleanup = window.mainApi.mcp.onInstallKnownExternalConfirm(
            (payload) => {
                if (!payload?.requestId || !payload?.server) return;
                openWith(payload.server, "ai-tool", payload.requestId);
            }
        );
        return cleanup;
    }, []);

    // UI-triggered fallback: anywhere in the renderer can dispatch
    // `dash:install-known-external` with `{ id, appId? }` and this
    // modal will look up the curated entry and show itself. Used by
    // the Widget Builder banner when a freshly-generated widget
    // references an MCP type that isn't installed yet — works even
    // when the AI failed to call the install_known_mcp_server tool.
    // mode === "ui": save the provider directly via the renderer
    // mainApi instead of replying to the AI tool.
    useEffect(() => {
        async function handle(event) {
            const id = event?.detail?.id;
            if (!id) return;
            try {
                const result =
                    await window.mainApi?.mcp?.getKnownExternalCatalog?.();
                const server = (result?.servers || []).find(
                    (s) => s && s.id === id
                );
                if (!server) {
                    console.warn(
                        `[InstallExternalMcpModal] No allow-list entry for id "${id}"`
                    );
                    return;
                }
                openWith(server, "ui");
            } catch (err) {
                console.warn(
                    "[InstallExternalMcpModal] Failed to load catalog:",
                    err
                );
            }
        }
        window.addEventListener("dash:install-known-external", handle);
        return () =>
            window.removeEventListener("dash:install-known-external", handle);
    }, []);

    if (!request) return null;

    const { server, requestId, mode } = request;
    const schema = server.credentialSchema || {};
    const credentialKeys = Object.keys(schema);
    const requiredKeys = credentialKeys.filter((k) => schema[k]?.required);
    const missingRequired = requiredKeys.filter(
        (k) => !credentials[k] || !String(credentials[k]).trim()
    );

    const replyToAiTool = (result) => {
        if (!window.mainApi?.mcp?.sendInstallKnownExternalResult) return;
        window.mainApi.mcp.sendInstallKnownExternalResult(requestId, result);
    };

    const handleConfirm = async () => {
        setError(null);
        if (missingRequired.length > 0) {
            setError(
                `Missing required fields: ${missingRequired
                    .map((k) => schema[k]?.displayName || k)
                    .join(", ")}`
            );
            return;
        }
        setIsInstalling(true);

        if (mode === "ai-tool") {
            // Main-process dash MCP tool routes through handleAddProvider
            // after we reply. Close optimistically; the AI's chat reply
            // surfaces any install error.
            replyToAiTool({ confirmed: true, credentials });
            setRequest(null);
            return;
        }

        // mode === "ui": no AI in the loop — save the provider
        // directly via the renderer mainApi.
        try {
            const appId =
                process.env.REACT_APP_IDENTIFIER || "@trops/dash-electron";
            const result = await window.mainApi?.providers?.saveProvider?.(
                appId,
                server.name,
                server.id,
                credentials,
                "mcp",
                server.mcpConfig
            );
            if (result && result.success === false) {
                setError(result.error || "Could not save the provider.");
                setIsInstalling(false);
                return;
            }
            // Notify any listening UI (the Widget Builder banner re-checks
            // installed providers on this event).
            window.dispatchEvent(
                new CustomEvent("dash:provider-installed", {
                    detail: { id: server.id, name: server.name },
                })
            );
            setRequest(null);
        } catch (err) {
            setError(err?.message || "Could not save the provider.");
            setIsInstalling(false);
        }
    };

    const handleCancel = () => {
        if (mode === "ai-tool") replyToAiTool({ confirmed: false });
        setRequest(null);
    };

    const installCommand = [
        server.mcpConfig?.command,
        ...(server.mcpConfig?.args || []),
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <Modal isOpen={!!request} setIsOpen={(open) => !open && handleCancel()}>
            <div className="flex flex-col w-full max-w-xl">
                {/* Header */}
                <div
                    className={`flex items-center gap-3 px-5 py-4 border-b ${borderColor}`}
                >
                    <FontAwesomeIcon
                        icon="plug"
                        className="h-4 w-4 text-indigo-400"
                    />
                    <div>
                        <div className="text-base font-semibold text-gray-100">
                            Install MCP server: {server.name}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                            The AI assistant requested adding this MCP provider
                            so it can build your widget.
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="flex flex-col gap-4 px-5 py-4">
                    {/* What's being installed */}
                    <div className="rounded-md bg-gray-900/40 border border-gray-700/40 p-3 space-y-2">
                        <div className="text-xs uppercase tracking-wider text-gray-500">
                            What will run
                        </div>
                        <div className="text-xs font-mono text-gray-300 break-all">
                            {installCommand || "(no command)"}
                        </div>
                        {server.sourceUrl && (
                            <div className="text-xs text-gray-500">
                                Source:{" "}
                                <span className="text-gray-400 break-all">
                                    {server.sourceUrl}
                                </span>
                            </div>
                        )}
                        {server.description && (
                            <div className="text-xs text-gray-400">
                                {server.description}
                            </div>
                        )}
                    </div>

                    {/* Credentials */}
                    {credentialKeys.length > 0 && (
                        <div className="space-y-3">
                            <div className="text-xs uppercase tracking-wider text-gray-500">
                                Credentials
                            </div>
                            {credentialKeys.map((key) => {
                                const spec = schema[key] || {};
                                const isSecret = !!spec.secret;
                                return (
                                    <div
                                        key={key}
                                        className="flex flex-col gap-1"
                                    >
                                        <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                                            {spec.displayName || key}
                                            {spec.required && (
                                                <span className="text-red-400">
                                                    *
                                                </span>
                                            )}
                                        </label>
                                        <input
                                            type={
                                                isSecret ? "password" : "text"
                                            }
                                            value={credentials[key] || ""}
                                            onChange={(e) =>
                                                setCredentials((prev) => ({
                                                    ...prev,
                                                    [key]: e.target.value,
                                                }))
                                            }
                                            className="text-xs px-2 py-1.5 rounded bg-gray-800 border border-gray-700 text-gray-200"
                                            placeholder={
                                                spec.required
                                                    ? "Required"
                                                    : "Optional"
                                            }
                                        />
                                        {spec.instructions && (
                                            <span className="text-[10px] text-gray-500 leading-snug">
                                                {spec.instructions}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {error && (
                        <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/40 rounded px-3 py-2">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
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
                        disabled={isInstalling}
                    />
                    <Button
                        title="Install"
                        onClick={handleConfirm}
                        textSize="text-sm"
                        padding="py-1.5 px-3"
                        backgroundColor="bg-indigo-600"
                        textColor="text-white"
                        hoverTextColor="hover:text-white"
                        hoverBackgroundColor="hover:bg-indigo-500"
                        disabled={isInstalling}
                    />
                </div>
            </div>
        </Modal>
    );
};

export default InstallExternalMcpModal;
