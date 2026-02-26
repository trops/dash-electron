#!/usr/bin/env node

/**
 * packageZip.js
 *
 * Creates a distributable ZIP from bundled widgets.
 * Run after `npm run package-widgets` (or use `npm run package-zip` which does both).
 *
 * What it does:
 * 1. Reads dist/ output from Rollup (created by package-widgets)
 * 2. Collects all .dash.js config files from src/Widgets/
 * 3. Generates dash.json metadata from package.json + widget configs
 * 4. Bundles everything into a ZIP file in the project root
 *
 * Output: {package-name}-v{version}.zip
 */

const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

const ROOT = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT, "dist");
const WIDGETS_DIR = path.join(ROOT, "src", "Widgets");

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

    // Extract metadata from the config using regex (configs are simple objects)
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

    // Extract the component name from the filename
    const fileName = path.basename(filePath, ".dash.js");

    // Determine type
    const typeMatch = content.match(/type\s*:\s*["'](\w+)["']/);
    const type = typeMatch ? typeMatch[1] : "widget";

    // Extract providers array if present
    let providers = [];
    const providersMatch = content.match(/providers\s*:\s*\[([\s\S]*?)\]/m);
    if (providersMatch) {
        // Simple extraction of provider objects
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
    };
}

function main() {
    // Verify dist/ exists
    if (!fs.existsSync(DIST_DIR)) {
        console.error(
            "Error: dist/ directory not found. Run `npm run package-widgets` first."
        );
        process.exit(1);
    }

    const distFiles = fs.readdirSync(DIST_DIR);
    if (distFiles.length === 0) {
        console.error("Error: dist/ directory is empty.");
        process.exit(1);
    }

    // Read package.json
    const pkg = JSON.parse(
        fs.readFileSync(path.join(ROOT, "package.json"), "utf8")
    );
    const packageName = (pkg.name || "widgets").replace(/^@[^/]+\//, "");
    const version = pkg.version || "0.0.0";

    // Collect .dash.js configs
    const dashConfigPaths = collectDashConfigs(WIDGETS_DIR);
    const widgets = [];
    const workspaces = [];

    for (const configPath of dashConfigPaths) {
        const config = parseDashConfig(configPath);
        if (config.type === "widget") {
            widgets.push({
                name: config.name,
                displayName: config.displayName,
                description: config.description,
                icon: config.icon,
                providers: config.providers,
            });
        } else if (config.type === "workspace") {
            workspaces.push({
                name: config.name,
                displayName: config.displayName,
            });
        }
    }

    console.log(
        `Found ${widgets.length} widget(s) and ${workspaces.length} workspace(s)`
    );

    // Generate dash.json metadata
    const dashJson = {
        name: packageName,
        displayName: pkg.productName || packageName,
        version: version,
        description: pkg.description || "",
        author:
            typeof pkg.author === "string"
                ? pkg.author
                : pkg.author?.name || "",
        repository:
            typeof pkg.repository === "string"
                ? pkg.repository
                : pkg.repository?.url || "",
        widgets,
        workspaces,
        createdAt: new Date().toISOString(),
    };

    // Create ZIP
    const zip = new AdmZip();

    // Add all dist/ files
    const addDirectory = (dirPath, zipPath) => {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const entryZipPath = zipPath
                ? `${zipPath}/${entry.name}`
                : entry.name;
            if (entry.isDirectory()) {
                addDirectory(fullPath, entryZipPath);
            } else {
                zip.addFile(entryZipPath, fs.readFileSync(fullPath));
            }
        }
    };

    addDirectory(DIST_DIR, "");

    // Add .dash.js config files
    for (const configPath of dashConfigPaths) {
        const relativePath = path.relative(WIDGETS_DIR, configPath);
        zip.addFile(`configs/${relativePath}`, fs.readFileSync(configPath));
    }

    // Add dash.json
    zip.addFile("dash.json", Buffer.from(JSON.stringify(dashJson, null, 2)));

    // Write ZIP
    const zipFileName = `${packageName}-v${version}.zip`;
    const zipPath = path.join(ROOT, zipFileName);
    zip.writeZip(zipPath);

    console.log(`\nPackage created: ${zipFileName}`);
    console.log(
        `  Widgets: ${widgets.map((w) => w.name).join(", ") || "none"}`
    );
    console.log(`  Version: ${version}`);
    console.log(`  Size: ${(fs.statSync(zipPath).size / 1024).toFixed(1)} KB`);
}

main();
