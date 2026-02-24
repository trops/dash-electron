import React, { useState } from "react";
import { Panel } from "@trops/dash-react";
import { ProviderSelector } from "./ProviderSelector";

/**
 * MissingProviderPrompt Component
 *
 * Application-level component for provider setup UI.
 * Displays when a widget requires a provider but none is selected.
 * Shows a disabled widget state with a prompt to select/create a provider.
 *
 * @param {Array} requiredProviders - Array of provider requirements from widget config
 *   Example: [{ type: "algolia", credentialSchema: {...} }]
 * @param {Object} selectedProviders - Map of already-selected providers per type
 *   Example: { "algolia": "Algolia Production", "slack": "Slack Dev" }
 * @param {Array} registeredProviders - List of already-registered providers
 * @param {Function} onProviderSelect - Callback when provider is selected: (providerType, providerName) => void
 */
export const MissingProviderPrompt = ({
    requiredProviders = [],
    selectedProviders = {},
    registeredProviders = [],
    onProviderSelect,
}) => {
    const [selectorOpen, setSelectorOpen] = useState(false);
    const [selectedProviderType, setSelectedProviderType] = useState(null);
    const [selectedSchema, setSelectedSchema] = useState(null);

    /**
     * Find which providers are missing (required but not registered)
     */
    const getMissingProviders = () => {
        return requiredProviders.filter((req) => {
            const providerType = req.type;

            // If already selected, not missing
            if (selectedProviders[providerType]) {
                return false;
            }

            // Check if registered in context
            const isRegistered = registeredProviders.some(
                (p) => p.type === providerType
            );
            return !isRegistered;
        });
    };

    const missingProviders = getMissingProviders();

    /**
     * Open selector for a specific provider type
     */
    const openSelector = (providerType, credentialSchema) => {
        setSelectedProviderType(providerType);
        setSelectedSchema(credentialSchema);
        setSelectorOpen(true);
    };

    /**
     * Handle provider creation
     */
    const handleCreateProvider = (providerName, credentials) => {
        // This should integrate with DashboardApi to save the provider
        if (onProviderSelect) {
            onProviderSelect(selectedProviderType, providerName, credentials);
        }
    };

    /**
     * Handle provider selection
     */
    const handleSelectProvider = (providerName) => {
        if (onProviderSelect) {
            onProviderSelect(selectedProviderType, providerName);
        }
    };

    return (
        <div className="w-full h-full flex items-center justify-center p-6">
            <Panel className="max-w-md w-full bg-white rounded-lg shadow-lg border border-yellow-200 bg-yellow-50">
                {/* Icon and Title */}
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                        <svg
                            className="w-6 h-6 text-yellow-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path
                                fillRule="evenodd"
                                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </div>

                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">
                            Setup Required
                        </h3>
                        <p className="text-sm text-gray-700 mt-2">
                            This widget requires{" "}
                            <span className="font-semibold">
                                {missingProviders.length}
                            </span>{" "}
                            external provider
                            {missingProviders.length !== 1 ? "s" : ""} to
                            function.
                        </p>
                    </div>
                </div>

                {/* Provider List */}
                <div className="mt-6 space-y-3">
                    <p className="text-sm font-semibold text-gray-900">
                        Required Providers:
                    </p>
                    {missingProviders.map((provider) => (
                        <div
                            key={provider.type}
                            className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
                        >
                            <div>
                                <p className="font-medium text-gray-900 capitalize">
                                    {provider.type}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {
                                        Object.keys(
                                            provider.credentialSchema || {}
                                        ).length
                                    }{" "}
                                    field
                                    {Object.keys(
                                        provider.credentialSchema || {}
                                    ).length !== 1
                                        ? "s"
                                        : ""}
                                </p>
                            </div>
                            <button
                                onClick={() =>
                                    openSelector(
                                        provider.type,
                                        provider.credentialSchema
                                    )
                                }
                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                Configure
                            </button>
                        </div>
                    ))}
                </div>

                {/* Status Message */}
                <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-sm text-blue-900">
                        💡 <span className="font-medium">Tip:</span> You can
                        select an existing provider or create a new one.
                    </p>
                </div>
            </Panel>

            {/* Provider Selector Modal */}
            {selectedProviderType && (
                <ProviderSelector
                    isOpen={selectorOpen}
                    setIsOpen={setSelectorOpen}
                    providerType={selectedProviderType}
                    existingProviders={registeredProviders}
                    selectedProviders={selectedProviders}
                    credentialSchema={selectedSchema}
                    onSelect={handleSelectProvider}
                    onCreate={handleCreateProvider}
                />
            )}
        </div>
    );
};
