#!/usr/bin/env node

/**
 * validateWidget.cjs
 *
 * Validates a widget manifest and optionally the referenced ZIP archive.
 *
 * Usage:
 *   node scripts/validateWidget.cjs path/to/manifest.json          # Schema-only
 *   node scripts/validateWidget.cjs path/to/manifest.json --full   # Schema + ZIP
 *   node scripts/validateWidget.cjs path/to/manifest.json --json   # JSON output
 *   node scripts/validateWidget.cjs path/to/manifest.json --full --json
 *
 * Exit codes:
 *   0 = passed (no errors, no warnings)
 *   1 = errors found
 *   2 = warnings only (e.g. ZIP not yet available)
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const os = require("os");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const PASCAL_CASE_RE = /^[A-Z][a-zA-Z0-9]*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
const ISO_8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

const VALID_CATEGORIES = [
    "general",
    "utilities",
    "productivity",
    "development",
    "social",
    "media",
    "finance",
    "health",
    "education",
    "entertainment",
];

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

/**
 * Validate a manifest object against the registry schema.
 * @param {Object} manifest - Parsed manifest object
 * @returns {{ errors: string[], warnings: string[] }}
 */
function validateManifestSchema(manifest) {
    const errors = [];
    const warnings = [];

    if (!manifest || typeof manifest !== "object") {
        errors.push("Manifest must be a non-null object");
        return { errors, warnings };
    }

    // --- Required string fields ---
    const requiredStrings = [
        "scope",
        "name",
        "displayName",
        "author",
        "description",
        "version",
        "category",
        "downloadUrl",
        "repository",
    ];

    for (const field of requiredStrings) {
        if (typeof manifest[field] !== "string" || !manifest[field].trim()) {
            errors.push(
                `"${field}" is required and must be a non-empty string`
            );
        }
    }

    // --- scope format ---
    if (
        typeof manifest.scope === "string" &&
        manifest.scope.trim() &&
        !KEBAB_CASE_RE.test(manifest.scope)
    ) {
        errors.push(
            `"scope" must be kebab-case (got "${manifest.scope}"). Example: "my-username"`
        );
    }

    // --- name format ---
    if (
        typeof manifest.name === "string" &&
        manifest.name.trim() &&
        !KEBAB_CASE_RE.test(manifest.name)
    ) {
        errors.push(
            `"name" must be kebab-case (got "${manifest.name}"). Example: "my-widget-pack"`
        );
    }

    // --- version format ---
    if (
        typeof manifest.version === "string" &&
        manifest.version.trim() &&
        !SEMVER_RE.test(manifest.version)
    ) {
        errors.push(
            `"version" must be valid semver (got "${manifest.version}"). Example: "1.0.0"`
        );
    }

    // --- category ---
    if (
        typeof manifest.category === "string" &&
        manifest.category.trim() &&
        !VALID_CATEGORIES.includes(manifest.category)
    ) {
        warnings.push(
            `"category" "${
                manifest.category
            }" is not in the known list: ${VALID_CATEGORIES.join(", ")}`
        );
    }

    // --- downloadUrl must contain {version} ---
    if (
        typeof manifest.downloadUrl === "string" &&
        manifest.downloadUrl.trim()
    ) {
        if (!manifest.downloadUrl.includes("{version}")) {
            errors.push(
                `"downloadUrl" must contain the "{version}" placeholder so the registry can resolve versioned URLs`
            );
        }
    }

    // --- repository URL ---
    if (typeof manifest.repository === "string" && manifest.repository.trim()) {
        if (
            !manifest.repository.startsWith("https://") &&
            !manifest.repository.startsWith("http://")
        ) {
            warnings.push(
                `"repository" should be a full URL (got "${manifest.repository}")`
            );
        }
    }

    // --- tags (optional) ---
    if (manifest.tags !== undefined) {
        if (!Array.isArray(manifest.tags)) {
            errors.push(`"tags" must be an array of strings`);
        } else {
            manifest.tags.forEach((tag, i) => {
                if (typeof tag !== "string" || !tag.trim()) {
                    errors.push(`"tags[${i}]" must be a non-empty string`);
                }
            });
        }
    }

    // --- publishedAt (optional) ---
    if (manifest.publishedAt !== undefined) {
        if (
            typeof manifest.publishedAt !== "string" ||
            !ISO_8601_RE.test(manifest.publishedAt)
        ) {
            warnings.push(
                `"publishedAt" should be ISO 8601 (got "${manifest.publishedAt}")`
            );
        }
    }

    // --- widgets array ---
    if (!Array.isArray(manifest.widgets)) {
        errors.push(`"widgets" is required and must be an array`);
    } else if (manifest.widgets.length === 0) {
        errors.push(`"widgets" must contain at least one widget entry`);
    } else {
        manifest.widgets.forEach((widget, i) => {
            const prefix = `widgets[${i}]`;

            if (typeof widget.name !== "string" || !widget.name.trim()) {
                errors.push(
                    `${prefix}.name is required and must be a non-empty string`
                );
            } else if (!PASCAL_CASE_RE.test(widget.name)) {
                warnings.push(
                    `${prefix}.name should be PascalCase (got "${widget.name}")`
                );
            }

            if (
                typeof widget.displayName !== "string" ||
                !widget.displayName.trim()
            ) {
                errors.push(
                    `${prefix}.displayName is required and must be a non-empty string`
                );
            }

            if (
                typeof widget.description !== "string" ||
                !widget.description.trim()
            ) {
                errors.push(
                    `${prefix}.description is required and must be a non-empty string`
                );
            }

            if (widget.icon === undefined || widget.icon === null) {
                warnings.push(`${prefix}.icon is recommended but missing`);
            }

            // providers (optional array)
            if (widget.providers !== undefined) {
                if (!Array.isArray(widget.providers)) {
                    errors.push(`${prefix}.providers must be an array`);
                } else {
                    widget.providers.forEach((prov, j) => {
                        if (
                            typeof prov.type !== "string" ||
                            !prov.type.trim()
                        ) {
                            errors.push(
                                `${prefix}.providers[${j}].type is required`
                            );
                        }
                        if (
                            prov.required !== undefined &&
                            typeof prov.required !== "boolean"
                        ) {
                            errors.push(
                                `${prefix}.providers[${j}].required must be a boolean`
                            );
                        }
                    });
                }
            }
        });
    }

    return { errors, warnings };
}

