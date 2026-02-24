import React, { useState, useEffect, useContext, useMemo } from "react";
import {
    FontAwesomeIcon,
    Button,
    Card2,
    Icon2,
    InputText,
    FormLabel,
    Tag,
    SubHeading3,
} from "@trops/dash-react";
import { AppContext } from "../../../Context/App/AppContext";
import { deriveFormFields } from "../../../utils/mcpUtils";

let rowIdCounter = 0;
const nextRowId = () => `row_${++rowIdCounter}`;

/**
 * Build an mcpConfig object from the current form state.
 */
function buildMcpConfig(
    transport,
    { command, args, envMappingRows, url, headerRows }
) {
    if (transport === "stdio") {
        const envMapping = {};
        envMappingRows.forEach((row) => {
            const env = row.envVar.trim();
            const cred = row.credField.trim();
            if (env && cred) {
                envMapping[env] = cred;
            }
        });
        return {
            transport: "stdio",
            command: command.trim(),
            args: args.trim().split(/\s+/).filter(Boolean),
            envMapping,
        };
    }

    // streamable_http
    const headerTemplate = {};
    headerRows.forEach((row) => {
        const name = row.headerName.trim();
        const value = row.headerValue.trim();
        if (name && value) {
            headerTemplate[name] = value;
        }
    });
    const config = {
        transport: "streamable_http",
        url: url.trim(),
    };
    if (Object.keys(headerTemplate).length > 0) {
        config.headerTemplate = headerTemplate;
    }
    return config;
}

/**
 * CustomMcpServerForm
 *
 * Form for configuring a custom MCP server (not from the catalog).
 * Supports stdio and streamable_http transports with dynamic field derivation.
 *
 * @param {Function} onSave - (providerName, providerType, credentials, mcpConfig) => void
 * @param {Function} onBack - Called when the user wants to return to the catalog
 */
