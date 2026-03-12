#!/usr/bin/env node

/**
 * publishToRegistry.js
 *
 * Publishes widget packages to the dash-registry via the API.
 *
 * What it does:
 * 1. Scans src/Widgets/ for .dash.js config files
 * 2. Builds a manifest from metadata (name, author, description, icon, version, providers)
 * 3. Validates the manifest against the registry schema
 * 4. Authenticates via OAuth device code flow (opens browser)
 * 5. Builds the widget bundle (Rollup) and creates a ZIP
 * 6. POSTs the ZIP + manifest to the registry API
 *
 * Usage:
 *   npm run publish-to-registry                          # Publish default package
 *   npm run publish-to-registry -- --widget Chat         # Publish single widget directory
 *   npm run publish-to-registry -- --all                 # Publish all widget directories
 *   npm run publish-to-registry -- --dry-run             # Preview manifest without publishing
 *   npm run publish-to-registry -- --name custom-name    # Override registry name
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");

// Load .env from project root
require("dotenv").config({ path: path.join(ROOT, ".env") });

const WIDGETS_DIR = path.join(ROOT, "src", "Widgets");
const REGISTRY_BASE_URL =
    process.env.DASH_REGISTRY_API_URL || "https://registry.trops.dev";

const CATEGORY_MAP = {
    DashSamples: "general",
    Chat: "productivity",
    GoogleCalendar: "productivity",
    Gong: "productivity",
    GitHub: "development",
    Gmail: "productivity",
    Slack: "social",
    Notion: "productivity",
    GoogleDrive: "productivity",
    Algolia: "development",
    AlgoliaSearch: "development",
    Filesystem: "utilities",
    Google: "productivity",
};

// ── CLI args ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isAll = args.includes("--all");
const nameIdx = args.indexOf("--name");
const customName = nameIdx !== -1 ? args[nameIdx + 1] : null;
const widgetIdx = args.indexOf("--widget");
const singleWidget = widgetIdx !== -1 ? args[widgetIdx + 1] : null;

// ── Helpers ───────────────────────────────────────────────────────────

function toKebabCase(str) {
    return str
        .trim()
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

function collectDashConfigs(dir) {
    const configs = [];
    if (!fs.existsSync(dir)) return configs;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            configs.push(...collectDashConfigs(fullPath));
        } else if (entry.name.endsWith(".dash.js")) {
            configs.push(fullPath);
        }
    }
    return configs;
}

function parseDashConfig(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    const fileName = path.basename(filePath, ".dash.js");

    const extract = (key) => {
        const patterns = [
            new RegExp(`${key}\\s*:\\s*"([^"]*)"`, "m"),
            new RegExp(`${key}\\s*:\\s*'([^']*)'`, "m"),
        ];
        for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) return match[1];
        }
        return null;
    };

    const extractTopLevel = (key) => {
        // Remove userConfig block to avoid matching nested displayName fields
        const stripped = content.replace(
            /userConfig\s*:\s*\{[\s\S]*?\n    \},?/m,
            ""
        );
        const patterns = [
            new RegExp(`${key}\\s*:\\s*"([^"]*)"`, "m"),
            new RegExp(`${key}\\s*:\\s*'([^']*)'`, "m"),
        ];
        for (const pattern of patterns) {
            const match = stripped.match(pattern);
            if (match) return match[1];
        }
        return null;
    };

    const typeMatch = content.match(/type\s*:\s*["'](\w+)["']/);
    const type = typeMatch ? typeMatch[1] : "widget";

    let providers = [];
    const providersMatch = content.match(/providers\s*:\s*\[([\s\S]*?)\]/m);
    if (providersMatch) {
        const providerBlock = providersMatch[1];
        const objectRegex = /\{([^}]+)\}/g;
        let objMatch;
        while ((objMatch = objectRegex.exec(providerBlock)) !== null) {
            const obj = objMatch[1];
            const typeM = obj.match(/type\s*:\s*["']([^"']+)["']/);
            const reqM = obj.match(/required\s*:\s*(true|false)/);
            const classM = obj.match(/providerClass\s*:\s*["']([^"']+)["']/);
            if (typeM) {
                const entry = {
                    type: typeM[1],
                    required: reqM ? reqM[1] === "true" : false,
                };
                if (classM) {
                    entry.providerClass = classM[1];
                }
                providers.push(entry);
            }
        }
    }

    return {
        name: fileName,
        displayName: extractTopLevel("displayName") || fileName,
        description: extract("description") || "",
        icon: extract("icon") || null,
        type,
        providers,
        package: extract("package") || null,
    };
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Device auth flow ──────────────────────────────────────────────────

async function authenticate() {
    console.log("\nAuthenticating with the registry...");

    // 1. Initiate device flow
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

    // 2. Open browser
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

    // 3. Poll for token
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

        if (pollRes.status === 428) {
            // authorization_pending — keep polling
            continue;
        }

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

// ── Build ─────────────────────────────────────────────────────────────

function buildWidget(widgetDirName) {
    const version = getPkg().version || "0.0.0";
    const tag = `v${version}`;
    const zipBaseName = toKebabCase(widgetDirName);
    const zipName = `${zipBaseName}-${tag}.zip`;

    console.log(`  Building ${widgetDirName}...`);
    try {
        execSync("npm run package-widgets", {
            cwd: ROOT,
            stdio: "inherit",
            env: { ...process.env, ROLLUP_WIDGET: widgetDirName },
        });
        execSync(`node scripts/packageZip.js --widget ${widgetDirName}`, {
            cwd: ROOT,
            stdio: "inherit",
        });
    } catch {
        console.error(
            `Error: Failed to build widget package for ${widgetDirName}.`
        );
        return null;
    }

    // Scan CJS bundle for unbundled require() calls
    const HOST_MODULES = [
        "react",
        "react-dom",
        "@trops/dash-core",
        "@trops/dash-react",
        "prop-types",
    ];
    const distDir = path.join(ROOT, "dist");
    if (fs.existsSync(distDir)) {
        const cjsFiles = fs
            .readdirSync(distDir)
            .filter((f) => f.endsWith(".cjs.js"));
        for (const cjsFile of cjsFiles) {
            const bundleContent = fs.readFileSync(
                path.join(distDir, cjsFile),
                "utf8"
            );
            const requireCalls = bundleContent.match(
                /require\s*\(\s*["']([^"']+)["']\s*\)/g
            );
            if (requireCalls) {
                const unknowns = [];
                for (const call of requireCalls) {
                    const mod = call.match(/["']([^"']+)["']/)[1];
                    const isHost = HOST_MODULES.some(
                        (h) => mod === h || mod.startsWith(h + "/")
                    );
                    const isRelative = mod.startsWith(".");
                    const isBabelRuntime = mod.startsWith("@babel/runtime");
                    if (!isHost && !isRelative && !isBabelRuntime) {
                        unknowns.push(mod);
                    }
                }
                const unique = [...new Set(unknowns)];
                if (unique.length > 0) {
                    console.warn(
                        `\n  WARNING: Unbundled dependencies in ${cjsFile}:`
                    );
                    unique.forEach((m) =>
                        console.warn(`    - ${m} (not in host module list)`)
                    );
                    console.warn(
                        "  These will fail at runtime if not available in the host app.\n"
                    );
                }
            }
        }
    }

    const zipPath = path.join(ROOT, zipName);
    if (!fs.existsSync(zipPath)) {
        console.error(`Error: Expected ZIP not found at ${zipPath}`);
        return null;
    }

    return zipPath;
}

// ── Publish ───────────────────────────────────────────────────────────

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

async function getFormDataImpl() {
    // Node 18+ has global FormData and File via undici
    if (
        typeof globalThis.FormData !== "undefined" &&
        typeof globalThis.File !== "undefined"
    ) {
        return { FormData: globalThis.FormData, File: globalThis.File };
    }
    // Fallback for older Node
    const undici = await import("undici");
    return { FormData: undici.FormData, File: undici.File };
}

// ── Manifest building ─────────────────────────────────────────────────

let _pkg = null;
function getPkg() {
    if (!_pkg) {
        _pkg = JSON.parse(
            fs.readFileSync(path.join(ROOT, "package.json"), "utf8")
        );
    }
    return _pkg;
}

function buildManifest(widgetDirName, scope) {
    const pkg = getPkg();
    const version = pkg.version || "0.0.0";
    const author =
        typeof pkg.author === "string" ? pkg.author : pkg.author?.name || "";
    const repository =
        typeof pkg.repository === "string"
            ? pkg.repository
            : pkg.repository?.url || "";
    const repoUrl = repository.replace(/\.git$/, "");

    // Collect widget configs for this directory
    const widgetDir = path.join(WIDGETS_DIR, widgetDirName);
    const dashConfigPaths = collectDashConfigs(widgetDir);
    const widgets = [];

    for (const configPath of dashConfigPaths) {
        const config = parseDashConfig(configPath);
        if (config.type === "widget") {
            widgets.push({
                name: config.name,
                displayName: config.displayName,
                description: config.description,
                icon: config.icon,
                providers: config.providers,
                package: config.package,
            });
        }
    }

    if (widgets.length === 0) {
        return null;
    }

    // Resolve registry name
    let registryName = toKebabCase(widgetDirName);
    let registryDisplayName = toTitleCase(registryName);

    // Override from .dash.js package field if consistent
    const packageNames = [
        ...new Set(widgets.map((w) => w.package).filter(Boolean)),
    ];
    if (packageNames.length === 1) {
        registryDisplayName = packageNames[0];
        registryName = toKebabCase(packageNames[0]);
    }

    // --name flag always wins (only applies to single-widget mode)
    if (customName && !isAll) {
        registryName = customName;
        registryDisplayName = toTitleCase(customName);
    }

    // Strip internal "package" field from widget entries
    const manifestWidgets = widgets.map(({ package: _p, ...rest }) => rest);

    const category = CATEGORY_MAP[widgetDirName] || "general";

    // Build download URL template (for manifest validation compatibility)
    const zipBaseName = toKebabCase(widgetDirName);
    const downloadUrl = repoUrl
        ? `${repoUrl}/releases/download/v{version}/${zipBaseName}-v{version}.zip`
        : `${REGISTRY_BASE_URL}/api/packages/${scope}/${registryName}/download?version={version}`;

    return {
        scope: scope,
        name: registryName,
        displayName: registryDisplayName,
        author: author,
        description: pkg.description || "",
        version: version,
        category: category,
        tags: pkg.keywords || [],
        downloadUrl: downloadUrl,
        repository: repoUrl,
        publishedAt: new Date().toISOString(),
        widgets: manifestWidgets,
        appOrigin: pkg.name || "",
    };
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
    // Determine which widget directories to process
    let widgetDirs;

    if (isAll) {
        widgetDirs = fs
            .readdirSync(WIDGETS_DIR, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name);
    } else if (singleWidget) {
        widgetDirs = [singleWidget];
    } else {
        // Default: all directories (same as --all)
        widgetDirs = fs
            .readdirSync(WIDGETS_DIR, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name);
    }

    // Validate --name is kebab-case
    if (customName && !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(customName)) {
        console.error(
            `Error: --name must be kebab-case (got "${customName}").`
        );
        process.exit(1);
    }

    // Use a placeholder scope for dry-run, real scope after auth
    const dryRunScope = "unknown";

    // Build manifests and validate
    const packages = [];
    for (const dirName of widgetDirs) {
        const manifest = buildManifest(dirName, dryRunScope);
        if (!manifest) {
            console.log(`Skipping ${dirName} (no widgets found)`);
            continue;
        }
        packages.push({ dirName, manifest });
    }

    if (packages.length === 0) {
        console.error("Error: No publishable widget directories found.");
        process.exit(1);
    }

    // Print manifests and validate
    const { validateManifestSchema } = require("./validateWidget.cjs");
    let hasErrors = false;

    for (const { dirName, manifest } of packages) {
        console.log(`\n── ${dirName} ──`);
        console.log(JSON.stringify(manifest, null, 2));
        console.log(
            `Widgets: ${manifest.widgets.map((w) => w.name).join(", ")}`
        );

        const { errors, warnings } = validateManifestSchema(manifest);

        if (errors.length > 0) {
            console.error(`\nManifest validation failed for ${dirName}:`);
            errors.forEach((e) => console.error(`  ERROR: ${e}`));
            warnings.forEach((w) => console.warn(`  WARNING: ${w}`));
            hasErrors = true;
        } else if (warnings.length > 0) {
            console.warn(`Validation warnings for ${dirName}:`);
            warnings.forEach((w) => console.warn(`  WARNING: ${w}`));
        } else {
            console.log("Schema validation passed.");
        }
    }

    if (hasErrors) {
        console.error("\nAborting due to validation errors.");
        process.exit(1);
    }

    if (isDryRun) {
        console.log(
            `\n[Dry run] ${packages.length} package(s) would be published. No changes made.`
        );
        return;
    }

    // Authenticate (once for all packages)
    const token = await authenticate();
    const scope = await getScope(token);
    console.log(`Authenticated as: ${scope}`);

    // Rebuild manifests with real scope
    for (const pkg of packages) {
        pkg.manifest = buildManifest(pkg.dirName, scope);
    }

    // Publish each package
    const results = [];

    for (const { dirName, manifest } of packages) {
        console.log(`\n── Publishing ${dirName} (${manifest.name}) ──`);

        // Build
        const zipPath = buildWidget(dirName);
        if (!zipPath) {
            results.push({ dirName, success: false, error: "Build failed" });
            continue;
        }

        // Publish
        const result = await publishToApi(token, manifest, zipPath);

        if (result.success) {
            console.log(`  Published ${manifest.name} v${manifest.version}`);
            console.log(`  Registry: ${result.registryUrl}`);
            results.push({
                dirName,
                success: true,
                registryUrl: result.registryUrl,
            });
        } else {
            console.error(`  Failed: ${result.error}`);
            if (result.details) {
                result.details.forEach((d) => console.error(`    - ${d}`));
            }
            results.push({ dirName, success: false, error: result.error });
        }
    }

    // Summary
    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log("\n── Summary ──");
    console.log(`Published: ${succeeded.length}/${results.length} package(s)`);

    if (succeeded.length > 0) {
        console.log("\nSucceeded:");
        succeeded.forEach((r) =>
            console.log(`  ${r.dirName} → ${r.registryUrl}`)
        );
    }

    if (failed.length > 0) {
        console.log("\nFailed:");
        failed.forEach((r) => console.log(`  ${r.dirName}: ${r.error}`));
        process.exit(1);
    }

    console.log("\nDone!");
}

main().catch((err) => {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
});
