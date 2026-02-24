/**
 * themeGenerator.js
 *
 * Utility for generating themes via presets, random generation,
 * and color-harmony-based generation from a user-selected base color.
 */

// Color wheel mapping for Tailwind palettes (approximate hue angles)
const COLOR_WHEEL = {
    red: 0,
    orange: 30,
    amber: 45,
    yellow: 60,
    lime: 90,
    green: 120,
    emerald: 150,
    teal: 180,
    cyan: 195,
    sky: 210,
    blue: 240,
    indigo: 260,
    violet: 275,
    purple: 285,
    fuchsia: 300,
    pink: 330,
    rose: 350,
};

const NEUTRAL_COLORS = ["gray", "slate", "zinc", "neutral", "stone"];

const CHROMATIC_COLORS = Object.keys(COLOR_WHEEL);

/**
 * Find the nearest Tailwind color name for a given hue angle.
 */
function nearestColor(hue) {
    const normalized = ((hue % 360) + 360) % 360;
    let best = CHROMATIC_COLORS[0];
    let bestDist = 360;

    for (const [name, h] of Object.entries(COLOR_WHEEL)) {
        const dist = Math.min(
            Math.abs(normalized - h),
            360 - Math.abs(normalized - h)
        );
        if (dist < bestDist) {
            bestDist = dist;
            best = name;
        }
    }
    return best;
}

/**
 * Pick a random element from an array.
 */
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a fun theme name based on color families.
 */
export function generateThemeName(primary, secondary) {
    const adjectives = {
        red: "Crimson",
        orange: "Sunset",
        amber: "Golden",
        yellow: "Sunlit",
        lime: "Vivid",
        green: "Forest",
        emerald: "Jade",
        teal: "Lagoon",
        cyan: "Arctic",
        sky: "Horizon",
        blue: "Ocean",
        indigo: "Midnight",
        violet: "Twilight",
        purple: "Royal",
        fuchsia: "Neon",
        pink: "Blossom",
        rose: "Rosy",
        gray: "Steel",
        slate: "Shadow",
        zinc: "Iron",
        neutral: "Stone",
        stone: "Earth",
    };

    const nouns = {
        red: "Ember",
        orange: "Blaze",
        amber: "Glow",
        yellow: "Ray",
        lime: "Spark",
        green: "Canopy",
        emerald: "Grove",
        teal: "Reef",
        cyan: "Frost",
        sky: "Breeze",
        blue: "Depth",
        indigo: "Night",
        violet: "Dusk",
        purple: "Amethyst",
        fuchsia: "Flash",
        pink: "Petal",
        rose: "Dawn",
        gray: "Mist",
        slate: "Cloud",
        zinc: "Storm",
        neutral: "Haven",
        stone: "Ridge",
    };

    const adj = adjectives[primary] || "Custom";
    const noun = nouns[secondary] || "Theme";

    return `${adj} ${noun}`;
}

/**
 * Build a raw theme object from color selections.
 */