// ---------------------------------------------------------------------------
// Config parsing (inlined from DynamicWidgetLoader.loadConfigFile)
// ---------------------------------------------------------------------------

/**
 * Parse a .dash.js config file and return its exported object.
 * Uses regex + vm.runInContext — no Electron dependency.
 *
 * @param {string} configPath - Absolute path to a .dash.js file
 * @returns {{ config: Object|null, error: string|null }}
 */
function parseDashConfig(configPath) {
    try {
        const source = fs.readFileSync(configPath, "utf8");
        const exportMatch = source.match(
            /export\s+default\s+({[\s\S]*});?\s*$/
        );

        if (!exportMatch) {
            return {
                config: null,
                error: "Could not find `export default {...}` in config file",
            };
        }

        const exportedObjectStr = exportMatch[1];
        const context = vm.createContext({ module: { exports: {} } });

        try {
            vm.runInContext(`module.exports = ${exportedObjectStr}`, context);
        } catch (vmErr) {
            // Most common cause: config references a component import that
            // can't be resolved outside the bundled runtime.
            return {
                config: null,
                error: `vm eval error: ${vmErr.message} (likely a component import reference — structure may still be valid)`,
            };
        }

        return { config: context.module.exports, error: null };
    } catch (err) {
        return { config: null, error: err.message };
    }
}

// ---------------------------------------------------------------------------
// Full validation (ZIP download, extraction, structure + config checks)
// ---------------------------------------------------------------------------

/**
 * Resolve {version} and {name} placeholders in a download URL template.
 */
function resolveDownloadUrl(urlTemplate, version, name) {
    if (!urlTemplate) return null;
    let url = urlTemplate;
    url = url.replace(/\{version\}/g, version);
    url = url.replace(/\{name\}/g, name);
    return url;
}

/**
 * Find the "real root" of an extracted ZIP.
 * If the ZIP has a single top-level directory wrapping everything, descend
 * into it so validation can find package.json and widgets/.
 */
function findWidgetRoot(extractedDir) {
    const entries = fs.readdirSync(extractedDir, { withFileTypes: true });

    // Check if current dir looks like a widget root
    const hasPackageJson = entries.some(
        (e) =>
            e.isFile() && (e.name === "package.json" || e.name === "dash.json")
    );
    const hasWidgetsDir = entries.some(
        (e) => e.isDirectory() && e.name === "widgets"
    );

    if (hasPackageJson || hasWidgetsDir) {
        return extractedDir;
    }

    // If there's exactly one subdirectory, recurse into it
    const dirs = entries.filter((e) => e.isDirectory());
    if (dirs.length === 1) {
        return findWidgetRoot(path.join(extractedDir, dirs[0].name));
    }

    return extractedDir;
}

