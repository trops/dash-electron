import React, { useContext, useMemo } from "react";
import { ThemeContext } from "@trops/dash-react";

/**
 * DashboardThemeProvider
 *
 * Wraps dashboard content with a nested ThemeContext.Provider when a
 * dashboard has its own themeKey. Components inside find the nearest
 * provider automatically — zero changes needed in dash-react.
 *
 * App chrome (navbar, tab bar, sidebar) stays OUTSIDE this wrapper
 * and keeps the app theme.
 */
export const DashboardThemeProvider = ({ themeKey, children }) => {
    const parentContext = useContext(ThemeContext);
    const { themes, themeVariant } = parentContext;

    const contextValue = useMemo(() => {
        if (!themeKey || !themes || !(themeKey in themes)) return null;

        const dashboardTheme = themes[themeKey];
        const themeValue = dashboardTheme
            ? dashboardTheme[themeVariant] || null
            : null;

        if (!themeValue) return null;

        return {
            ...parentContext,
            currentTheme: themeValue,
            currentThemeKey: themeKey,
            theme: themeValue,
            themeKey: themeKey,
            appTheme: parentContext.currentTheme,
            appThemeKey: parentContext.currentThemeKey,
        };
    }, [themeKey, themes, themeVariant, parentContext]);

    if (!contextValue) return <>{children}</>;

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
};
