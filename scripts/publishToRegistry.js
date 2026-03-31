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
 *   npm run publish-to-registry -- --dir src/SampleWidgets  # Custom widget source directory
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
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
    Clock: "utilities",
    Google: "productivity",
    AlgoliaSETools: "development",
};

// ── CLI args ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isAll = args.includes("--all");
const isRepublish = args.includes("--republish");
const nameIdx = args.indexOf("--name");
const customName = nameIdx !== -1 ? args[nameIdx + 1] : null;
const widgetIdx = args.indexOf("--widget");
const singleWidget = widgetIdx !== -1 ? args[widgetIdx + 1] : null;
const dirIdx = args.indexOf("--dir");
const customDir = dirIdx !== -1 ? args[dirIdx + 1] : null;

const WIDGETS_DIR = customDir
    ? path.resolve(ROOT, customDir)
    : path.join(ROOT, "src", "Widgets");

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

// ── Widget ID injection ───────────────────────────────────────────────

/**
 * Write scoped id, scope, packageName, and package fields into each
 * .dash.js file in the given widget directory.
 *
 * Called BEFORE building so the injected fields are baked into the
 * Rollup CJS bundle and the configs copied by packageZip.js.
 *
 * Handles two export patterns:
 *   1. "const widgetDefinition = { ... }; export default widgetDefinition;"
 *   2. "export default { ... };"  — converts to pattern 1 first
 *
 * @param {string} widgetDirName - Widget directory name under WIDGETS_DIR
 * @param {string} scope - Authenticated registry username
 * @param {string} displayName - Human-readable package name (e.g., "Algolia SE Tools")
 */
