import React, { useState, useContext, useRef, useEffect } from "react";
import {
    ConfirmationModal,
    FontAwesomeIcon,
    Sidebar,
    Tag3,
} from "@trops/dash-react";
import { AppContext } from "../../../Context/App/AppContext";
import { SectionLayout } from "../SectionLayout";
import { ProviderDetail } from "../details/ProviderDetail";
import { McpCatalogDetail } from "../details/McpCatalogDetail";

export const ProvidersSection = ({
    dashApi = null,
    credentials = null,
    createRequested = false,
    onCreateAcknowledged = null,
}) => {
    const appContext = useContext(AppContext);
    const providers = appContext?.providers || {};
    const refreshProviders = appContext?.refreshProviders;

    const [selectedName, setSelectedName] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formName, setFormName] = useState("");
    const [formType, setFormType] = useState("");
    const [formCredentials, setFormCredentials] = useState({});
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [isAddingMcp, setIsAddingMcp] = useState(false);

    const providerEntries = Object.entries(providers);
    const appId = credentials?.appId;

    // Separate credential and MCP providers for display
    const credentialProviders = providerEntries.filter(
        ([, p]) => (p.providerClass || "credential") === "credential"
    );
    const mcpProviders = providerEntries.filter(
        ([, p]) => p.providerClass === "mcp"
    );

    function resetForm() {
        setFormName("");
        setFormType("");
        setFormCredentials({});
        setIsCreating(false);
        setIsEditing(false);
    }

    function handleSave() {
        if (!formName.trim() || !dashApi || !appId) return;
        dashApi.saveProvider(
            appId,
            formName.trim(),
            { providerType: formType.trim(), credentials: {} },
            () => {
                resetForm();
                refreshProviders && refreshProviders();
            },
            (e, err) => console.error("Save provider error:", err)
        );
    }

    function handleStartEdit(name, provider) {
        setSelectedName(name);
        setFormName(name);
        setFormType(provider.type || "");
        setFormCredentials(provider.credentials || {});
        setIsEditing(true);
        setIsCreating(false);
    }

    function handleSaveEdit() {
        if (!formName.trim() || !dashApi || !appId) return;
        const originalName = selectedName;
        const originalProvider = providers[originalName];
        // Delete old if name changed, then save new
        if (originalName !== formName.trim()) {
            dashApi.deleteProvider(
                appId,
                originalName,
                () => {},
                () => {}
            );
        }
        dashApi.saveProvider(
            appId,
            formName.trim(),
            {
                providerType: formType.trim(),
                credentials: formCredentials,
                providerClass: originalProvider?.providerClass || "credential",
                mcpConfig: originalProvider?.mcpConfig || null,
            },
            () => {
                setSelectedName(formName.trim());
                resetForm();
                refreshProviders && refreshProviders();
            },
            (e, err) => console.error("Save provider error:", err)
        );
    }

    function handleConfirmDelete() {
        if (!deleteTarget || !dashApi || !appId) return;

        // If it's an MCP provider, stop the server first
        const targetProvider = providers[deleteTarget];
        if (targetProvider?.providerClass === "mcp") {
            dashApi.mcpStopServer(
                deleteTarget,
                () => {},
                () => {}
            );
        }

        dashApi.deleteProvider(
            appId,
            deleteTarget,
            () => {
                if (selectedName === deleteTarget) {
                    setSelectedName(null);
                    resetForm();
                }
                setDeleteTarget(null);
                refreshProviders && refreshProviders();
            },
            (e, err) => {
                console.error("Delete provider error:", err);
                setDeleteTarget(null);
            }
        );
    }

    // Handle MCP provider creation from catalog picker
    function handleMcpSave(
        providerName,
        providerType,
        mcpCredentials,
        mcpConfig
    ) {
        if (!dashApi || !appId) return;
        dashApi.saveProvider(
            appId,
            providerName,
            {
                providerType,
                credentials: mcpCredentials,
                providerClass: "mcp",
                mcpConfig,
            },
            () => {
                setIsAddingMcp(false);
                refreshProviders && refreshProviders();
                setSelectedName(providerName);
            },
            (e, err) => console.error("Save MCP provider error:", err)
        );
    }

    // Respond to external create trigger from header
    const prevCreateRequested = useRef(false);
    useEffect(() => {
        if (createRequested && !prevCreateRequested.current) {
            resetForm();
            setSelectedName(null);
            setIsCreating(true);
        }
        prevCreateRequested.current = createRequested;
        if (createRequested && onCreateAcknowledged) {
            onCreateAcknowledged();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createRequested]);

    const selectedProvider =
        selectedName && providers[selectedName]
            ? providers[selectedName]
            : null;

    const listContent = (
        <Sidebar.Content>
            {/* Credential Providers */}
            {credentialProviders.length > 0 && (
                <>
                    <div className="px-3 py-2 text-xs font-semibold opacity-40 uppercase tracking-wider">
                        API Credentials
                    </div>
                    {credentialProviders.map(([name, provider]) => {
                        const isSelected = selectedName === name && !isCreating;
                        return (
                            <Sidebar.Item
                                key={name}
                                icon={
                                    <FontAwesomeIcon
                                        icon="key"
                                        className="h-3.5 w-3.5"
                                    />
                                }
                                active={isSelected}
                                onClick={() => {
                                    setSelectedName(name);
                                    setIsCreating(false);
                                    setIsEditing(false);
                                    setIsAddingMcp(false);
                                    resetForm();
                                }}
                                badge={
                                    provider.type ? (
                                        <Tag3 text={provider.type} />
                                    ) : null
                                }
                                className={
                                    isSelected ? "bg-white/10 opacity-100" : ""
                                }
                            >
                                {name}
                            </Sidebar.Item>
                        );
                    })}
                </>
            )}

            {/* MCP Providers */}
            {mcpProviders.length > 0 && (
                <>
                    <div className="px-3 py-2 text-xs font-semibold opacity-40 uppercase tracking-wider mt-2">
                        MCP Servers
                    </div>
                    {mcpProviders.map(([name, provider]) => {
                        const isSelected = selectedName === name && !isCreating;
                        return (
                            <Sidebar.Item
                                key={name}
                                icon={
                                    <FontAwesomeIcon
                                        icon="server"
                                        className="h-3.5 w-3.5"
                                    />
                                }
                                active={isSelected}
                                onClick={() => {
                                    setSelectedName(name);
                                    setIsCreating(false);
                                    setIsEditing(false);
                                    setIsAddingMcp(false);
                                    resetForm();
                                }}
                                badge={
                                    provider.type ? (
                                        <Tag3 text={provider.type} />
                                    ) : null
                                }
                                className={
                                    isSelected ? "bg-white/10 opacity-100" : ""
                                }
                            >
                                {name}
                            </Sidebar.Item>
                        );
                    })}
                </>
            )}

            {/* No providers */}
            {providerEntries.length === 0 && (
                <span className="text-sm opacity-40 py-8 text-center">
                    No providers configured
                </span>
            )}

            {/* Add MCP Server button */}
            <div className="px-3 py-3 mt-2 border-t border-white/10">
                <button
                    onClick={() => {
                        setIsAddingMcp(true);
                        setSelectedName(null);
                        setIsCreating(false);
                        setIsEditing(false);
                    }}
                    className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors w-full"
                >
                    <FontAwesomeIcon icon="plus" className="h-3 w-3" />
                    Add MCP Server
                </button>
            </div>
        </Sidebar.Content>
    );

    let detailContent = null;
    if (isAddingMcp) {
        detailContent = (
            <McpCatalogDetail
                onSave={handleMcpSave}
                onCancel={() => setIsAddingMcp(false)}
            />
        );
    } else if (isCreating) {
        detailContent = (
            <ProviderDetail
                isCreating={true}
                formName={formName}
                setFormName={setFormName}
                formType={formType}
                setFormType={setFormType}
                onCreate={handleSave}
                onCancelEdit={() => {
                    resetForm();
                    setIsCreating(false);
                }}
            />
        );
    } else if (selectedName && selectedProvider) {
        detailContent = (
            <ProviderDetail
                providerName={selectedName}
                provider={selectedProvider}
                isEditing={isEditing}
                formName={formName}
                setFormName={setFormName}
                formType={formType}
                setFormType={setFormType}
                formCredentials={formCredentials}
                setFormCredentials={setFormCredentials}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={resetForm}
                onStartEdit={handleStartEdit}
                onDelete={(name) => setDeleteTarget(name)}
            />
        );
    }

    return (
        <>
            <SectionLayout
                listContent={listContent}
                detailContent={detailContent}
                emptyDetailMessage="Select a provider to view details"
            />
            <ConfirmationModal
                isOpen={!!deleteTarget}
                setIsOpen={() => setDeleteTarget(null)}
                title="Delete Provider"
                message={`Are you sure you want to delete "${deleteTarget}"? This action cannot be undone.`}
                confirmLabel="Delete"
                variant="danger"
                onConfirm={handleConfirmDelete}
                onCancel={() => setDeleteTarget(null)}
            />
        </>
    );
};
