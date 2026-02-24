import React, { useState, useEffect, useContext, useMemo } from "react";
import {
    FontAwesomeIcon,
    Modal,
    Panel,
    Button,
    InputText,
    FormLabel,
    Tag,
} from "@trops/dash-react";
import { AppContext } from "../../Context/App/AppContext";
import { deriveFormFields } from "../../utils/mcpUtils";

/**
 * McpServerPicker
 *
 * Catalog browser for selecting and configuring MCP servers.
 * Shows a searchable grid of available MCP servers from the seed catalog,
 * then allows the user to configure credentials and save as a provider.
 *
 * Form fields are derived from the mcpConfig structure ({{placeholders}} for HTTP,
 * envMapping for stdio), with credentialSchema providing optional display metadata.
 *
 * @param {boolean} isOpen - Whether the picker modal is open
 * @param {Function} setIsOpen - Callback to close the modal
 * @param {Function} onSave - Callback when MCP provider is saved: (providerName, providerType, credentials, mcpConfig) => void
 */
export const McpServerPicker = ({ isOpen, setIsOpen, onSave }) => {
    const appContext = useContext(AppContext);
    const dashApi = appContext?.dashApi;

    const [catalog, setCatalog] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedServer, setSelectedServer] = useState(null);
    const [isConfiguring, setIsConfiguring] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

    // Configuration form state
    const [providerName, setProviderName] = useState("");
    const [credentialData, setCredentialData] = useState({});
    const [formErrors, setFormErrors] = useState({});

    // Derive form fields from mcpConfig + credentialSchema
    const formFields = useMemo(() => {
        if (!selectedServer) return [];
        return deriveFormFields(
            selectedServer.mcpConfig || {},
            selectedServer.credentialSchema || {}
        );
    }, [selectedServer]);

    // Load catalog on open
    useEffect(() => {
        if (isOpen && dashApi && catalog.length === 0) {
            setIsLoadingCatalog(true);
            dashApi.mcpGetCatalog(
                (event, result) => {
                    setCatalog(result.catalog || []);
                    setIsLoadingCatalog(false);
                },
                (event, err) => {
                    console.error(
                        "[McpServerPicker] Error loading catalog:",
                        err
                    );
                    setIsLoadingCatalog(false);
                }
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, dashApi]);

    // Filter catalog by search
    const filteredCatalog = catalog.filter((server) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            server.name.toLowerCase().includes(q) ||
            server.description.toLowerCase().includes(q) ||
            (server.tags || []).some((tag) => tag.toLowerCase().includes(q))
        );
    });

    // Handle server selection -> show configuration form
    const handleSelectServer = (server) => {
        setSelectedServer(server);
        setIsConfiguring(true);
        setTestResult(null);
        setProviderName(server.name);
        setCredentialData({});
        setFormErrors({});
    };

    // Handle credential field changes
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

    // Validate the configuration form using derived fields
    const validateForm = () => {
        const errors = {};
        if (!providerName?.trim()) {
            errors.providerName = "Provider name is required";
        }
        formFields.forEach((field) => {
            if (field.required && !credentialData[field.key]?.trim()) {
                errors[field.key] = `${field.displayName} is required`;
            }
        });
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Handle "Test Connection" - start server, list tools, then stop
    const handleTestConnection = () => {
        if (!dashApi || !selectedServer) return;

        setIsTesting(true);
        setTestResult(null);

        const testName = `__test__${selectedServer.id}`;

        dashApi.mcpStartServer(
            testName,
            selectedServer.mcpConfig,
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

                // Stop the test server
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

    // Handle save - create the MCP provider
    const handleSaveProvider = () => {
        if (!selectedServer || !validateForm()) return;
        onSave(
            providerName.trim(),
            selectedServer.id,
            credentialData,
            selectedServer.mcpConfig
        );
        handleClose();
    };

    const handleClose = () => {
        setSelectedServer(null);
        setIsConfiguring(false);
        setTestResult(null);
        setSearchQuery("");
        setProviderName("");
        setCredentialData({});
        setFormErrors({});
        setIsOpen(false);
    };

    const handleBack = () => {
        setSelectedServer(null);
        setIsConfiguring(false);
        setTestResult(null);
        setProviderName("");
        setCredentialData({});
        setFormErrors({});
    };

    // Icon mapping for catalog entries
    const getIconForServer = (server) => {
        const iconMap = {
            github: "code-branch",
            slack: "comments",
            notion: "book",
            "brave-search": "search",
            filesystem: "folder",
            postgres: "database",
            linear: "clipboard-list",
            memory: "brain",
            "google-drive": "hard-drive",
            gmail: "envelope",
            "google-calendar": "calendar-days",
            algolia: "magnifying-glass-plus",
        };
        return iconMap[server.id] || server.icon || "server";
    };

    const mcpConfig = selectedServer?.mcpConfig || {};

    return (
        <Modal
            isOpen={isOpen}
            setIsOpen={handleClose}
            width="w-11/12 xl:w-5/6"
            height="h-5/6"
        >
            <Panel
                border={true}
                padding={false}
                backgroundColor="bg-gray-800"
                borderColor="border-gray-700"
            >
                {/* Header */}
                <Panel.Header border={true} borderColor="border-gray-700">
                    <div className="flex flex-row justify-between items-start w-full">
                        <div className="flex-1">
                            <div className="flex items-center gap-3">
                                {isConfiguring && (
                                    <button
                                        onClick={handleBack}
                                        className="text-gray-400 hover:text-gray-200 transition-colors"
                                    >
                                        <FontAwesomeIcon
                                            icon="arrow-left"
                                            className="text-lg"
                                        />
                                    </button>
                                )}
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-100">
                                        {isConfiguring && selectedServer
                                            ? `Configure ${selectedServer.name}`
                                            : "Add MCP Server"}
                                    </h2>
                                    <p className="text-sm text-gray-400 mt-1">
                                        {isConfiguring
                                            ? selectedServer?.description ||
                                              "Configure the MCP server connection"
                                            : "Browse available MCP servers from the catalog"}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="ml-4 text-gray-400 hover:text-gray-200 transition-colors"
                        >
                            <FontAwesomeIcon icon="times" className="text-xl" />
                        </button>
                    </div>
                </Panel.Header>

                {/* Body */}
                <Panel.Body>
                    <div className="h-full overflow-y-auto">
                        {!isConfiguring ? (
                            // Catalog Browser
                            <div className="p-6 space-y-4">
                                {/* Search */}
                                <InputText
                                    value={searchQuery}
                                    onChange={(value) => setSearchQuery(value)}
                                    placeholder="Search MCP servers..."
                                />

                                {/* Server Grid */}
                                {isLoadingCatalog ? (
                                    <div className="text-center py-12 opacity-50">
                                        Loading catalog...
                                    </div>
                                ) : filteredCatalog.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {filteredCatalog.map((server) => (
                                            <button
                                                key={server.id}
                                                onClick={() =>
                                                    handleSelectServer(server)
                                                }
                                                className="text-left p-4 border border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-900/20 transition-all"
                                            >
                                                <div className="flex items-center gap-3 mb-2">
                                                    <FontAwesomeIcon
                                                        icon={getIconForServer(
                                                            server
                                                        )}
                                                        className="text-xl text-blue-400"
                                                    />
                                                    <span className="font-semibold text-lg">
                                                        {server.name}
                                                    </span>
                                                </div>
                                                <p className="text-sm opacity-70 mb-3">
                                                    {server.description}
                                                </p>
                                                <div className="flex flex-wrap gap-1">
                                                    {(server.tags || []).map(
                                                        (tag) => (
                                                            <Tag
                                                                key={tag}
                                                                text={tag}
                                                            />
                                                        )
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 opacity-50">
                                        {searchQuery
                                            ? "No servers match your search"
                                            : "No MCP servers available in catalog"}
                                    </div>
                                )}
                            </div>
                        ) : (
                            // MCP Server Configuration Form
                            <div className="flex flex-col gap-6 p-6">
                                {/* Server Connection Info */}
                                <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
                                    <p className="text-xs font-semibold opacity-40 uppercase tracking-wider">
                                        MCP Server Connection
                                    </p>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex gap-2">
                                            <span className="opacity-50 w-24 shrink-0">
                                                Transport:
                                            </span>
                                            <Tag
                                                text={
                                                    mcpConfig.transport ===
                                                    "streamable_http"
                                                        ? "Streamable HTTP"
                                                        : "stdio"
                                                }
                                            />
                                        </div>
                                        {mcpConfig.transport ===
                                        "streamable_http" ? (
                                            <div className="flex gap-2">
                                                <span className="opacity-50 w-24 shrink-0">
                                                    Endpoint:
                                                </span>
                                                <span className="text-xs opacity-70">
                                                    Remote hosted server (URL
                                                    provided below)
                                                </span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex gap-2">
                                                    <span className="opacity-50 w-24 shrink-0">
                                                        Command:
                                                    </span>
                                                    <code className="text-xs bg-white/5 px-2 py-0.5 rounded">
                                                        {mcpConfig.command}{" "}
                                                        {(
                                                            mcpConfig.args || []
                                                        ).join(" ")}
                                                    </code>
                                                </div>
                                                {mcpConfig.envMapping &&
                                                    Object.keys(
                                                        mcpConfig.envMapping
                                                    ).length > 0 && (
                                                        <div className="flex gap-2">
                                                            <span className="opacity-50 w-24 shrink-0">
                                                                Env Vars:
                                                            </span>
                                                            <span className="text-xs opacity-70">
                                                                {Object.keys(
                                                                    mcpConfig.envMapping
                                                                ).join(", ")}
                                                            </span>
                                                        </div>
                                                    )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Provider Name */}
                                <div className="flex flex-col gap-2">
                                    <FormLabel
                                        label="Provider Name"
                                        required={true}
                                    />
                                    <p className="text-sm opacity-50">
                                        A name to identify this MCP server
                                        instance (e.g., &quot;Algolia
                                        Production&quot;)
                                    </p>
                                    <InputText
                                        value={providerName}
                                        onChange={(value) => {
                                            setProviderName(value);
                                            if (
                                                formErrors.providerName &&
                                                value?.trim()
                                            ) {
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

                                {/* Derived Configuration Fields */}
                                {formFields.length > 0 && (
                                    <>
                                        <div className="border-t border-white/10 pt-4">
                                            <p className="text-xs font-semibold opacity-40 uppercase tracking-wider">
                                                {mcpConfig.transport ===
                                                "streamable_http"
                                                    ? "Server Configuration"
                                                    : "Authentication"}
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
                                                        credentialData[
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
                                        {testResult.success &&
                                            testResult.tools?.length > 0 && (
                                                <div className="mt-2 ml-6 space-y-1">
                                                    {testResult.tools.map(
                                                        (tool) => (
                                                            <div
                                                                key={tool.name}
                                                                className="text-xs"
                                                            >
                                                                <span className="font-mono">
                                                                    {tool.name}
                                                                </span>
                                                                {tool.description && (
                                                                    <span className="opacity-60 ml-2">
                                                                        -{" "}
                                                                        {
                                                                            tool.description
                                                                        }
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3 justify-end pt-4 border-t border-white/10">
                                    <Button
                                        title="Cancel"
                                        onClick={handleBack}
                                        size="sm"
                                    />
                                    <Button
                                        title={
                                            isTesting
                                                ? "Testing..."
                                                : "Test Connection"
                                        }
                                        onClick={handleTestConnection}
                                        size="sm"
                                    />
                                    <Button
                                        title="Save MCP Server"
                                        onClick={handleSaveProvider}
                                        size="sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </Panel.Body>
            </Panel>
        </Modal>
    );
};
