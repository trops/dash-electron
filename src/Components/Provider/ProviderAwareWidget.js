import React from "react";
import { MissingProviderPrompt } from "./MissingProviderPrompt";

/**
 * ProviderAwareWidget Wrapper Component
 *
 * Application-level helpers for handling provider requirements in widgets.
 * Wraps a widget component to detect and handle missing providers.
 * If required providers are not registered, displays a prompt instead of the widget.
 * Otherwise, renders the widget normally.
 *
 * @param {React.Component} Component - The widget component to wrap
 * @param {Array} requiredProviders - Array of provider requirements from widget config
 *   Example: [{ type: "algolia", credentialSchema: {...} }]
 * @param {Array} registeredProviders - List of registered providers
 * @param {Function} onProviderSelect - Callback when user selects/creates a provider
 * @param {Object} props - All other props to pass to the wrapped component
 *
 * Example usage:
 *   const WrappedWidget = withProviderDetection(MyWidget, {
 *       requiredProviders: [{type: "algolia", credentialSchema: {...}}],
 *       registeredProviders: providers,
 *       onProviderSelect: (type, name) => {...}
 *   });
 */
export const withProviderDetection = (
    Component,
    {
        requiredProviders = [],
        registeredProviders = [],
        onProviderSelect = null,
    } = {}
) => {
    return (props) => {
        /**
         * Check if all required providers are registered
         */
        const areProvidersReady = requiredProviders.every((req) => {
            return registeredProviders.some((p) => p.type === req.type);
        });

        if (!areProvidersReady) {
            return (
                <MissingProviderPrompt
                    requiredProviders={requiredProviders}
                    registeredProviders={registeredProviders}
                    onProviderSelect={onProviderSelect}
                />
            );
        }

        return <Component {...props} />;
    };
};

/**
 * Provider-aware widget wrapper that can be used as a hook alternative
 *
 * This component checks for required providers and shows appropriate UI.
 * Use this to wrap your widget when it has provider requirements.
 */
export const WidgetProviderWrapper = ({
    children,
    requiredProviders = [],
    registeredProviders = [],
    onProviderSelect = null,
    fallback = null,
}) => {
    /**
     * Check if all required providers are registered
     */
    const areProvidersReady = requiredProviders.every((req) => {
        return registeredProviders.some((p) => p.type === req.type);
    });

    if (!areProvidersReady) {
        return (
            fallback || (
                <MissingProviderPrompt
                    requiredProviders={requiredProviders}
                    registeredProviders={registeredProviders}
                    onProviderSelect={onProviderSelect}
                />
            )
        );
    }

    return children;
};
