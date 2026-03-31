#!/usr/bin/env node

/**
 * publishThemes.js
 *
 * Publishes theme packages to the dash-registry via the API.
 *
 * What it does:
 * 1. Loads themes from curated list, --from-file, or both
 * 2. Builds a manifest for each theme (type: "theme" with colors)
 * 3. Authenticates via OAuth device code flow (opens browser)
 * 4. Creates a minimal ZIP for each theme (manifest.json + .theme.json)
 * 5. POSTs each ZIP + manifest to the registry API
 *
 * Usage:
 *   npm run publish-themes                              # Publish all 10 curated themes
 *   npm run publish-themes -- --dry-run                 # Preview manifests without publishing
 *   npm run publish-themes -- --theme nordic-frost      # Publish a single curated theme
 *   npm run publish-themes -- --local                   # Save themes locally (skip registry)
 *   npm run publish-themes -- --from-file themes/my.theme.json   # Publish from .theme.json file
 *   npm run publish-themes -- --from-file themes/       # Publish all .theme.json files in dir
 */

const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const {
    authenticate,
    getScope,
    publishToApi,
    deleteFromApi,
} = require("./lib/registryAuth");

const ROOT = path.resolve(__dirname, "..");

// Load .env from project root
require("dotenv").config({ path: path.join(ROOT, ".env") });

const REGISTRY_BASE_URL =
    process.env.DASH_REGISTRY_API_URL ||
    "https://main.d919rwhuzp7rj.amplifyapp.com";

// Tailwind color name → hex (500 shade) for manifest colors
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

function toHex(name) {
    if (!name) return "";
    return TAILWIND_COLORS[name.toLowerCase().trim()] || name;
}

