import React, { useState, useContext, useMemo } from "react";
import {
    Button,
    InputText,
    SubHeading3,
    Tag,
    FontAwesomeIcon,
} from "@trops/dash-react";
import { AppContext } from "../../../Context/App/AppContext";
import {
    deriveFormFields,
    formatFieldName,
    isLikelySecret,
} from "../../../utils/mcpUtils";

export const ProviderDetail = ({
    providerName = null,
    provider = null,
    isEditing = false,
    isCreating = false,
    formName = "",
    setFormName,
    formType = "",
    setFormType,
    formCredentials = {},
    setFormCredentials,
    onSaveEdit,
    onCancelEdit,
    onStartEdit,
    onCreate,
    onDelete,
}) => {
    const appContext = useContext(AppContext);
    const dashApi = appContext?.dashApi;
    const isMcp = provider?.providerClass === "mcp";

    // MCP test connection state
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);

    // Derive credential fields for MCP providers in edit mode
    const mcpFormFields = useMemo(() => {
        if (!isMcp || !provider?.mcpConfig) return [];
        return deriveFormFields(provider.mcpConfig, {});
    }, [isMcp, provider]);

    // Credential field keys for non-MCP providers
    const credentialKeys = useMemo(() => {
        if (isMcp || !provider?.credentials) return [];
        return Object.keys(provider.credentials);
    }, [isMcp, provider]);

    const handleCredentialChange = (key, value) => {
        setFormCredentials((prev) => ({ ...prev, [key]: value }));
    };

    const handleTestConnection = () => {
        if (!dashApi || !provider?.mcpConfig || !providerName) return;

        setIsTesting(true);
        setTestResult(null);

        dashApi.mcpStartServer(
            providerName,
            provider.mcpConfig,
            provider.credentials,
            (event, result) => {
                if (result.error) {
                    setTestResult({ success: false, message: result.message });
                    setIsTesting(false);
                    return;
                }

                setTestResult({
                    success: true,
                    tools: result.tools || [],
                    message: `Connected! Found ${
                        (result.tools || []).length
                    } tools.`,
                });

                // Stop after test
                dashApi.mcpStopServer(
                    providerName,
                    () => {},
                    () => {}
                );
                setIsTesting(false);
            },
            (event, err) => {
                setTestResult({
                    success: false,
                    message: err?.message || "Connection failed",
                });
                setIsTesting(false);
            }
        );
    };

    const isFormMode = isEditing || isCreating;

    // ── MCP config info block (shared between read-only view and edit form) ──
    const mcpConfigBlock = isMcp && provider?.mcpConfig && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold opacity-40 uppercase tracking-wider">
                MCP Server Connection
            </p>
            <div className="space-y-2 text-sm">
                <div className="flex gap-2">
                    <span className="opacity-50 w-24 shrink-0">Transport:</span>
                    <Tag
                        text={
                            provider.mcpConfig.transport === "streamable_http"
                                ? "Streamable HTTP"
                                : "stdio"
                        }
                    />
                </div>
                {provider.mcpConfig.transport === "streamable_http" ? (
                    <div className="flex gap-2">
                        <span className="opacity-50 w-24 shrink-0">
                            Endpoint:
                        </span>
                        <span className="text-xs opacity-70">
                            Remote hosted server
                        </span>
                    </div>
                ) : (
                    <>
                        <div className="flex gap-2">
                            <span className="opacity-50 w-24 shrink-0">
                                Command:
                            </span>
                            <code className="text-xs bg-white/5 px-2 py-0.5 rounded">
                                {provider.mcpConfig.command}{" "}
                                {(provider.mcpConfig.args || []).join(" ")}
                            </code>
                        </div>
                        {provider.mcpConfig.envMapping &&
                            Object.keys(provider.mcpConfig.envMapping).length >
                                0 && (
                                <div className="flex gap-2">
                                    <span className="opacity-50 w-24 shrink-0">
                                        Env Vars:
                                    </span>
                                    <span className="text-xs opacity-70">
                                        {Object.keys(
                                            provider.mcpConfig.envMapping
                                        ).join(", ")}
                                    </span>
                                </div>
                            )}
                    </>
                )}
            </div>
        </div>
    );

    // ── Edit / Create form ──
    if (isFormMode) {
        return (
            <div className="flex flex-col flex-1 min-h-0">
                {/* Body */}
                <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
                    <SubHeading3
                        title={isCreating ? "New Provider" : "Edit Provider"}
                        padding={false}
                    />

                    {/* Provider name (always shown) */}
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-gray-400">
                            Provider Name
                        </label>
                        <InputText
                            value={formName}
                            onChange={(value) => setFormName(value)}
                            placeholder="Provider name"
                        />
                    </div>

                    {/* Provider type (credential providers & create mode only) */}
                    {(!isMcp || isCreating) && (
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-400">
                                Provider Type
                            </label>
                            <InputText
                                value={formType}
                                onChange={(value) => setFormType(value)}
                                placeholder="Provider type (e.g. algolia, openai)"
                            />
                        </div>
                    )}

                    {/* MCP provider edit: read-only config + editable credentials */}
                    {isEditing && isMcp && (
                        <>
                            {mcpConfigBlock}

                            {mcpFormFields.length > 0 && (
                                <>
                                    <div className="border-t border-white/10 pt-4">
                                        <p className="text-xs font-semibold opacity-40 uppercase tracking-wider">
                                            {provider.mcpConfig?.transport ===
                                            "streamable_http"
                                                ? "Server Configuration"
                                                : "Authentication"}
                                        </p>
                                    </div>

                                    {mcpFormFields.map((field) => (
                                        <div
                                            key={field.key}
                                            className="flex flex-col gap-2"
                                        >
                                            <label className="text-sm font-medium text-gray-400">
                                                {field.displayName}
                                            </label>
                                            {field.instructions && (
                                                <p className="text-sm opacity-50">
                                                    {field.instructions}
                                                </p>
                                            )}
                                            <InputText
                                                type={
                                                    field.secret
                                                        ? "password"
                                                        : "text"
                                                }
                                                value={
                                                    formCredentials[
                                                        field.key
                                                    ] || ""
                                                }
                                                onChange={(value) =>
                                                    handleCredentialChange(
                                                        field.key,
                                                        value
                                                    )
                                                }
                                                placeholder={`Enter ${field.displayName.toLowerCase()}`}
                                            />
                                        </div>
                                    ))}
                                </>
                            )}
                        </>
                    )}

                    {/* Credential provider edit: editable credential fields */}
                    {isEditing && !isMcp && credentialKeys.length > 0 && (
                        <>
                            <div className="border-t border-white/10 pt-4">
                                <p className="text-xs font-semibold opacity-40 uppercase tracking-wider">
                                    Credentials
                                </p>
                            </div>

                            {credentialKeys.map((key) => (
                                <div key={key} className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-gray-400">
                                        {formatFieldName(key)}
                                    </label>
                                    <InputText
                                        type={
                                            isLikelySecret(key)
                                                ? "password"
                                                : "text"
                                        }
                                        value={formCredentials[key] || ""}
                                        onChange={(value) =>
                                            handleCredentialChange(key, value)
                                        }
                                        placeholder={`Enter ${formatFieldName(
                                            key
                                        ).toLowerCase()}`}
                                    />
                                </div>
                            ))}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 flex flex-row justify-end gap-2 px-6 py-4 border-t border-white/10">
                    <Button title="Cancel" onClick={onCancelEdit} size="sm" />
                    <Button
                        title={isCreating ? "Create" : "Save"}
                        onClick={isCreating ? onCreate : onSaveEdit}
                        size="sm"
                    />
                </div>
            </div>
        );
    }

    // ── Read-only detail view ──
    if (!providerName || !provider) return null;

    return (
        <div className="flex flex-col flex-1 min-h-0">
            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
                {/* Name */}
                <SubHeading3 title={providerName} padding={false} />

                {/* Info */}
                <div className="flex flex-col space-y-3">
                    {provider.type && (
                        <div className="flex flex-row items-center gap-2">
                            <span className="text-sm opacity-50">Type:</span>
                            <Tag text={provider.type} />
                        </div>
                    )}
                    <div className="flex flex-row items-center gap-2">
                        <span className="text-sm opacity-50">Class:</span>
                        <Tag text={isMcp ? "MCP Server" : "API Credentials"} />
                    </div>
                </div>

                {/* MCP-specific info */}
                {isMcp && provider.mcpConfig && (
                    <div className="space-y-4">
                        <div className="border-t border-white/10 pt-4">
                            <p className="text-xs font-semibold opacity-40 uppercase tracking-wider mb-3">
                                MCP Server Configuration
                            </p>
                            <div className="space-y-2 text-sm">
                                <div className="flex gap-2">
                                    <span className="opacity-50 w-20">
                                        Transport:
                                    </span>
                                    <span>
                                        {provider.mcpConfig.transport ===
                                        "streamable_http"
                                            ? "Streamable HTTP"
                                            : "stdio"}
                                    </span>
                                </div>
                                {provider.mcpConfig.transport ===
                                "streamable_http" ? (
                                    <div className="flex gap-2">
                                        <span className="opacity-50 w-20">
                                            Endpoint:
                                        </span>
                                        <span className="text-xs opacity-70">
                                            Remote hosted server
                                        </span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex gap-2">
                                            <span className="opacity-50 w-20">
                                                Command:
                                            </span>
                                            <code className="text-xs bg-white/5 px-2 py-0.5 rounded">
                                                {provider.mcpConfig.command}{" "}
                                                {(
                                                    provider.mcpConfig.args ||
                                                    []
                                                ).join(" ")}
                                            </code>
                                        </div>
                                        {provider.mcpConfig.envMapping &&
                                            Object.keys(
                                                provider.mcpConfig.envMapping
                                            ).length > 0 && (
                                                <div className="flex gap-2">
                                                    <span className="opacity-50 w-20">
                                                        Env Vars:
                                                    </span>
                                                    <span className="text-xs">
                                                        {Object.keys(
                                                            provider.mcpConfig
                                                                .envMapping
                                                        ).join(", ")}
                                                    </span>
                                                </div>
                                            )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Test Connection Result */}
                        {testResult && (
                            <div
                                className={`p-3 rounded-lg text-sm ${
                                    testResult.success
                                        ? "bg-green-900/30 border border-green-700 text-green-300"
                                        : "bg-red-900/30 border border-red-700 text-red-300"
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <FontAwesomeIcon
                                        icon={
                                            testResult.success
                                                ? "circle-check"
                                                : "circle-exclamation"
                                        }
                                    />
                                    <span>{testResult.message}</span>
                                </div>
                                {testResult.success &&
                                    testResult.tools?.length > 0 && (
                                        <div className="mt-2 ml-6 space-y-1">
                                            {testResult.tools.map((tool) => (
                                                <div
                                                    key={tool.name}
                                                    className="text-xs"
                                                >
                                                    <span className="font-mono">
                                                        {tool.name}
                                                    </span>
                                                    {tool.description && (
                                                        <span className="opacity-60 ml-2">
                                                            - {tool.description}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 flex flex-row justify-end gap-2 px-6 py-4 border-t border-white/10">
                {isMcp && (
                    <Button
                        title={isTesting ? "Testing..." : "Test Connection"}
                        onClick={handleTestConnection}
                        size="sm"
                    />
                )}
                <Button
                    title="Edit"
                    onClick={() => onStartEdit(providerName, provider)}
                    size="sm"
                />
                <Button
                    title="Delete"
                    onClick={() => onDelete(providerName)}
                    size="sm"
                />
            </div>
        </div>
    );
};
