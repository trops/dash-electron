import React, { useContext } from "react";

/**
 * ProviderContext
 *
 * Manages a registry of authenticated API clients/providers that can be
 * instantiated once and reused across multiple widgets.
 *
 * Provider credentials are stored and encrypted by the Electron application.
 * The React library loads persisted providers via DashboardApi methods and manages
 * runtime instances in this context.
 *
 * Example:
 * - User adds "algolia-prod" provider with API ID + Key via dashboard UI
 * - Electron app encrypts and persists to ~/.dash-config/providers.enc.json
 * - On app startup, DashboardWrapper loads providers via dashApi.listProviders()
 * - ProviderRegistry instantiates clients and makes them available to widgets
 * - Widgets access providers via useProvider() hook
 *
 * Encryption and file I/O are handled entirely by the Electron application.
 * This library only manages the in-memory registry and provides hooks for access.
 */

export const ProviderContext = React.createContext({});

export const useProvider = (providerName) => {
    const { getProvider } = useContext(ProviderContext);
    const provider = getProvider(providerName);

    if (!provider) {
        throw new Error(
            `Provider "${providerName}" not found in registry. ` +
                `Ensure the provider has been registered in DashboardWrapper.`
        );
    }

    return provider;
};

/**
 * ProviderRegistry
 *
 * A simple registry for managing named provider instances.
 * Typically initialized in DashboardWrapper and provided via ProviderContext.
 *
 * @returns {Object} registry with getProvider, addProvider, removeProvider, listProviders
 */
export const createProviderRegistry = () => {
    const providers = new Map();

    return {
        /**
         * Get a provider by name
         * @param {string} name - provider name (e.g., "algolia-prod", "contentful-staging")
         * @returns {*} provider instance or undefined
         */
        getProvider: (name) => providers.get(name),

        /**
         * Register a new provider instance
         * @param {string} name - unique provider name
         * @param {*} instance - the authenticated client/provider
         * @throws if provider already exists
         */
        addProvider: (name, instance) => {
            if (providers.has(name)) {
                throw new Error(
                    `Provider "${name}" already exists. Use updateProvider or removeProvider first.`
                );
            }
            providers.set(name, instance);
        },

        /**
         * Update an existing provider (or create if not exists)
         * @param {string} name - provider name
         * @param {*} instance - the authenticated client/provider
         */
        updateProvider: (name, instance) => {
            providers.set(name, instance);
        },

        /**
         * Remove a provider from the registry
         * @param {string} name - provider name
         */
        removeProvider: (name) => {
            providers.delete(name);
        },

        /**
         * List all registered providers
         * @returns {Array<string>} array of provider names
         */
        listProviders: () => Array.from(providers.keys()),

        /**
         * Clear all providers (useful for cleanup)
         */
        clearAll: () => {
            providers.clear();
        },
    };
};