function toKebabCase(str) {
    return str
        .trim()
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

// ── Theme Definitions ────────────────────────────────────────────────

const { REGISTRY_THEMES: CURATED_THEMES } = require("./registryThemes");

// ── CLI args ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isLocal = args.includes("--local");
const isRepublish = args.includes("--republish");
const themeIdx = args.indexOf("--theme");
const singleTheme = themeIdx !== -1 ? args[themeIdx + 1] : null;
const fromFileIdx = args.indexOf("--from-file");
const fromFilePath = fromFileIdx !== -1 ? args[fromFileIdx + 1] : null;

const FALLBACK_DIR = path.join(ROOT, "themes");

// ── Helpers ───────────────────────────────────────────────────────────

function getPkg() {
    return JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
}

/**
 * Load themes from .theme.json files.
 * Accepts a file path or a directory (scans for *.theme.json).
 */
function loadThemesFromFile(filePath) {
    const resolved = path.resolve(ROOT, filePath);
    const themes = [];

    if (!fs.existsSync(resolved)) {
        console.error(`Error: Path not found: ${resolved}`);
        process.exit(1);
    }

    const stat = fs.statSync(resolved);
    const files = stat.isDirectory()
        ? fs
              .readdirSync(resolved)
              .filter((f) => f.endsWith(".theme.json"))
              .map((f) => path.join(resolved, f))
        : [resolved];

    if (files.length === 0) {
        console.error(`Error: No .theme.json files found in ${resolved}`);
        process.exit(1);
    }

    for (const file of files) {
        const data = JSON.parse(fs.readFileSync(file, "utf8"));
        const baseName = path.basename(file, ".theme.json");
        themes.push({
            name: toKebabCase(data.name || baseName),
            displayName: data.name || baseName,
            description: data.description || "",
            colors: {
                primary: data.primary,
                secondary: data.secondary,
                tertiary: data.tertiary,
            },
            tags: data.tags || [],
        });
    }

    return themes;
}

// ── Manifest building ─────────────────────────────────────────────────

function buildThemeManifest(theme, scope) {
    const pkg = getPkg();
    const version = pkg.version || "0.0.0";
    const author =
        typeof pkg.author === "string" ? pkg.author : pkg.author?.name || "";
    const repository =
        typeof pkg.repository === "string"
            ? pkg.repository
            : pkg.repository?.url || "";
    const repoUrl = repository.replace(/\.git$/, "");

    const downloadUrl = `${REGISTRY_BASE_URL}/api/packages/${scope}/${theme.name}/download?version={version}`;

    return {
        scope,
        name: theme.name,
        displayName: theme.displayName,
        author,
        description: theme.description,
        version,
        type: "theme",
        category: "general",
        tags: theme.tags || [],
        downloadUrl,
        repository: repoUrl,
        publishedAt: new Date().toISOString(),
        appOrigin: pkg.name || "",
        colors: {
            primary: toHex(theme.colors.primary),
            secondary: toHex(theme.colors.secondary),
            tertiary: toHex(theme.colors.tertiary),
            neutral: toHex(theme.colors.neutral || ""),
        },
        widgets: [],
    };
}

// ── ZIP creation ──────────────────────────────────────────────────────

function createThemeZip(manifest, theme) {
    const zip = new AdmZip();
    zip.addFile(
        "manifest.json",
        Buffer.from(JSON.stringify(manifest, null, 2))
    );

    // Include the .theme.json so the install flow can extract it
    const themeData = {
        name: theme.displayName,
        primary: theme.colors.primary,
        secondary: theme.colors.secondary,
        tertiary: theme.colors.tertiary,
        shadeBackgroundFrom: 600,
        shadeBorderFrom: 600,
        shadeTextFrom: 100,
    };
    zip.addFile(
        `${theme.name}.theme.json`,
        Buffer.from(JSON.stringify(themeData, null, 2))
    );

    const tmpPath = path.join(
        ROOT,
        `theme-${manifest.name}-v${manifest.version}.zip`
    );
    zip.writeZip(tmpPath);
    return tmpPath;
}

// ── Local fallback ───────────────────────────────────────────────────

function saveThemesLocally(themes, scope) {
    fs.mkdirSync(FALLBACK_DIR, { recursive: true });

    const saved = [];

    for (const theme of themes) {
        const manifest = buildThemeManifest(theme, scope || "local");

        // Save installable ZIP (manifest.json + .theme.json)
        const zip = new AdmZip();
        zip.addFile(
            "manifest.json",
            Buffer.from(JSON.stringify(manifest, null, 2))
        );

        const themeData = {
            name: theme.displayName,
            primary: theme.colors.primary,
            secondary: theme.colors.secondary,
            tertiary: theme.colors.tertiary,
            shadeBackgroundFrom: 600,
            shadeBorderFrom: 600,
            shadeTextFrom: 100,
        };
        zip.addFile(
            `${theme.name}.theme.json`,
            Buffer.from(JSON.stringify(themeData, null, 2))
        );

        const zipPath = path.join(
            FALLBACK_DIR,
            `theme-${theme.name}-v${manifest.version}.zip`
        );
        zip.writeZip(zipPath);
        saved.push({ name: theme.name, path: zipPath });
        console.log(`  Saved: ${zipPath}`);
    }

    return saved;
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
    // Determine theme source
    let themes;

    if (fromFilePath) {
        // --from-file: load from .theme.json file(s)
        themes = loadThemesFromFile(fromFilePath);
        console.log(
            `\nLoaded ${themes.length} theme(s) from ${fromFilePath}\n`
        );
    } else if (singleTheme) {
        const found = CURATED_THEMES.find((t) => t.name === singleTheme);
        if (!found) {
            console.error(
                `Error: Theme "${singleTheme}" not found. Available: ${CURATED_THEMES.map(
                    (t) => t.name
                ).join(", ")}`
            );
            process.exit(1);
        }
        themes = [found];
    } else {
        themes = CURATED_THEMES;
    }

    console.log(`\nPublishing ${themes.length} theme(s) to registry...\n`);

    // Build manifests with placeholder scope for preview
    const packages = themes.map((theme) => ({
        theme,
        manifest: buildThemeManifest(theme, "unknown"),
    }));

    // Print manifests
    for (const { theme, manifest } of packages) {
        console.log(`── ${theme.displayName} ──`);
        console.log(
            `  Colors: ${manifest.colors.primary} / ${manifest.colors.secondary} / ${manifest.colors.tertiary}`
        );
    }

    if (isDryRun) {
        console.log(
            `\n[Dry run] ${packages.length} theme(s) would be published. No changes made.`
        );
        console.log("\nManifest preview:");
        console.log(JSON.stringify(packages[0].manifest, null, 2));
        return;
    }

    // Local-only mode: save ZIPs without publishing
    if (isLocal) {
        console.log(`\nSaving ${themes.length} theme(s) locally...\n`);
        const saved = saveThemesLocally(themes, "local");
        console.log(`\n── Summary ──`);
        console.log(`Saved ${saved.length} theme(s) to ${FALLBACK_DIR}/`);
        console.log(
            "\nTo install: open Dash → Settings → Themes → install from local ZIP"
        );
        console.log("Done!");
        return;
    }

    // Authenticate
    const token = await authenticate(REGISTRY_BASE_URL);
    const scope = await getScope(REGISTRY_BASE_URL, token);
    console.log(`Authenticated as: ${scope}\n`);

    // Rebuild manifests with real scope
    for (const pkg of packages) {
        pkg.manifest = buildThemeManifest(pkg.theme, scope);
    }

    // Delete existing packages first when --republish
    if (isRepublish) {
        console.log("Deleting existing packages...\n");
        for (const { theme, manifest } of packages) {
            const delResult = await deleteFromApi(
                REGISTRY_BASE_URL,
                token,
                scope,
                manifest.name
            );
            if (delResult.success) {
                console.log(
                    `  Deleted ${manifest.name}${
                        delResult.notFound ? " (not found, skipping)" : ""
                    }`
                );
            } else {
                console.error(
                    `  Delete failed for ${manifest.name}: ${delResult.error}`
                );
            }
        }
        console.log("");
    }

    // Publish each theme
    const results = [];
    const zipPaths = [];

    for (const { theme, manifest } of packages) {
        console.log(`Publishing ${theme.displayName}...`);

        const zipPath = createThemeZip(manifest, theme);
        zipPaths.push(zipPath);

        const result = await publishToApi(
            REGISTRY_BASE_URL,
            token,
            manifest,
            zipPath
        );

        if (result.success) {
            console.log(`  Published ${manifest.name} v${manifest.version}`);
            console.log(`  Registry: ${result.registryUrl}`);
            results.push({
                name: theme.name,
                success: true,
                registryUrl: result.registryUrl,
            });
        } else {
            console.error(`  Failed: ${result.error}`);
            if (result.details) {
                result.details.forEach((d) => console.error(`    - ${d}`));
            }
            results.push({
                name: theme.name,
                success: false,
                error: result.error,
            });
        }
    }

    // Clean up ZIP files
    for (const zipPath of zipPaths) {
        try {
            fs.unlinkSync(zipPath);
        } catch {
            // best effort
        }
    }

    // Summary
    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log("\n── Summary ──");
    console.log(`Published: ${succeeded.length}/${results.length} theme(s)`);

    if (succeeded.length > 0) {
        console.log("\nSucceeded:");
        succeeded.forEach((r) => console.log(`  ${r.name} → ${r.registryUrl}`));
    }

    if (failed.length > 0) {
        console.log("\nFailed:");
        failed.forEach((r) => console.log(`  ${r.name}: ${r.error}`));

        // Fallback: save failed themes locally
        const failedThemes = themes.filter((t) =>
            failed.some((f) => f.name === t.name)
        );
        console.log(
            `\nFallback: saving ${failedThemes.length} failed theme(s) locally...`
        );
        const saved = saveThemesLocally(failedThemes, scope);
        console.log(`Saved ${saved.length} theme(s) to ${FALLBACK_DIR}/`);
        console.log(
            "To install: open Dash → Settings → Themes → install from local ZIP"
        );
    }

    console.log("\nDone!");
}

main().catch((err) => {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
});
