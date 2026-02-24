import React, { Component } from "react";
import { MissingProviderPrompt } from "../../Components/Provider";

// Lazy import to avoid circular dependencies
let ProviderContext = null;
try {
    const ContextModule = require("../../Context");
    ProviderContext = ContextModule.ProviderContext;
} catch (e) {
    console.warn("ProviderContext not available:", e.message);
}

/**
 * ProviderErrorBoundary Component
 *
 * Wraps widgets to detect missing required providers and show setup UI.
 * Each widget can independently show its provider setup prompt.
 *
 * This acts as an error boundary for provider-related issues, similar to
 * how WidgetErrorBoundary handles runtime errors.
 *
 * @param {React.ReactNode} children - Widget component to wrap
 * @param {Array} requiredProviders - Provider requirements from widget config
 * @param {string} widgetId - For logging/debugging
 * @param {Function} onProviderSelect - Callback when user selects/creates provider
 */
export class ProviderErrorBoundary extends Component {
    static contextType = ProviderContext;

    constructor(props) {
        super(props);
        this.state = {
            hasProviderError: false,
            missingProviders: [],
            selectedProviders: props.selectedProviders || {},
        };
    }

    componentDidMount() {
        this.checkProviders();
    }

    componentDidUpdate(prevProps) {
        // Re-check if required providers or selected providers changed
        if (
            prevProps.requiredProviders !== this.props.requiredProviders ||
            prevProps.selectedProviders !== this.props.selectedProviders
        ) {
            this.checkProviders();
        }
    }

    /**
     * Check if all required providers are available
     */
    checkProviders = () => {
        const { requiredProviders = [] } = this.props;

        if (!requiredProviders || requiredProviders.length === 0) {
            // No provider requirements
            this.setState({ hasProviderError: false, missingProviders: [] });
            return;
        }

        // Get list of registered provider types from context
        // Handle case where context is null/undefined (e.g., in Storybook without ProviderContext provider)
        try {
            const listProviders = this.context?.listProviders;
            const registeredProviders =
                typeof listProviders === "function" ? listProviders() : [];
            const registeredTypes = registeredProviders
                .map((p) => p?.type)
                .filter(Boolean);

            // Find which required providers are missing
            const missing = requiredProviders.filter(
                (req) => !registeredTypes.includes(req.type)
            );

            this.setState({
                hasProviderError: missing.length > 0,
                missingProviders: missing,
            });
        } catch (error) {
            // If anything goes wrong with context, assume no providers available
            console.warn("Error checking providers:", error);
            this.setState({
                hasProviderError: requiredProviders.length > 0,
                missingProviders: requiredProviders,
            });
        }
    };

    /**
     * Handle provider selection/creation
     */
    handleProviderSelect = (providerType, providerName, credentials) => {
        // If new provider was created, credentials will be passed
        if (credentials) {
            // TODO: Save to Electron via dashApi.saveProvider()
            // TODO: Update context registry with new provider
            // For now, just log
            console.log(
                "New provider created:",
                providerName,
                "with credentials for type:",
                providerType
            );
        } else {
            // Existing provider was selected
            console.log(
                "Provider selected:",
                providerName,
                "of type:",
                providerType
            );
        }

        // Update local selected providers state
        const updatedSelected = {
            ...this.state.selectedProviders,
            [providerType]: providerName,
        };

        this.setState({ selectedProviders: updatedSelected }, () => {
            // Call parent callback if provided (for workspace persistence)
            if (this.props.onProviderSelect) {
                this.props.onProviderSelect({
                    widgetId: this.props.widgetId,
                    selectedProviders: updatedSelected,
                });
            }

            // Re-check after selection (triggers re-render if provider now exists)
            this.checkProviders();
        });
    };

    render() {
        const { hasProviderError, missingProviders, selectedProviders } =
            this.state;
        // eslint-disable-next-line no-unused-vars
        const { _requiredProviders = [], _widgetId } = this.props;

        // If providers are missing, show setup prompt
        if (hasProviderError && missingProviders.length > 0) {
            try {
                const listProviders = this.context?.listProviders;
                const registeredProviders =
                    typeof listProviders === "function" ? listProviders() : [];

                return (
                    <MissingProviderPrompt
                        requiredProviders={missingProviders}
                        selectedProviders={selectedProviders}
                        registeredProviders={registeredProviders}
                        onProviderSelect={this.handleProviderSelect}
                    />
                );
            } catch (error) {
                console.error("Error rendering MissingProviderPrompt:", error);
                // Fallback: render children anyway
                return this.props.children;
            }
        }

        // Providers are ready (or not required), render children
        return this.props.children;
    }
}
