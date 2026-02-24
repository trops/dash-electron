import { findIconDefinition } from "@fortawesome/fontawesome-svg-core";

const FALLBACK = "puzzle-piece";

/**
 * Resolve an icon name to a valid FontAwesome icon reference.
 * Tries solid (fas) first, then brand (fab). Returns "puzzle-piece" if
 * the icon is falsy or not found in either prefix.
 */
export const resolveIcon = (iconName) => {
    if (!iconName) return FALLBACK;

    // Already an array tuple like ["fab", "github"] — pass through
    if (Array.isArray(iconName)) return iconName;

    // Try solid
    if (findIconDefinition({ prefix: "fas", iconName })) return iconName;

    // Try brand
    if (findIconDefinition({ prefix: "fab", iconName }))
        return ["fab", iconName];

    return FALLBACK;
};