/**
 * Run full validation: download ZIP, extract, validate structure + configs.
 *
 * @param {Object} manifest - Parsed manifest object
 * @returns {Promise<{ errors: string[], warnings: string[] }>}
 */
async function validateFull(manifest) {
    const errors = [];
    const warnings = [];

    const resolvedUrl = resolveDownloadUrl(
        manifest.downloadUrl,
        manifest.version,
        manifest.name
    );

    if (!resolvedUrl) {
        errors.push("Could not resolve downloadUrl");
        return { errors, warnings };
    }

    // ---  Download  ---
    let zipBuffer;
    try {
        const headers = {};
        if (process.env.GITHUB_TOKEN) {
            headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
        }
        const response = await fetch(resolvedUrl, { headers });
        if (!response.ok) {
            if (response.status === 404) {
                warnings.push(
                    `ZIP not found at ${resolvedUrl} (HTTP 404). The release may not be published yet.`
                );
                return { errors, warnings };
            }
            errors.push(
                `Failed to download ZIP: HTTP ${response.status} ${response.statusText}`
            );
            return { errors, warnings };
        }
        zipBuffer = Buffer.from(await response.arrayBuffer());
    } catch (fetchErr) {
        warnings.push(
            `Could not fetch ZIP at ${resolvedUrl}: ${fetchErr.message}`
        );
        return { errors, warnings };
    }

    // ---  Extract  ---
    const tmpDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "dash-validate-widget-")
    );

    try {
        const AdmZip = require("adm-zip");
        const zip = new AdmZip(zipBuffer);
        zip.extractAllTo(tmpDir, true);
    } catch (zipErr) {
        errors.push(`Failed to extract ZIP: ${zipErr.message}`);
        cleanup(tmpDir);
        return { errors, warnings };
    }

    const widgetRoot = findWidgetRoot(tmpDir);

    // ---  Structure checks  ---
    const hasPackageJson = fs.existsSync(path.join(widgetRoot, "package.json"));
    const hasDashJson = fs.existsSync(path.join(widgetRoot, "dash.json"));
    if (!hasPackageJson && !hasDashJson) {
        errors.push(
            "ZIP must contain package.json or dash.json at the root level"
        );
    }

    const widgetsDir = path.join(widgetRoot, "widgets");
    if (!fs.existsSync(widgetsDir)) {
        errors.push("ZIP must contain a widgets/ directory");
        cleanup(tmpDir);
        return { errors, warnings };
    }

    // ---  Discover .dash.js files  ---
    const files = fs.readdirSync(widgetsDir);
    const dashFiles = files.filter((f) => f.endsWith(".dash.js"));
    const jsFiles = files.filter(
        (f) => f.endsWith(".js") && !f.endsWith(".dash.js")
    );

    if (dashFiles.length === 0) {
        errors.push(
            "widgets/ directory must contain at least one .dash.js config file"
        );
        cleanup(tmpDir);
        return { errors, warnings };
    }

    // Check for matching component files
    for (const dashFile of dashFiles) {
        const baseName = dashFile.replace(".dash.js", "");
        const componentFile = `${baseName}.js`;
        if (!jsFiles.includes(componentFile)) {
            warnings.push(
                `Config ${dashFile} has no matching component file ${componentFile}`
            );
        }
    }

    // ---  Parse each .dash.js config  ---
    const discoveredNames = [];
    for (const dashFile of dashFiles) {
        const configPath = path.join(widgetsDir, dashFile);
        const { config, error } = parseDashConfig(configPath);

        if (error) {
            if (error.includes("component import reference")) {
                warnings.push(`${dashFile}: ${error}`);
            } else {
                errors.push(`${dashFile}: ${error}`);
            }
            continue;
        }

        if (config && config.name) {
            discoveredNames.push(config.name);
        } else {
            const baseName = dashFile.replace(".dash.js", "");
            discoveredNames.push(baseName);
        }
    }

    // ---  Cross-check manifest widgets vs discovered configs  ---
    if (manifest.widgets && discoveredNames.length > 0) {
        const manifestNames = manifest.widgets.map((w) => w.name);
        for (const mName of manifestNames) {
            if (!discoveredNames.includes(mName)) {
                warnings.push(
                    `Manifest widget "${mName}" not found in ZIP .dash.js configs (found: ${discoveredNames.join(
                        ", "
                    )})`
                );
            }
        }
        for (const dName of discoveredNames) {
            if (!manifestNames.includes(dName)) {
                warnings.push(
                    `ZIP config "${dName}" is not listed in manifest widgets array`
                );
            }
        }
    }

    cleanup(tmpDir);
    return { errors, warnings };
}