function buildRawTheme(name, primary, secondary, tertiary, neutral) {
    return {
        id: `theme-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name,
        primary,
        secondary,
        tertiary,
        neutral,
        dark: {},
        light: {},
    };
}

// ─── Presets ─────────────────────────────────────────────────────────────

export function getThemePresets() {
    return [
        buildRawTheme("Ocean Depth", "blue", "cyan", "teal", "slate"),
        buildRawTheme("Sunset Ember", "orange", "rose", "amber", "stone"),
        buildRawTheme("Forest Canopy", "green", "emerald", "lime", "gray"),
        buildRawTheme("Arctic Night", "slate", "sky", "indigo", "zinc"),
        buildRawTheme("Royal Amethyst", "purple", "violet", "fuchsia", "gray"),
        buildRawTheme("Warm Earth", "stone", "amber", "orange", "neutral"),
        buildRawTheme("Cyber Pulse", "cyan", "blue", "violet", "slate"),
        buildRawTheme("Rose Garden", "rose", "pink", "fuchsia", "gray"),
        buildRawTheme("Golden Hour", "amber", "yellow", "orange", "stone"),
        buildRawTheme("Midnight Sky", "indigo", "blue", "violet", "slate"),
        buildRawTheme("Spring Meadow", "emerald", "lime", "green", "gray"),
        buildRawTheme("Coral Reef", "red", "orange", "pink", "zinc"),
        buildRawTheme("Nordic Ice", "sky", "cyan", "blue", "slate"),
        buildRawTheme("Twilight Bloom", "violet", "purple", "pink", "gray"),
        buildRawTheme("Desert Sand", "amber", "orange", "stone", "neutral"),
    ];
}

// ─── Random Generation ───────────────────────────────────────────────────

export function generateRandomTheme() {
    const primary = pick(CHROMATIC_COLORS);
    const primaryHue = COLOR_WHEEL[primary];

    // Complementary for secondary
    const secondaryHue = (primaryHue + 180) % 360;
    const secondary = nearestColor(secondaryHue);

    // Analogous for tertiary
    const offset = pick([30, -30, 60, -60]);
    const tertiaryHue = (primaryHue + offset) % 360;
    const tertiary = nearestColor(tertiaryHue);

    const neutral = pick(NEUTRAL_COLORS);
    const name = generateThemeName(primary, secondary);

    return buildRawTheme(name, primary, secondary, tertiary, neutral);
}

// ─── Color Harmony Generation ────────────────────────────────────────────

/**
 * Generate a theme using color harmony rules from a base color.
 * @param {string} baseColor - A Tailwind color name (e.g. "blue")
 * @param {"complementary"|"analogous"|"triadic"|"split-complementary"} strategy
 */
export function generateHarmonyTheme(baseColor, strategy = "complementary") {
    const baseHue = COLOR_WHEEL[baseColor];
    if (baseHue === undefined) {
        return generateRandomTheme();
    }

    let secondaryHue, tertiaryHue;

    switch (strategy) {
        case "complementary":
            secondaryHue = (baseHue + 180) % 360;
            tertiaryHue = (baseHue + 30) % 360;
            break;
        case "analogous":
            secondaryHue = (baseHue + 30) % 360;
            tertiaryHue = (baseHue + 60) % 360;
            break;
        case "triadic":
            secondaryHue = (baseHue + 120) % 360;
            tertiaryHue = (baseHue + 240) % 360;
            break;
        case "split-complementary":
            secondaryHue = (baseHue + 150) % 360;
            tertiaryHue = (baseHue + 210) % 360;
            break;
        default:
            secondaryHue = (baseHue + 180) % 360;
            tertiaryHue = (baseHue + 30) % 360;
    }

    const primary = baseColor;
    const secondary = nearestColor(secondaryHue);
    const tertiary = nearestColor(tertiaryHue);
    const neutral = pick(NEUTRAL_COLORS);
    const name = generateThemeName(primary, secondary);

    return buildRawTheme(name, primary, secondary, tertiary, neutral);
}

/**
 * Generate a theme from three independently chosen colors.
 * @param {string} primary - A Tailwind color name
 * @param {string} secondary - A Tailwind color name
 * @param {string} tertiary - A Tailwind color name
 */
export function generateCustomTheme(primary, secondary, tertiary) {
    const neutral = pick(NEUTRAL_COLORS);
    const name = generateThemeName(primary, secondary);
    return buildRawTheme(name, primary, secondary, tertiary, neutral);
}

/**
 * All available chromatic colors for the "From Color" picker.
 */
export const AVAILABLE_COLORS = CHROMATIC_COLORS;

/**
 * Available harmony strategies for the "From Color" picker.
 */
export const HARMONY_STRATEGIES = [
    { value: "complementary", label: "Complementary" },
    { value: "analogous", label: "Analogous" },
    { value: "triadic", label: "Triadic" },
    { value: "split-complementary", label: "Split Complementary" },
    { value: "custom", label: "Custom" },
];