export const CustomMcpServerForm = ({ onSave, onBack }) => {
    const appContext = useContext(AppContext);
    const dashApi = appContext?.dashApi;

    // Transport selection
    const [transport, setTransport] = useState("stdio");

    // Common
    const [providerName, setProviderName] = useState("");
    const [credentialData, setCredentialData] = useState({});
    const [formErrors, setFormErrors] = useState({});
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);

    // stdio fields
    const [command, setCommand] = useState("");
    const [args, setArgs] = useState("");
    const [envMappingRows, setEnvMappingRows] = useState([]);

    // HTTP fields
    const [url, setUrl] = useState("");
    const [headerRows, setHeaderRows] = useState([]);

    // Clear credential data when transport changes (derived fields change entirely)
    useEffect(() => {
        setCredentialData({});
        setTestResult(null);
    }, [transport]);

    // Build mcpConfig from current state
    const mcpConfig = useMemo(
        () =>
            buildMcpConfig(transport, {
                command,
                args,
                envMappingRows,
                url,
                headerRows,
            }),
        [transport, command, args, envMappingRows, url, headerRows]
    );

    // Derive credential fields from the live mcpConfig
    const formFields = useMemo(
        () => deriveFormFields(mcpConfig, {}),
        [mcpConfig]
    );

    // --- envMapping row handlers ---
    const addEnvRow = () => {
        setEnvMappingRows((prev) => [
            ...prev,
            { id: nextRowId(), envVar: "", credField: "" },
        ]);
    };

    const updateEnvRow = (id, field, value) => {
        setEnvMappingRows((prev) =>
            prev.map((row) =>
                row.id === id ? { ...row, [field]: value } : row
            )
        );
    };

    const removeEnvRow = (id) => {
        setEnvMappingRows((prev) => prev.filter((row) => row.id !== id));
    };

    // --- header row handlers ---
    const addHeaderRow = () => {
        setHeaderRows((prev) => [
            ...prev,
            { id: nextRowId(), headerName: "", headerValue: "" },
        ]);
    };

    const updateHeaderRow = (id, field, value) => {
        setHeaderRows((prev) =>
            prev.map((row) =>
                row.id === id ? { ...row, [field]: value } : row
            )
        );
    };

    const removeHeaderRow = (id) => {
        setHeaderRows((prev) => prev.filter((row) => row.id !== id));
    };

    // --- credential field change ---
    const handleCredentialChange = (fieldName, value) => {
        setCredentialData((prev) => ({ ...prev, [fieldName]: value }));
        if (formErrors[fieldName] && value?.trim()) {
            setFormErrors((prev) => {
                const next = { ...prev };
                delete next[fieldName];
                return next;
            });
        }
    };

    // --- validation ---
    const validateForm = () => {
        const errors = {};
        if (!providerName?.trim()) {
            errors.providerName = "Provider name is required";
        }
        if (transport === "stdio") {
            if (!command?.trim()) {
                errors.command = "Command is required";
            }
        } else {
            if (!url?.trim()) {
                errors.url = "URL is required";
            }
        }
        formFields.forEach((field) => {
            if (field.required && !credentialData[field.key]?.trim()) {
                errors[field.key] = `${field.displayName} is required`;
            }
        });
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // --- test connection ---
    const handleTestConnection = () => {
        if (!dashApi) return;

        setIsTesting(true);
        setTestResult(null);

        const testName = "__test__custom";

        dashApi.mcpStartServer(
            testName,
            mcpConfig,
            credentialData,
            (event, result) => {
                if (result.error) {
                    setTestResult({
                        success: false,
                        message: result.message,
                    });
                    setIsTesting(false);
                    return;
                }

                setTestResult({
                    success: true,
                    tools: result.tools || [],
                    resources: result.resources || [],
                    message: `Connected! Found ${
                        (result.tools || []).length
                    } tools.`,
                });

                dashApi.mcpStopServer(
                    testName,
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

    // --- save ---
    const handleSave = () => {
        if (!validateForm()) return;
        onSave(providerName.trim(), "custom", credentialData, mcpConfig);
    };

    return (
        <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
                {/* Header with back button */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="text-gray-400 hover:text-gray-200 transition-colors"
                    >
                        <FontAwesomeIcon
                            icon="arrow-left"
                            className="text-lg"
                        />
                    </button>
                    <div>
                        <SubHeading3
                            title="Configure Custom MCP Server"
                            padding={false}
                        />
                        <p className="text-sm opacity-50 mt-1">
                            Define a custom MCP server connection
                        </p>
                    </div>
                </div>

                {/* Transport Selector */}
                <div className="space-y-2">
                    <p className="text-xs font-semibold opacity-40 uppercase tracking-wider">
                        Transport Type
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <Card2
                            hover
                            selected={transport === "stdio"}
                            onClick={() => setTransport("stdio")}
                            className="text-left"
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <Icon2 icon="terminal" />
                                <span className="font-semibold text-sm">
                                    Local Process (stdio)
                                </span>
                            </div>
                            <p className="text-xs opacity-50">
                                Spawn a local command as a child process
                            </p>
                        </Card2>
                        <Card2
                            hover
                            selected={transport === "streamable_http"}
                            onClick={() => setTransport("streamable_http")}
                            className="text-left"
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <Icon2 icon="globe" />
                                <span className="font-semibold text-sm">
                                    Remote Server (HTTP)
                                </span>
                            </div>
                            <p className="text-xs opacity-50">
                                Connect to a remote MCP server via HTTP
                            </p>
                        </Card2>
                    </div>
                </div>

                {/* Provider Name */}
                <div className="flex flex-col gap-2">
                    <FormLabel label="Provider Name" required={true} />
                    <p className="text-sm opacity-50">
                        A name to identify this MCP server (e.g., &quot;My
                        Custom Server&quot;)
                    </p>
                    <InputText
                        value={providerName}
                        onChange={(value) => {
                            setProviderName(value);
                            if (formErrors.providerName && value?.trim()) {
                                setFormErrors((prev) => {
                                    const next = { ...prev };
                                    delete next.providerName;
                                    return next;
                                });
                            }
                        }}
                        placeholder="Enter provider name"
                    />
                    {formErrors.providerName && (
                        <p className="text-sm text-red-400">
                            {formErrors.providerName}
                        </p>
                    )}
                </div>

                {/* ── stdio Fields ── */}
                {transport === "stdio" && (
                    <div className="space-y-4">
                        <div className="border-t border-white/10 pt-4">
                            <p className="text-xs font-semibold opacity-40 uppercase tracking-wider">
                                Process Configuration
                            </p>
                        </div>

                        {/* Command */}
                        <div className="flex flex-col gap-2">
                            <FormLabel label="Command" required={true} />
                            <p className="text-sm opacity-50">
                                The executable to run (e.g., npx, node, python)
                            </p>
                            <InputText
                                value={command}
                                onChange={(value) => {
                                    setCommand(value);
                                    if (formErrors.command && value?.trim()) {
                                        setFormErrors((prev) => {
                                            const next = { ...prev };
                                            delete next.command;
                                            return next;
                                        });
                                    }
                                }}
                                placeholder="e.g., npx"
                            />
                            {formErrors.command && (
                                <p className="text-sm text-red-400">
                                    {formErrors.command}
                                </p>
                            )}
                        </div>

                        {/* Args */}
                        <div className="flex flex-col gap-2">
                            <FormLabel label="Arguments" />
                            <p className="text-sm opacity-50">
                                Space-separated arguments passed to the command
                            </p>
                            <InputText
                                value={args}
                                onChange={setArgs}
                                placeholder="e.g., -y @modelcontextprotocol/server-github"
                            />
                        </div>

                        {/* Environment Variable Mapping */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <FormLabel label="Environment Variable Mapping" />
                                    <p className="text-sm opacity-50 mt-1">
                                        Map environment variables to credential
                                        fields
                                    </p>
                                </div>
                            </div>

                            {envMappingRows.map((row) => (
                                <div
                                    key={row.id}
                                    className="flex items-center gap-2"
                                >
                                    <div className="flex-1">
                                        <InputText
                                            value={row.envVar}
                                            onChange={(value) =>
                                                updateEnvRow(
                                                    row.id,
                                                    "envVar",
                                                    value
                                                )
                                            }
                                            placeholder="ENV_VAR_NAME"
                                        />
                                    </div>
                                    <span className="opacity-30 text-sm shrink-0">
                                        &rarr;
                                    </span>
                                    <div className="flex-1">
                                        <InputText
                                            value={row.credField}
                                            onChange={(value) =>
                                                updateEnvRow(
                                                    row.id,
                                                    "credField",
                                                    value
                                                )
                                            }
                                            placeholder="credentialField"
                                        />
                                    </div>
                                    <button
                                        onClick={() => removeEnvRow(row.id)}
                                        className="text-gray-500 hover:text-red-400 transition-colors shrink-0"
                                    >
                                        <FontAwesomeIcon
                                            icon="times"
                                            className="text-sm"
                                        />
                                    </button>
                                </div>
                            ))}

                            <button
                                onClick={addEnvRow}
                                className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                            >
                                <FontAwesomeIcon
                                    icon="plus"
                                    className="text-xs"
                                />
                                <span>Add Environment Variable</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* ── streamable_http Fields ── */}
                {transport === "streamable_http" && (
                    <div className="space-y-4">
                        <div className="border-t border-white/10 pt-4">
                            <p className="text-xs font-semibold opacity-40 uppercase tracking-wider">
                                Server Configuration
                            </p>
                        </div>

                        {/* URL */}
                        <div className="flex flex-col gap-2">
                            <FormLabel label="Server URL" required={true} />
                            <p className="text-sm opacity-50">
                                Use{" "}
                                <code className="text-xs bg-white/10 px-1 py-0.5 rounded">
                                    {"{{fieldName}}"}
                                </code>{" "}
                                for values provided as credentials
                            </p>
                            <InputText
                                value={url}
                                onChange={(value) => {
                                    setUrl(value);
                                    if (formErrors.url && value?.trim()) {
                                        setFormErrors((prev) => {
                                            const next = { ...prev };
                                            delete next.url;
                                            return next;
                                        });
                                    }
                                }}
                                placeholder="e.g., https://mcp.example.com/sse"
                            />
                            {formErrors.url && (
                                <p className="text-sm text-red-400">
                                    {formErrors.url}
                                </p>
                            )}
                        </div>

                        {/* Headers */}
                        <div className="space-y-3">
                            <div>
                                <FormLabel label="Request Headers" />
                                <p className="text-sm opacity-50 mt-1">
                                    Use{" "}
                                    <code className="text-xs bg-white/10 px-1 py-0.5 rounded">
                                        {"{{fieldName}}"}
                                    </code>{" "}
                                    in values for credential placeholders
                                </p>
                            </div>

                            {headerRows.map((row) => (
                                <div
                                    key={row.id}
                                    className="flex items-center gap-2"
                                >
                                    <div className="flex-1">
                                        <InputText
                                            value={row.headerName}
                                            onChange={(value) =>
                                                updateHeaderRow(
                                                    row.id,
                                                    "headerName",
                                                    value
                                                )
                                            }
                                            placeholder="Header-Name"
                                        />
                                    </div>
                                    <span className="opacity-30 text-sm shrink-0">
                                        :
                                    </span>
                                    <div className="flex-1">
                                        <InputText
                                            value={row.headerValue}
                                            onChange={(value) =>
                                                updateHeaderRow(
                                                    row.id,
                                                    "headerValue",
                                                    value
                                                )
                                            }
                                            placeholder="Bearer {{apiKey}}"
                                        />
                                    </div>
                                    <button
                                        onClick={() => removeHeaderRow(row.id)}
                                        className="text-gray-500 hover:text-red-400 transition-colors shrink-0"
                                    >
                                        <FontAwesomeIcon
                                            icon="times"
                                            className="text-sm"
                                        />
                                    </button>
                                </div>
                            ))}

                            <button
                                onClick={addHeaderRow}
                                className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                            >
                                <FontAwesomeIcon
                                    icon="plus"
                                    className="text-xs"
                                />
                                <span>Add Header</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Derived Credential Fields ── */}
                {formFields.length > 0 && (
                    <>
                        <div className="border-t border-white/10 pt-4">
                            <p className="text-xs font-semibold opacity-40 uppercase tracking-wider">
                                Credentials
                            </p>
                            <p className="text-sm opacity-50 mt-1">
                                Values for the fields referenced in your
                                configuration above
                            </p>
                        </div>

                        {formFields.map((field) => (
                            <div
                                key={field.key}
                                className="flex flex-col gap-2"
                            >
                                <FormLabel
                                    label={field.displayName}
                                    required={field.required}
                                />
                                <InputText
                                    type={field.secret ? "password" : "text"}
                                    value={credentialData[field.key] || ""}
                                    onChange={(value) =>
                                        handleCredentialChange(field.key, value)
                                    }
                                    placeholder={`Enter ${field.displayName.toLowerCase()}`}
                                />
                                {formErrors[field.key] && (
                                    <p className="text-sm text-red-400">
                                        {formErrors[field.key]}
                                    </p>
                                )}
                            </div>
                        ))}
                    </>
                )}

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
                        {testResult.success && testResult.tools?.length > 0 && (
                            <div className="mt-2 ml-6 space-y-1">
                                {testResult.tools.map((tool) => (
                                    <div key={tool.name} className="text-xs">
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

            {/* Footer */}
            <div className="flex-shrink-0 flex flex-row justify-end gap-2 px-6 py-4 border-t border-white/10">
                <Button title="Cancel" onClick={onBack} size="sm" />
                <Button
                    title={isTesting ? "Testing..." : "Test Connection"}
                    onClick={handleTestConnection}
                    size="sm"
                />
                <Button
                    title="Save MCP Server"
                    onClick={handleSave}
                    size="sm"
                />
            </div>
        </div>
    );
};
