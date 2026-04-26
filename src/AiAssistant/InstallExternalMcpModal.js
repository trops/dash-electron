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

    // Subscribe to confirm-install requests from the dash MCP tool.
    useEffect(() => {
        if (!window.mainApi?.mcp?.onInstallKnownExternalConfirm) return;
        const cleanup = window.mainApi.mcp.onInstallKnownExternalConfirm(
            (payload) => {
                if (!payload?.requestId || !payload?.server) return;
                setRequest(payload);
                // Pre-fill empty values for each declared credential field.
                const initial = {};
                const schema = payload.server.credentialSchema || {};
                for (const key of Object.keys(schema)) {
                    initial[key] = "";
                }
                setCredentials(initial);
                setError(null);
                setIsInstalling(false);
            }
        );
        return cleanup;
    }, []);

    if (!request) return null;

    const { server, requestId } = request;
    const schema = server.credentialSchema || {};
    const credentialKeys = Object.keys(schema);
    const requiredKeys = credentialKeys.filter((k) => schema[k]?.required);
    const missingRequired = requiredKeys.filter(
        (k) => !credentials[k] || !String(credentials[k]).trim()
    );

    const reply = (result) => {
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
        // The main-process tool routes through handleAddProvider after we
        // reply. Close the modal optimistically; the AI's chat reply will
        // surface any install error.
        reply({ confirmed: true, credentials });
        setRequest(null);
    };

    const handleCancel = () => {
        reply({ confirmed: false });
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
