#!/usr/bin/env node

/**
 * publishThemes.js
 *
 * Publishes theme packages to the dash-registry via the API.
 *
 * What it does:
 * 1. Defines 10 curated theme color palettes
 * 2. Builds a manifest for each theme (type: "theme" with colors)
 * 3. Authenticates via OAuth device code flow (opens browser)
 * 4. Creates a minimal ZIP for each theme (manifest.json only)
 * 5. POSTs each ZIP + manifest to the registry API
 *
 * Usage:
 *   npm run publish-themes                   # Publish all 10 themes
 *   npm run publish-themes -- --dry-run      # Preview manifests without publishing
 *   npm run publish-themes -- --theme nordic-frost  # Publish a single theme
 *   npm run publish-themes -- --local        # Save themes locally (skip registry)
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const AdmZip = require("adm-zip");

const ROOT = path.resolve(__dirname, "..");

// Load .env from project root
require("dotenv").config({ path: path.join(ROOT, ".env") });

const REGISTRY_BASE_URL =
    process.env.DASH_REGISTRY_API_URL ||
    "https://main.d919rwhuzp7rj.amplifyapp.com";

// ── Theme Definitions ────────────────────────────────────────────────

const THEMES = [
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

// ── CLI args ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isLocal = args.includes("--local");
const themeIdx = args.indexOf("--theme");
const singleTheme = themeIdx !== -1 ? args[themeIdx + 1] : null;

const FALLBACK_DIR = path.join(ROOT, "themes");

// ── Helpers ───────────────────────────────────────────────────────────

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPkg() {
    return JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
}

// ── Device auth flow ──────────────────────────────────────────────────

async function authenticate() {
    console.log("\nAuthenticating with the registry...");

    const initRes = await fetch(`${REGISTRY_BASE_URL}/api/auth/device`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });

    if (!initRes.ok) {
        console.error(
            `Error: Device flow initiation failed (HTTP ${initRes.status})`
        );
        process.exit(1);
    }

    const initData = await initRes.json();
    const { device_code, user_code, verification_uri_complete, interval } =
        initData;

    console.log(`\nOpening browser for authentication...`);
    console.log(`Code: ${user_code}`);
    console.log(`URL:  ${verification_uri_complete}\n`);

    try {
        execSync(`open "${verification_uri_complete}"`, { stdio: "ignore" });
    } catch {
        console.log(
            "Could not open browser automatically. Please visit the URL above."
        );
    }

    console.log("Waiting for authorization...");
    const maxAttempts = Math.ceil(900 / (interval || 5));
    const pollInterval = (interval || 5) * 1000;

    for (let i = 0; i < maxAttempts; i++) {
        await sleep(pollInterval);

        const pollRes = await fetch(
            `${REGISTRY_BASE_URL}/api/auth/device?device_code=${encodeURIComponent(
                device_code
            )}`
        );

        if (pollRes.ok) {
            const data = await pollRes.json();
            console.log("Authorized!\n");
            return data.access_token;
        }

        if (pollRes.status === 428) continue;

        if (pollRes.status === 400) {
            const data = await pollRes.json();
            if (data.error === "expired_token") {
                console.error("Error: Device code expired. Please try again.");
                process.exit(1);
            }
            continue;
        }

        console.error(
            `Error: Unexpected poll response (HTTP ${pollRes.status})`
        );
        process.exit(1);
    }

    console.error("Error: Authorization timed out. Please try again.");
    process.exit(1);
}

async function getScope(token) {
    const res = await fetch(`${REGISTRY_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
        console.error(
            `Error: Could not fetch user profile (HTTP ${res.status}). Make sure you are registered at the registry website.`
        );
        process.exit(1);
    }

    const data = await res.json();
    return data.user.username;
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
        colors: theme.colors,
        widgets: [],
    };
}

// ── ZIP creation ──────────────────────────────────────────────────────

function createThemeZip(manifest) {
    const zip = new AdmZip();
    zip.addFile(
        "manifest.json",
        Buffer.from(JSON.stringify(manifest, null, 2))
    );
    const tmpPath = path.join(
        ROOT,
        `theme-${manifest.name}-v${manifest.version}.zip`
    );
    zip.writeZip(tmpPath);
    return tmpPath;
}

// ── Publish ───────────────────────────────────────────────────────────

async function getFormDataImpl() {
    if (
        typeof globalThis.FormData !== "undefined" &&
        typeof globalThis.File !== "undefined"
    ) {
        return { FormData: globalThis.FormData, File: globalThis.File };
    }
    const undici = await import("undici");
    return { FormData: undici.FormData, File: undici.File };
}

async function publishToApi(token, manifest, zipPath) {
    const zipBuffer = fs.readFileSync(zipPath);
    const zipFileName = path.basename(zipPath);

    const { FormData, File } = await getFormDataImpl();
    const form = new FormData();
    form.append(
        "file",
        new File([zipBuffer], zipFileName, { type: "application/zip" })
    );
    form.append("manifest", JSON.stringify(manifest));

    const res = await fetch(`${REGISTRY_BASE_URL}/api/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
    });

    const data = await res.json();

    if (!res.ok) {
        return {
            success: false,
            error: data.error || `HTTP ${res.status}`,
            details: data.details,
        };
    }

    return { success: true, ...data };
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
    // Select themes to publish
    let themes = THEMES;
    if (singleTheme) {
        const found = THEMES.find((t) => t.name === singleTheme);
        if (!found) {
            console.error(
                `Error: Theme "${singleTheme}" not found. Available: ${THEMES.map(
                    (t) => t.name
                ).join(", ")}`
            );
            process.exit(1);
        }
        themes = [found];
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
    const token = await authenticate();
    const scope = await getScope(token);
    console.log(`Authenticated as: ${scope}\n`);

    // Rebuild manifests with real scope
    for (const pkg of packages) {
        pkg.manifest = buildThemeManifest(pkg.theme, scope);
    }

    // Publish each theme
    const results = [];
    const zipPaths = [];

    for (const { theme, manifest } of packages) {
        console.log(`Publishing ${theme.displayName}...`);

        const zipPath = createThemeZip(manifest);
        zipPaths.push(zipPath);

        const result = await publishToApi(token, manifest, zipPath);

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
