import { useContext } from "react";
import { AppContext } from "../Context/App/AppContext";
import { DashboardContext } from "../Context/DashboardContext";
import { ThemeContext } from "@trops/dash-react"; // Assuming ThemeContext is re-exported from dash-react
import { WorkspaceContext } from "../Context/WorkspaceContext";

/**
 * useDashboard Hook
 *
 * Provides access to the core dashboard contexts (App, Dashboard, and Theme).
 * Optionally filters providers to those selected for a specific widget.
 * This hook can be used by any component within a DashboardWrapper.
 *
 * @param {String} widgetId - Optional widget UUID to filter providers to only those selected for this widget
 * @returns {Object} Object containing:
 *   - app: AppContext value (settings, credentials, debug mode, etc.)
 *   - dashboard: DashboardContext value (widgetApi, publisher, dashApi, credentials, providers)
 *   - theme: ThemeContext value (currentTheme, theme, themeVariant, etc.)
 *   - widgetProviders: (if widgetId provided) Filtered providers for this specific widget
 *
 * @throws {Error} If used outside of DashboardWrapper
 *
 * @example
 * // Access all dashboard context
 * const { app, dashboard, theme } = useDashboard();
 *
 * @example
 * // Access providers specific to a widget
 * const { dashboard, widgetProviders } = useDashboard(widgetId);
 * const algoliaProvider = widgetProviders.algolia; // { name, type, credentials }
 */
export const useDashboard = (widgetId = null) => {
    const app = useContext(AppContext);
    const dashboard = useContext(DashboardContext);
    const theme = useContext(ThemeContext);
    const workspace = useContext(WorkspaceContext);

    if (!app || !dashboard || !theme) {
        throw new Error(
            "useDashboard must be used within DashboardWrapper. " +
                "Make sure your component tree includes <DashboardWrapper> as a parent."
        );
    }

    let widgetProviders = null;

    // If widgetId is provided, filter to providers selected for this widget
    if (widgetId && workspace?.workspaceData?.selectedProviders) {
        const widgetSelectedProviderNames =
            workspace.workspaceData.selectedProviders[widgetId] || {};
        widgetProviders = {};

        // Look up each selected provider by name in the full providers list
        Object.entries(widgetSelectedProviderNames).forEach(
            ([providerType, providerName]) => {
                const provider = dashboard.providers?.[providerName];
                if (provider) {
                    widgetProviders[providerType] = provider;
                }
            }
        );
    }

    return {
        app,
        dashboard,
        theme,
        ...(widgetProviders && { widgetProviders }),
    };
};
