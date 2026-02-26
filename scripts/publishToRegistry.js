#!/usr/bin/env node

/**
 * publishToRegistry.js
 *
 * Automates publishing widget packages to the dash-registry.
 *
 * What it does:
 * 1. Scans src/Widgets/ for all .dash.js config files
 * 2. Reads metadata from each (name, author, description, icon, version, providers, etc.)
 * 3. Reads package.json for package-level info (name, version, author, repository)
 * 4. Generates a manifest.json conforming to the registry schema
 * 5. Uses `gh` CLI to fork dash-registry, create a branch, write manifest, and open a PR
 *
 * Prerequisites:
 * - `gh` CLI installed and authenticated (`gh auth login`)
 * - `npm run package-zip` script available (the script builds and uploads the ZIP automatically)
 *
 * Usage:
 *   npm run publish-to-registry
 *   npm run publish-to-registry -- --dry-run    # Preview manifest without opening PR
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const WIDGETS_DIR = path.join(ROOT, "src", "Widgets");
const REGISTRY_REPO = "trops/dash-registry";

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const nameIdx = args.indexOf("--name");
const customName = nameIdx !== -1 ? args[nameIdx + 1] : null;

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
        const typeMatches = providerBlock.match(/type\s*:\s*["']([^"']+)["']/g);
        const requiredMatches = providerBlock.match(
            /required\s*:\s*(true|false)/g
        );
        if (typeMatches) {
            typeMatches.forEach((t, i) => {
                const provType = t.match(/["']([^"']+)["']/)[1];
                const req =
                    requiredMatches && requiredMatches[i]
                        ? requiredMatches[i].includes("true")
                        : false;
                providers.push({ type: provType, required: req });
            });
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

function exec(cmd) {
    try {
        return execSync(cmd, { encoding: "utf8", stdio: "pipe" }).trim();
    } catch (error) {
        return null;
    }
}

function checkGhCli() {
    const version = exec("gh --version");
    if (!version) {
        console.error("Error: `gh` CLI is not installed.");
        console.error("Install it: https://cli.github.com/");
        process.exit(1);
    }

    const authStatus = exec("gh auth status 2>&1");
    if (!authStatus || authStatus.includes("not logged")) {
        console.error("Error: `gh` CLI is not authenticated.");
        console.error("Run: gh auth login");
        process.exit(1);
    }
}

function buildAndRelease(packageName, version) {
    const tag = `v${version}`;
    const zipName = `${packageName}-${tag}.zip`;

    // Always build a fresh ZIP
    console.log(`\nBuilding widget package...`);
    try {
        execSync("npm run package-zip", { cwd: ROOT, stdio: "inherit" });
    } catch {
        console.error("Error: Failed to build widget package.");
        process.exit(1);
    }

    const zipPath = path.join(ROOT, zipName);
    if (!fs.existsSync(zipPath)) {
        console.error(`Error: Expected ZIP not found at ${zipPath}`);
        process.exit(1);
    }

    // Try creating a new release
    console.log(`Uploading ${zipName} to release ${tag}...`);
    const createResult = exec(
        `gh release create ${tag} "${zipPath}" --generate-notes 2>&1`
    );

    if (createResult && !createResult.includes("already exists")) {
        console.log(`Release ${tag} created.`);
        return;
    }

    // Release already exists — replace the ZIP asset
    console.log(`Release ${tag} exists. Replacing asset...`);
    const uploadResult = exec(
        `gh release upload ${tag} "${zipPath}" --clobber 2>&1`
    );
    if (!uploadResult || uploadResult.includes("error")) {
        console.error("Error: Failed to upload ZIP to existing release.");
        console.error(uploadResult);
        process.exit(1);
    }

    console.log(`Release ${tag} updated with fresh ${zipName}.`);
}

function main() {
    // Read package.json
    const pkg = JSON.parse(
        fs.readFileSync(path.join(ROOT, "package.json"), "utf8")
    );
    const projectName = (pkg.name || "widgets").replace(/^@[^/]+\//, "");
    const version = pkg.version || "0.0.0";
    const author =
        typeof pkg.author === "string" ? pkg.author : pkg.author?.name || "";
    const repository =
        typeof pkg.repository === "string"
            ? pkg.repository
            : pkg.repository?.url || "";

    // Detect scope (GitHub username) — needed for manifest even in dry-run
    const scope = exec("gh api user --jq .login 2>/dev/null");
    if (!scope && !isDryRun) {
        checkGhCli(); // will error with helpful message
    }

    // Collect widget configs
    const dashConfigPaths = collectDashConfigs(WIDGETS_DIR);
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
        console.error("Error: No widgets found in src/Widgets/");
        process.exit(1);
    }

    // ── Resolve registryName / registryDisplayName ──────────────────

    let registryName = projectName; // Priority 4: package.json
    let registryDisplayName = pkg.productName || projectName;

    // Priority 3: Folder name under src/Widgets/
    const widgetDirs = fs
        .readdirSync(WIDGETS_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    if (widgetDirs.length === 1) {
        registryName = toKebabCase(widgetDirs[0]);
        registryDisplayName = toTitleCase(registryName);
    }

    // Priority 2: .dash.js package field
    const packageNames = [
        ...new Set(widgets.map((w) => w.package).filter(Boolean)),
    ];
    if (packageNames.length === 1) {
        registryDisplayName = packageNames[0];
        registryName = toKebabCase(packageNames[0]);
    } else if (packageNames.length > 1) {
        console.warn(
            `Warning: Multiple package names in configs: ${packageNames.join(
                ", "
            )}`
        );
    }

    // Priority 1: --name flag (always wins)
    if (customName) {
        if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(customName)) {
            console.error(
                `Error: --name must be kebab-case (got "${customName}").`
            );
            process.exit(1);
        }
        registryName = customName;
        registryDisplayName = toTitleCase(customName);
    }

    // Strip internal "package" field from widget entries before manifest
    const manifestWidgets = widgets.map(({ package: _pkg, ...rest }) => rest);

    // Infer category from tags or default
    const category = "general";

    // Build download URL template (uses projectName for ZIP filename)
    const repoUrl = repository.replace(/\.git$/, "");
    const downloadUrl = repoUrl
        ? `${repoUrl}/releases/download/v{version}/${projectName}-v{version}.zip`
        : "";

    // Generate manifest
    const manifest = {
        scope: scope || "unknown",
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
    };

    console.log("\nGenerated manifest:");
    console.log(JSON.stringify(manifest, null, 2));
    console.log(`\nWidgets: ${manifestWidgets.map((w) => w.name).join(", ")}`);

    // Pre-flight schema validation
    const { validateManifestSchema } = require("./validateWidget.cjs");
    const { errors: schemaErrors, warnings: schemaWarnings } =
        validateManifestSchema(manifest);

    if (schemaErrors.length > 0) {
        console.error("\nManifest validation failed:");
        schemaErrors.forEach((e) => console.error(`  ERROR: ${e}`));
        schemaWarnings.forEach((w) => console.warn(`  WARNING: ${w}`));
        process.exit(1);
    }
    if (schemaWarnings.length > 0) {
        console.warn("\nManifest validation warnings:");
        schemaWarnings.forEach((w) => console.warn(`  WARNING: ${w}`));
    } else {
        console.log("\nManifest schema validation passed.");
    }

    if (isDryRun) {
        console.log("\n[Dry run] No PR will be created.");
        return;
    }

    if (!downloadUrl) {
        console.error(
            "\nError: Could not determine download URL. Set `repository` in package.json."
        );
        process.exit(1);
    }

    // Check gh CLI (needed for release upload and PR creation)
    checkGhCli();

    // Build fresh ZIP and ensure release has latest assets
    buildAndRelease(projectName, version);

    console.log("\nPublishing to dash-registry...");

    // Fork the registry repo (idempotent)
    console.log(`Forking ${REGISTRY_REPO}...`);
    exec(`gh repo fork ${REGISTRY_REPO} --clone=false 2>&1`);

    // Get the user's GitHub username (already have scope, but verify for PR)
    const ghUser = scope;
    if (!ghUser) {
        console.error("Error: Could not determine GitHub username.");
        process.exit(1);
    }

    const branchName = `add-${registryName}`;
    const manifestPath = `packages/${scope}/${registryName}/manifest.json`;
    const manifestContent = JSON.stringify(manifest, null, 2);

    // Create the manifest file via the GitHub API
    console.log(`Creating ${manifestPath} on branch ${branchName}...`);

    // Get the default branch SHA
    const defaultBranch =
        exec(
            `gh api repos/${ghUser}/dash-registry --jq .default_branch 2>&1`
        ) || "main";
    const baseSha = exec(
        `gh api repos/${ghUser}/dash-registry/git/ref/heads/${defaultBranch} --jq .object.sha 2>&1`
    );

    if (!baseSha) {
        console.error(
            "Error: Could not get base SHA. Make sure the fork exists."
        );
        process.exit(1);
    }

    // Create branch
    exec(
        `gh api repos/${ghUser}/dash-registry/git/refs -f ref=refs/heads/${branchName} -f sha=${baseSha} 2>&1`
    );

    // Write manifest file via Contents API
    const encodedContent = Buffer.from(manifestContent).toString("base64");
    const createResult = exec(
        `gh api repos/${ghUser}/dash-registry/contents/${manifestPath} \
        -X PUT \
        -f message="Add ${registryName} v${version}" \
        -f content="${encodedContent}" \
        -f branch="${branchName}" 2>&1`
    );

    if (!createResult || createResult.includes("error")) {
        // File might already exist, try updating
        const existingSha = exec(
            `gh api repos/${ghUser}/dash-registry/contents/${manifestPath}?ref=${branchName} --jq .sha 2>&1`
        );
        if (existingSha && !existingSha.includes("Not Found")) {
            exec(
                `gh api repos/${ghUser}/dash-registry/contents/${manifestPath} \
                -X PUT \
                -f message="Update ${registryName} to v${version}" \
                -f content="${encodedContent}" \
                -f branch="${branchName}" \
                -f sha="${existingSha}" 2>&1`
            );
        }
    }

    // Create PR
    console.log("Opening pull request...");
    const prTitle = `Add ${manifest.displayName} v${version}`;
    const prBody = `## New Package: ${manifest.displayName}

**Author:** ${author}
**Version:** ${version}
**Widgets:** ${manifestWidgets.map((w) => w.displayName || w.name).join(", ")}

${manifest.description}

---
*Auto-generated by \`npm run publish-to-registry\`*`;

    const prResult = exec(
        `gh pr create \
        --repo ${REGISTRY_REPO} \
        --head ${ghUser}:${branchName} \
        --title "${prTitle}" \
        --body "${prBody.replace(/"/g, '\\"')}" 2>&1`
    );

    if (prResult && prResult.includes("github.com")) {
        console.log(`\nPull request created: ${prResult}`);
    } else {
        console.log(
            "\nPR may already exist or was created. Check:",
            `https://github.com/${REGISTRY_REPO}/pulls`
        );
    }

    console.log(
        "\nDone! Your widgets will appear in the Discover tab once the PR is merged."
    );
}

main();
