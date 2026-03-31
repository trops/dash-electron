#!/usr/bin/env node

/**
 * themeize.js
 *
 * Create a theme definition from color names or generate one automatically.
 *
 * Usage:
 *   npm run themeize "My Theme" --primary blue --secondary rose --tertiary amber
 *   npm run themeize "Auto Theme" --primary blue --harmony triadic
 *   npm run themeize "Random Theme" --random
 *   npm run themeize -- --list-colors                    # Show valid color names
 *
 * Output: themes/{name}.theme.json — installable via Settings > Themes > Install from ZIP
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const THEMES_DIR = path.join(ROOT, "themes");

// ── Valid Tailwind color names ───────────────────────────────────────

const TAILWIND_COLORS = {
    slate: "#64748b",
    gray: "#6b7280",
    zinc: "#71717a",
    neutral: "#737373",
    stone: "#78716c",
    red: "#ef4444",
    orange: "#f97316",
    amber: "#f59e0b",
    yellow: "#eab308",
    lime: "#84cc16",
    green: "#22c55e",
    emerald: "#10b981",
    teal: "#14b8a6",
    cyan: "#06b6d4",
    sky: "#0ea5e9",
    blue: "#3b82f6",
    indigo: "#6366f1",
    violet: "#8b5cf6",
    purple: "#a855f7",
    fuchsia: "#d946ef",
    pink: "#ec4899",
    rose: "#f43f5e",
};

const COLOR_NAMES = Object.keys(TAILWIND_COLORS);

// Chromatic colors only (exclude neutrals for harmony generation)
const CHROMATIC_COLORS = COLOR_NAMES.filter(
    (c) => !["slate", "gray", "zinc", "neutral", "stone"].includes(c)
);

// ── Color harmony ────────────────────────────────────────────────────

// Approximate hue angles for each Tailwind color (used for harmony calculations)
const COLOR_HUES = {
    red: 0,
    rose: 350,
    pink: 330,
    fuchsia: 290,
    purple: 270,
    violet: 260,
    indigo: 235,
    blue: 220,
    sky: 200,
    cyan: 190,
    teal: 170,
    emerald: 155,
    green: 140,
    lime: 85,
    yellow: 50,
    amber: 38,
    orange: 25,
};

function findClosestColor(targetHue) {
    let closest = null;
    let minDist = 360;
    for (const [name, hue] of Object.entries(COLOR_HUES)) {
        const dist = Math.min(
            Math.abs(hue - targetHue),
            360 - Math.abs(hue - targetHue)
        );
        if (dist < minDist) {
            minDist = dist;
            closest = name;
        }
    }
    return closest;
}

function generateHarmony(primaryName, strategy) {
    const primaryHue = COLOR_HUES[primaryName];
    if (primaryHue === undefined) {
        console.error(
            `Error: "${primaryName}" is not a chromatic color. Harmony requires a non-neutral color.`
        );
        console.error(
            `Valid chromatic colors: ${Object.keys(COLOR_HUES).join(", ")}`
        );
        process.exit(1);
    }

    let secondaryHue, tertiaryHue;

    switch (strategy) {
        case "complementary":
            secondaryHue = (primaryHue + 180) % 360;
            tertiaryHue = (primaryHue + 210) % 360;
            break;
        case "triadic":
            secondaryHue = (primaryHue + 120) % 360;
            tertiaryHue = (primaryHue + 240) % 360;
            break;
        case "analogous":
            secondaryHue = (primaryHue + 30) % 360;
            tertiaryHue = (primaryHue + 330) % 360;
            break;
        case "split-complementary":
            secondaryHue = (primaryHue + 150) % 360;
            tertiaryHue = (primaryHue + 210) % 360;
            break;
        default:
            console.error(`Error: Unknown harmony strategy "${strategy}".`);
            console.error(
                "Valid strategies: complementary, triadic, analogous, split-complementary"
            );
            process.exit(1);
    }

    const secondary = findClosestColor(secondaryHue);
    let tertiary = findClosestColor(tertiaryHue);

    // Avoid duplicates
    if (tertiary === secondary || tertiary === primaryName) {
        const altHue = (tertiaryHue + 15) % 360;
        tertiary = findClosestColor(altHue);
    }
    if (tertiary === secondary || tertiary === primaryName) {
        const altHue = (tertiaryHue + 345) % 360;
        tertiary = findClosestColor(altHue);
    }

    return { secondary, tertiary };
}

// ── Helpers ──────────────────────────────────────────────────────────

function toKebabCase(str) {
    return str
        .trim()
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function toTitleCase(kebab) {
    return kebab
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

function validateColor(name, flag) {
    const lower = name.toLowerCase().trim();
    if (!TAILWIND_COLORS[lower]) {
        console.error(
            `Error: "${name}" is not a valid Tailwind color (--${flag}).`
        );
        console.error(`Valid colors: ${COLOR_NAMES.join(", ")}`);
        process.exit(1);
    }
    return lower;
}

// ── CLI args ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getFlag(flag) {
    const idx = args.indexOf(`--${flag}`);
    if (idx === -1) return null;
    return args[idx + 1] || null;
}

const hasFlag = (flag) => args.includes(`--${flag}`);

// ── Main ─────────────────────────────────────────────────────────────

function main() {
    // --list-colors: show valid colors and exit
    if (hasFlag("list-colors")) {
        console.log("Valid Tailwind color names:\n");
        for (const [name, hex] of Object.entries(TAILWIND_COLORS)) {
            console.log(`  ${name.padEnd(10)} ${hex}`);
        }
        return;
    }

    // Theme name is the first non-flag argument
    const themeName = args.find((a) => !a.startsWith("--"));
    const isRandom = hasFlag("random");

    if (!themeName && !isRandom) {
        console.error(
            "Usage: npm run themeize <name> --primary <color> --secondary <color> --tertiary <color>"
        );
        console.error(
            "       npm run themeize <name> --primary <color> --harmony <strategy>"
        );
        console.error("       npm run themeize <name> --random");
        console.error("       npm run themeize -- --list-colors");
        process.exit(1);
    }

    let primary, secondary, tertiary;
    let displayName;

    if (isRandom) {
        // Pick 3 distinct random chromatic colors
        const shuffled = [...CHROMATIC_COLORS].sort(() => Math.random() - 0.5);
        primary = shuffled[0];
        secondary = shuffled[1];
        tertiary = shuffled[2];
        displayName = themeName
            ? toTitleCase(toKebabCase(themeName))
            : `${primary.charAt(0).toUpperCase() + primary.slice(1)} ${
                  secondary.charAt(0).toUpperCase() + secondary.slice(1)
              }`;
    } else {
        const primaryArg = getFlag("primary");
        if (!primaryArg) {
            console.error("Error: --primary is required (or use --random).");
            process.exit(1);
        }
        primary = validateColor(primaryArg, "primary");

        const harmonyStrategy = getFlag("harmony");
        if (harmonyStrategy) {
            const harmony = generateHarmony(primary, harmonyStrategy);
            secondary = harmony.secondary;
            tertiary = harmony.tertiary;
        } else {
            const secondaryArg = getFlag("secondary");
            const tertiaryArg = getFlag("tertiary");
            if (!secondaryArg || !tertiaryArg) {
                console.error(
                    "Error: --secondary and --tertiary are required (or use --harmony <strategy>)."
                );
                process.exit(1);
            }
            secondary = validateColor(secondaryArg, "secondary");
            tertiary = validateColor(tertiaryArg, "tertiary");
        }

        displayName = toTitleCase(toKebabCase(themeName));
    }

    const kebabName = toKebabCase(themeName || displayName);

    // Build theme data (same format as publishThemes.js --local output)
    const themeData = {
        name: displayName,
        primary,
        secondary,
        tertiary,
        shadeBackgroundFrom: 600,
        shadeBorderFrom: 600,
        shadeTextFrom: 100,
    };

    // Write .theme.json
    fs.mkdirSync(THEMES_DIR, { recursive: true });
    const outputPath = path.join(THEMES_DIR, `${kebabName}.theme.json`);
    fs.writeFileSync(outputPath, JSON.stringify(themeData, null, 2) + "\n");

    console.log(`\nTheme created: ${outputPath}`);
    console.log(`  Name:      ${displayName}`);
    console.log(`  Primary:   ${primary}`);
    console.log(`  Secondary: ${secondary}`);
    console.log(`  Tertiary:  ${tertiary}`);
    console.log(
        `\nTo install: open Dash > Settings > Themes > Install from ZIP`
    );
    console.log(
        `To publish: npm run publish-themes -- --from-file ${outputPath}`
    );
}

main();