/**
 * Remove a temporary directory, ignoring errors.
 */
function cleanup(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch {
        // best effort
    }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[36m";

async function main() {
    const args = process.argv.slice(2);
    const flags = args.filter((a) => a.startsWith("--"));
    const positional = args.filter((a) => !a.startsWith("--"));

    const isFull = flags.includes("--full");
    const isJson = flags.includes("--json");

    if (positional.length === 0) {
        console.error(
            "Usage: node scripts/validateWidget.cjs <manifest.json> [--full] [--json]"
        );
        process.exit(1);
    }

    const manifestPath = path.resolve(positional[0]);

    if (!fs.existsSync(manifestPath)) {
        const msg = `Manifest file not found: ${manifestPath}`;
        if (isJson) {
            console.log(
                JSON.stringify({ passed: false, errors: [msg], warnings: [] })
            );
        } else {
            console.error(`${RED}ERROR: ${msg}${RESET}`);
        }
        process.exit(1);
    }

    let manifest;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (parseErr) {
        const msg = `Invalid JSON in manifest: ${parseErr.message}`;
        if (isJson) {
            console.log(
                JSON.stringify({ passed: false, errors: [msg], warnings: [] })
            );
        } else {
            console.error(`${RED}ERROR: ${msg}${RESET}`);
        }
        process.exit(1);
    }

    // --- Schema validation ---
    const schema = validateManifestSchema(manifest);
    let allErrors = [...schema.errors];
    let allWarnings = [...schema.warnings];

    // --- Full validation ---
    if (isFull && schema.errors.length === 0) {
        const full = await validateFull(manifest);
        allErrors.push(...full.errors);
        allWarnings.push(...full.warnings);
    } else if (isFull && schema.errors.length > 0) {
        allWarnings.push("Skipping full validation because schema has errors");
    }

    // --- Output ---
    if (isJson) {
        const result = {
            passed: allErrors.length === 0,
            errors: allErrors,
            warnings: allWarnings,
        };
        console.log(JSON.stringify(result, null, 2));
    } else {
        if (!isJson) {
            console.log(`\n${BLUE}Validating: ${manifestPath}${RESET}`);
            console.log(
                `${BLUE}Mode: ${
                    isFull ? "full (schema + ZIP)" : "schema only"
                }${RESET}\n`
            );
        }

        if (allErrors.length > 0) {
            for (const e of allErrors) {
                console.log(`  ${RED}ERROR: ${e}${RESET}`);
            }
        }
        if (allWarnings.length > 0) {
            for (const w of allWarnings) {
                console.log(`  ${YELLOW}WARNING: ${w}${RESET}`);
            }
        }

        console.log("");

        if (allErrors.length === 0 && allWarnings.length === 0) {
            console.log(`${GREEN}PASSED — manifest is valid${RESET}`);
        } else if (allErrors.length === 0) {
            console.log(
                `${YELLOW}PASSED with ${allWarnings.length} warning(s)${RESET}`
            );
        } else {
            console.log(
                `${RED}FAILED — ${allErrors.length} error(s), ${allWarnings.length} warning(s)${RESET}`
            );
        }
    }

    // Exit codes: 0 = passed, 1 = errors, 2 = warnings only
    if (allErrors.length > 0) {
        process.exit(1);
    } else if (allWarnings.length > 0) {
        process.exit(2);
    } else {
        process.exit(0);
    }
}

// ---------------------------------------------------------------------------
// Exports (for programmatic use by publishToRegistry.js)
// ---------------------------------------------------------------------------

module.exports = { validateManifestSchema, validateFull, parseDashConfig };

// Run CLI if invoked directly
if (require.main === module) {
    main().catch((err) => {
        console.error(`Fatal: ${err.message}`);
        process.exit(1);
    });
}
