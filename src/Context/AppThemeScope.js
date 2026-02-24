import React, { useContext } from "react";
import { ThemeContext } from "@trops/dash-react";

/**
 * AppThemeScope
 *
 * Resets currentTheme back to the app-level theme for its children.
 * Use this inside DashboardThemeProvider to ensure modals/overlays
 * render with the application theme instead of the dashboard theme.
 *
 * No-op when rendered outside DashboardThemeProvider (appTheme is undefined).
 */
export const AppThemeScope = ({ children }) => {
    const ctx = useContext(ThemeContext);

    if (!ctx.appTheme) return <>{children}</>;

    return (
        <ThemeContext.Provider
            value={{
                ...ctx,
                currentTheme: ctx.appTheme,
                currentThemeKey: ctx.appThemeKey,
                theme: ctx.appTheme,
                themeKey: ctx.appThemeKey,
                appTheme: undefined,
                appThemeKey: undefined,
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
};
