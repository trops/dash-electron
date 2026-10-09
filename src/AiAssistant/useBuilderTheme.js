/**
 * useBuilderTheme — the Widget Builder's colour vocabulary, from the app
 * theme. Every builder surface uses these instead of fixed Tailwind palette
 * classes, so the builder reads right in light and dark themes.
 *
 *   const bt = useBuilderTheme();
 *   <p className={`text-xs ${bt.muted}`}>…</p>
 *
 * The builder modal renders outside the app's theme provider and passes
 * the app theme context in (`useBuilderTheme(chatThemeCtx)`); components
 * inside the modal read it from ThemeContext.
 */
import { useContext } from "react";
import {
    ThemeContext,
    getStatusColors,
    getStylesForItem,
    themeObjects,
} from "@trops/dash-react";

export function builderTheme(themeCtx) {
    const currentTheme = themeCtx?.currentTheme || {};
    const tk = (key) => currentTheme[key] || "";
    return {
        tk,
        text: tk("text-primary-light"),
        muted: `${tk("text-primary-medium")} opacity-70`,
        accent: tk("text-secondary-medium"),
        border: tk("border-primary-dark"),
        accentBorder: tk("border-secondary-medium"),
        hoverAccentBorder: tk("hover-border-secondary-medium"),
        // Surfaces: sunken (inputs, cards on the panel), raised (chips,
        // quiet buttons), and the hover tint for rows and quiet buttons.
        surface: tk("bg-primary-very-dark"),
        raised: tk("bg-primary-medium"),
        hoverSurface: tk("hover-bg-primary-medium"),
        tint: tk("bg-secondary-dark"),
        hoverTint: tk("hover-bg-secondary-dark"),
        // Filled primary action — the same classes dash-react's <Button>.
        primaryFill: getStylesForItem(
            themeObjects.BUTTON,
            currentTheme,
            { scrollable: false, grow: false, space: false },
            null,
            "md"
        ).string,
        // Text on a saturated status fill (status.*.solidBg).
        onSolid: "text-white",
        status: getStatusColors(themeCtx?.themeVariant || "dark"),
    };
}

export function useBuilderTheme(themeCtxOverride = null) {
    const fromContext = useContext(ThemeContext);
    return builderTheme(themeCtxOverride || fromContext);
}
