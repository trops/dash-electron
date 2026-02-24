import { useContext } from "react";
import { WorkspaceContext } from "../Context/WorkspaceContext";
import { DashboardContext } from "../Context/DashboardContext";
import { WidgetContext } from "../Context/WidgetContext";

/**
 * useWidgetProviders Hook
 *
 * Convenience hook for widgets to access only their selected providers with credentials.
 * This is simpler than useDashboard(widgetId) because it automatically determines the widget ID.
 *
 * @returns {Object} Object containing:
 *   - providers: {
 *       "algolia": { name, type, credentials },
 *       "slack": { name, type, credentials },
 *       ...
 *     }
 *   - hasProvider(type): Boolean - Check if a provider type is available
 *   - getProvider(type): Provider object or null
 *
 * @throws {Error} If used outside of a Widget or DashboardWrapper
 *
 * @example
 * function MyWidget() {
 *   const { providers, hasProvider, getProvider } = useWidgetProviders();
 *
 *   if (!hasProvider("algolia")) {
 *     return <p>Algolia provider not configured</p>;
 *   }
 *
 *   const algolia = getProvider("algolia");
 *   const { appId, apiKey } = algolia.credentials;
 *   // Initialize Algolia client...
 * }
 */
export const useWidgetProviders = () => {
    const workspace = useContext(WorkspaceContext);
    const dashboard = useContext(DashboardContext);
    const widgetContext = useContext(WidgetContext);

    if (!workspace || !dashboard || !widgetContext) {
        throw new Error(
            "useWidgetProviders must be used within a Widget component. " +
                "Make sure your component is rendered inside <Widget> and within a DashboardWrapper."
        );
    }

    // Get the widget ID from widget context
    const widgetId = widgetContext?.widgetData?.uuidString;

    if (!widgetId) {
        throw new Error(
            "Widget ID not found in context. " +
                "Make sure your widget is properly initialized with a uuid."
        );
    }

    // Get providers selected for this specific widget
    const widgetSelectedProviderNames =
        workspace.workspaceData?.selectedProviders?.[widgetId] || {};

    // Look up each selected provider by name
    const providers = {};
    Object.entries(widgetSelectedProviderNames).forEach(
        ([providerType, providerName]) => {
            const provider = dashboard.providers?.[providerName];
            if (provider) {
                providers[providerType] = provider;
            }
        }
    );

    return {
        providers,
        hasProvider: (type) => type in providers,
        getProvider: (type) => providers[type] || null,
    };
};