function writeWidgetIds(widgetDirName, scope, displayName) {
    const widgetDir = path.join(WIDGETS_DIR, widgetDirName);
    const dashConfigPaths = collectDashConfigs(widgetDir);
    const pkgName = customName || toKebabCase(widgetDirName);

    for (const configPath of dashConfigPaths) {
        const widgetName = path.basename(configPath, ".dash.js");
        const scopedId = `${scope}.${pkgName}.${widgetName}`;

        let content = fs.readFileSync(configPath, "utf8");
        const original = content;

        // Convert "export default { ... };" to "const widgetDefinition = { ... }; export default widgetDefinition;"
        // so we have a consistent pattern to inject into.
        if (
            /export\s+default\s+\{/.test(content) &&
            !/const\s+widgetDefinition/.test(content)
        ) {
            content = content.replace(
                /export\s+default\s+\{/,
                "const widgetDefinition = {"
            );
            // Replace the final "};" with "};\nexport default widgetDefinition;"
            const lastBrace = content.lastIndexOf("};");
            if (lastBrace !== -1) {
                content =
                    content.slice(0, lastBrace + 2) +
                    "\nexport default widgetDefinition;\n";
            }
        }

        // Fields to inject/update
        const fields = [
            { key: "packageName", value: pkgName },
            { key: "scope", value: scope },
            { key: "id", value: scopedId },
            { key: "package", value: displayName },
        ];

        for (const { key, value } of fields) {
            const existingPattern = new RegExp(
                `(\\s+)${key}:\\s*["'][^"']*["'],?\\s*\\n`
            );
            const replacement = `$1${key}: "${value}",\n`;

            if (existingPattern.test(content)) {
                // Update existing field
                content = content.replace(existingPattern, replacement);
            } else {
                // Insert after "const widgetDefinition = {" or "const widgetDefinition = {\n"
                content = content.replace(
                    /(const widgetDefinition = \{)\n/,
                    `$1\n    ${key}: "${value}",\n`
                );
            }
        }

        if (content !== original) {
            fs.writeFileSync(configPath, content, "utf8");
            console.log(`  Updated IDs in ${path.relative(ROOT, configPath)}`);
        }
    }
}

// ── Build ─────────────────────────────────────────────────────────────

function buildWidget(widgetDirName) {
    const zipBaseName = toKebabCase(widgetDirName);

    // Clean stale ZIPs before building to avoid find() picking an old version
    const stalePattern = `widgets-${zipBaseName}-v`;
    fs.readdirSync(ROOT)
        .filter((f) => f.startsWith(stalePattern) && f.endsWith(".zip"))
        .forEach((f) => fs.unlinkSync(path.join(ROOT, f)));

    console.log(`  Building ${widgetDirName}...`);
    try {
        execSync("npm run package-widgets", {
            cwd: ROOT,
            stdio: "inherit",
            env: {
                ...process.env,
                ROLLUP_WIDGET: widgetDirName,
                ROLLUP_WIDGETS_DIR: WIDGETS_DIR,
            },
        });
        const dirFlag = customDir ? ` --dir ${customDir}` : "";
        execSync(
            `node scripts/packageZip.js --widget ${widgetDirName}${dirFlag}`,
            {
                cwd: ROOT,
                stdio: "inherit",
            }
        );
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

    // Find the actual ZIP created by packageZip.js (avoids version cache mismatch)
    const zipPattern = `widgets-${zipBaseName}-v`;
    const actualZip = fs
        .readdirSync(ROOT)
        .find((f) => f.startsWith(zipPattern) && f.endsWith(".zip"));
    const zipPath = actualZip ? path.join(ROOT, actualZip) : null;
    if (!zipPath) {
        console.error(
            `Error: No ZIP matching ${zipPattern}*.zip found in project root`
        );
        return null;
    }

    return zipPath;
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

    // Build manifest widget entries with scoped identity fields
    const manifestWidgets = widgets.map(({ package: _p, ...rest }) => ({
        ...rest,
        scope,
        packageName: registryName,
        widgetName: rest.name,
    }));

    const category = CATEGORY_MAP[widgetDirName] || "general";

    // Derive description from widget configs instead of app package.json
    const widgetDescriptions = widgets
        .map((w) => w.description)
        .filter(Boolean);
    const derivedDescription =
        widgetDescriptions.length === 1
            ? widgetDescriptions[0]
            : widgetDescriptions.length > 0
            ? widgetDescriptions.join("; ")
            : "";

    // Use registry API download endpoint (the ZIP is stored on the registry, not GitHub releases)
    const downloadUrl = `${REGISTRY_BASE_URL}/api/packages/${scope}/${registryName}/download?version={version}`;

    return {
        scope: scope,
        name: registryName,
        displayName: registryDisplayName,
        author: author,
        description: derivedDescription,
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
    const token = await authenticate(REGISTRY_BASE_URL);
    const scope = await getScope(REGISTRY_BASE_URL, token);
    console.log(`Authenticated as: ${scope}`);

    // Write scoped IDs into .dash.js files BEFORE building
    // so the injected fields are baked into the Rollup CJS bundle.
    for (const { dirName, manifest } of packages) {
        writeWidgetIds(
            dirName,
            scope,
            manifest.displayName || toTitleCase(dirName)
        );
    }

    // Rebuild manifests with real scope (picks up injected fields)
    for (const pkg of packages) {
        pkg.manifest = buildManifest(pkg.dirName, scope);
    }

    // Publish each package
    const results = [];

    for (const { dirName, manifest } of packages) {
        console.log(`\n── Publishing ${dirName} (${manifest.name}) ──`);

        // Delete existing version if --republish is set
        if (isRepublish) {
            console.log(
                `  Deleting existing package ${scope}/${manifest.name}...`
            );
            const delResult = await deleteFromApi(
                REGISTRY_BASE_URL,
                token,
                scope,
                manifest.name
            );
            if (delResult.success) {
                if (delResult.notFound) {
                    console.log("  (not found — nothing to delete)");
                } else {
                    console.log("  Deleted.");
                }
            } else {
                console.error(`  Delete failed: ${delResult.error}`);
                results.push({
                    dirName,
                    success: false,
                    error: `Delete failed: ${delResult.error}`,
                });
                continue;
            }
        }

        // Build
        const zipPath = buildWidget(dirName);
        if (!zipPath) {
            results.push({ dirName, success: false, error: "Build failed" });
            continue;
        }

        // Publish
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
