/**
 * registryThemes.js
 *
 * 10 curated theme color palettes for publishing to the dash-registry.
 * Each theme uses valid Tailwind CSS color names for primary, secondary, and tertiary.
 *
 * These are distinct from the 15 built-in presets in dash-core's themeGenerator.js.
 */

const REGISTRY_THEMES = [
    {
        name: "nordic-frost",
        displayName: "Nordic Frost",
        description:
            "Cool Scandinavian palette with sky blues and slate accents",
        colors: { primary: "sky", secondary: "slate", tertiary: "blue" },
        tags: ["cool", "minimal"],
    },
    {
        name: "dracula-night",
        displayName: "Dracula Night",
        description:
            "Dark editor-inspired theme with purple, pink, and cyan tones",
        colors: { primary: "purple", secondary: "pink", tertiary: "cyan" },
        tags: ["dark", "editor"],
    },
    {
        name: "solarized-warm",
        displayName: "Solarized Warm",
        description: "Warm Solarized variant with amber, orange, and yellow",
        colors: { primary: "amber", secondary: "orange", tertiary: "yellow" },
        tags: ["warm", "classic"],
    },
    {
        name: "monokai-ember",
        displayName: "Monokai Ember",
        description:
            "Monokai-inspired palette with orange, rose, and green accents",
        colors: { primary: "orange", secondary: "rose", tertiary: "green" },
        tags: ["editor", "vibrant"],
    },
    {
        name: "evergreen-pine",
        displayName: "Evergreen Pine",
        description: "Deep forest palette with emerald, teal, and lime greens",
        colors: { primary: "emerald", secondary: "teal", tertiary: "lime" },
        tags: ["nature", "green"],
    },
    {
        name: "sakura-blossom",
        displayName: "Sakura Blossom",
        description:
            "Japanese cherry blossom theme with pink, rose, and fuchsia",
        colors: { primary: "pink", secondary: "rose", tertiary: "fuchsia" },
        tags: ["soft", "pink"],
    },
    {
        name: "oceanic-breeze",
        displayName: "Oceanic Breeze",
        description: "Tropical ocean palette with cyan, sky, and teal tones",
        colors: { primary: "cyan", secondary: "sky", tertiary: "teal" },
        tags: ["ocean", "cool"],
    },
    {
        name: "volcanic-ash",
        displayName: "Volcanic Ash",
        description: "Volcanic fire palette with red, amber, and orange",
        colors: { primary: "red", secondary: "amber", tertiary: "orange" },
        tags: ["warm", "bold"],
    },
    {
        name: "lavender-haze",
        displayName: "Lavender Haze",
        description: "Soft purple tones with violet, indigo, and purple",
        colors: { primary: "violet", secondary: "indigo", tertiary: "purple" },
        tags: ["soft", "purple"],
    },
    {
        name: "copper-canyon",
        displayName: "Copper Canyon",
        description: "Warm desert palette with orange, amber, and red tones",
        colors: { primary: "orange", secondary: "amber", tertiary: "red" },
        tags: ["warm", "desert"],
    },
];

module.exports = { REGISTRY_THEMES };
