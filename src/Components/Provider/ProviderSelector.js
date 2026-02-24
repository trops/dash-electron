import React, { useState } from "react";
import {
    FontAwesomeIcon,
    Modal,
    Panel,
    SubHeading3,
    Paragraph,
    Button,
} from "@trops/dash-react";
import { ProviderForm } from "./ProviderForm";

/**
 * ProviderSelector Modal Component
 *
 * Application-level component for managing providers.
 * Two-tab modal for managing providers:
 * 1. Select existing provider from filtered list
 * 2. Create new provider with credentialSchema form
 *
 * @param {boolean} isOpen - Whether modal is open
 * @param {Function} setIsOpen - Callback to close modal
 * @param {string} providerType - Type of provider to filter by (e.g., "algolia")
 * @param {Array} existingProviders - List of existing providers: [{name, type, credentials}, ...]
 * @param {Object} credentialSchema - Schema for creating new provider
 * @param {Function} onSelect - Callback when provider is selected: (providerName) => void
 * @param {Function} onCreate - Callback when new provider is created: (providerName, credentials) => void
 */
export const ProviderSelector = ({
    isOpen,
    setIsOpen,
    providerType,
    existingProviders = [],
    credentialSchema = {},
    onSelect,
    onCreate,
}) => {
    const [activeTab, setActiveTab] = useState("select"); // "select" or "create"

    /**
     * Filter providers by type
     */
    const filteredProviders = existingProviders.filter(
        (p) => p.type === providerType
    );

    /**
     * Handle provider selection
     */
    const handleSelectProvider = (providerName) => {
        onSelect(providerName);
        setIsOpen(false);
    };

    /**
     * Handle new provider creation
     */
    const handleCreateProvider = (formData) => {
        // formData now contains { name, credentials }
        const { name: providerName, credentials } = formData;
        onCreate(providerName, credentials);
        setIsOpen(false);
    };

    return (
        <Modal
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            width="w-11/12 xl:w-5/6"
            height="h-5/6"
        >
            <Panel
                border={true}
                padding={false}
                backgroundColor="bg-gray-800"
                borderColor="border-gray-700"
            >
                {/* Panel Header with Close Button */}
                <Panel.Header border={true} borderColor="border-gray-700">
                    <div className="flex flex-col w-full space-y-4">
                        {/* Title Row */}
                        <div className="flex flex-row justify-between items-start">
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold text-gray-100">
                                    {providerType ? (
                                        <>
                                            Manage{" "}
                                            <span className="capitalize">
                                                {providerType}
                                            </span>{" "}
                                            Providers
                                        </>
                                    ) : (
                                        "Select Provider"
                                    )}
                                </h2>
                                <p className="text-sm text-gray-400 mt-1">
                                    {activeTab === "select"
                                        ? `Select an existing ${providerType} provider or create a new one`
                                        : `Create a new ${providerType} provider`}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="ml-4 text-gray-400 hover:text-gray-200 transition-colors"
                            >
                                <FontAwesomeIcon
                                    icon="times"
                                    className="text-xl"
                                />
                            </button>
                        </div>

                        {/* Tab Navigation */}
                        <div className="flex gap-2">
                            <Button
                                title={`Select Existing (${filteredProviders.length})`}
                                onClick={() => setActiveTab("select")}
                                backgroundColor={
                                    activeTab === "select"
                                        ? "bg-blue-600"
                                        : "bg-gray-700"
                                }
                                hoverBackgroundColor={
                                    activeTab === "select"
                                        ? "hover:bg-blue-700"
                                        : "hover:bg-gray-600"
                                }
                                padding="px-4 py-2"
                                textSize="text-sm"
                            />
                            <Button
                                title="Create New"
                                onClick={() => setActiveTab("create")}
                                backgroundColor={
                                    activeTab === "create"
                                        ? "bg-blue-600"
                                        : "bg-gray-700"
                                }
                                hoverBackgroundColor={
                                    activeTab === "create"
                                        ? "hover:bg-blue-700"
                                        : "hover:bg-gray-600"
                                }
                                padding="px-4 py-2"
                                textSize="text-sm"
                            />
                        </div>
                    </div>
                </Panel.Header>

                {/* Panel Body with Content */}
                <Panel.Body>
                    <div className="h-full overflow-y-auto">
                        {activeTab === "select" ? (
                            // Select Tab
                            <div className="p-6">
                                {filteredProviders.length > 0 ? (
                                    <div className="space-y-3">
                                        {filteredProviders.map((provider) => (
                                            <button
                                                key={provider.name}
                                                onClick={() =>
                                                    handleSelectProvider(
                                                        provider.name
                                                    )
                                                }
                                                className="w-full text-left p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                                            >
                                                <div className="font-semibold">
                                                    {provider.name}
                                                </div>
                                                <div className="text-sm opacity-70 mt-1">
                                                    Type:{" "}
                                                    <span className="capitalize">
                                                        {provider.type}
                                                    </span>
                                                </div>
                                                {provider.credentials &&
                                                    Object.keys(
                                                        provider.credentials
                                                    ).length > 0 && (
                                                        <div className="text-xs opacity-50 mt-2">
                                                            Fields:{" "}
                                                            {Object.keys(
                                                                provider.credentials
                                                            ).join(", ")}
                                                        </div>
                                                    )}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <SubHeading3 className="opacity-50">
                                            No {providerType} providers found
                                        </SubHeading3>
                                        <Paragraph className="mt-2 opacity-70">
                                            Create one using the "Create New"
                                            tab
                                        </Paragraph>
                                    </div>
                                )}
                            </div>
                        ) : (
                            // Create Tab
                            <ProviderForm
                                credentialSchema={credentialSchema}
                                onSubmit={handleCreateProvider}
                                onCancel={() => setIsOpen(false)}
                                submitLabel="Create Provider"
                                providerType={providerType}
                            />
                        )}
                    </div>
                </Panel.Body>
            </Panel>
        </Modal>
    );
};
