#!/usr/bin/env node

/**
 * migrateWidgetKeys.js
 *
 * Migrates dashboard workspace layouts from old widget key formats
 * (unscoped names, _default suffix) to canonical scoped IDs
 * (e.g., "trops.algolia.AlgoliaDirectSearchWidget").
 *
 * Reads installed widget .dash.js configs to build the mapping automatically.
 *
 * Usage:
 *   node scripts/migrateWidgetKeys.js --dry-run   # Preview changes
 *   node scripts/migrateWidgetKeys.js              # Apply changes
 */

const fs = require("fs");
const path = require("path");
const { getUserDataDir } = require("./lib/userDataDir");

const USER_DATA = getUserDataDir();
const WIDGETS_DIR = path.join(USER_DATA, "widgets");
const WORKSPACES_FILE = path.join(
    USER_DATA,
    "Dashboard",
    "@trops",
    "dash-electron",
    "workspaces.json"
);

const isDryRun = process.argv.includes("--dry-run");

/**
 * Parse .dash.js files to extract id and name fields via regex.
 * These are ESM files with imports, so we can't require() them.
 */
function parseDashConfig(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    const idMatch = content.match(/id:\s*["']([^"']+)["']/);
    const nameMatch = content.match(/name:\s*["']([^"']+)["']/);
    return {
        id: idMatch ? idMatch[1] : null,
        name: nameMatch ? nameMatch[1] : null,
    };
}

/**
 * Scan all installed widget packages and build a mapping from
 * old keys to canonical scoped IDs.
 */
function buildKeyMapping() {
    const mapping = {};

    // Scan @scope/package directories
    const scopeDirs = fs.readdirSync(WIDGETS_DIR).filter((d) => {
        return (
            d.startsWith("@") &&
            fs.statSync(path.join(WIDGETS_DIR, d)).isDirectory()
        );
    });

    for (const scopeDir of scopeDirs) {
        const scopePath = path.join(WIDGETS_DIR, scopeDir);
        const packages = fs.readdirSync(scopePath).filter((d) => {
            return fs.statSync(path.join(scopePath, d)).isDirectory();
        });

        for (const pkg of packages) {
            const configsDir = path.join(scopePath, pkg, "configs", "widgets");
            if (!fs.existsSync(configsDir)) continue;

            const dashFiles = fs
                .readdirSync(configsDir)
                .filter((f) => f.endsWith(".dash.js"));

            for (const dashFile of dashFiles) {
                const config = parseDashConfig(path.join(configsDir, dashFile));
                if (!config.id || !config.name) continue;

                // Map plain name → scoped ID
                mapping[config.name] = config.id;

                // Map name_default → scoped ID (legacy local registration artifact)
                mapping[config.name + "_default"] = config.id;
            }
        }
    }

    // Also scan unscoped package directories (e.g., "chat", "slack")
    const unscopedDirs = fs.readdirSync(WIDGETS_DIR).filter((d) => {
        return (
            !d.startsWith("@") &&
            d !== "registry.json" &&
            fs.statSync(path.join(WIDGETS_DIR, d)).isDirectory()
        );
    });

    for (const pkg of unscopedDirs) {
        const configsDir = path.join(WIDGETS_DIR, pkg, "configs", "widgets");
        if (!fs.existsSync(configsDir)) continue;

        const dashFiles = fs
            .readdirSync(configsDir)
            .filter((f) => f.endsWith(".dash.js"));

        for (const dashFile of dashFiles) {
            const config = parseDashConfig(path.join(configsDir, dashFile));
            if (!config.id || !config.name) continue;

            mapping[config.name] = config.id;
            mapping[config.name + "_default"] = config.id;
        }
    }

    // Add known legacy aliases that don't follow the naming convention
    // (e.g., "SampleSlackWidget" was the old name for "SlackWidget")
    const legacyAliases = {
        SampleSlackWidget: mapping["SlackWidget"],
        SampleGmailWidget: mapping["GmailWidget"],
        ChatWidget: mapping["ChatClaudeCodeWidget"],
    };

    for (const [alias, scopedId] of Object.entries(legacyAliases)) {
        if (scopedId) mapping[alias] = scopedId;
    }

    return mapping;
}

/**
 * Migrate a single workspace's layout.
 * Returns the count of keys replaced.
 */
function migrateLayout(layout, mapping) {
    let count = 0;
    if (!Array.isArray(layout)) return count;

    for (const item of layout) {
        if (item.component && mapping[item.component]) {
            const oldKey = item.component;
            const newKey = mapping[oldKey];
            item.component = newKey;
            count++;
            console.log(`    ${oldKey} → ${newKey}`);
        }
        if (Array.isArray(item.children)) {
            count += migrateLayout(item.children, mapping);
        }
    }
    return count;
}

function main() {
    if (!fs.existsSync(WORKSPACES_FILE)) {
        console.error(`Error: Workspaces file not found at ${WORKSPACES_FILE}`);
        process.exit(1);
    }

    console.log("Building widget key mapping from installed packages...\n");
    const mapping = buildKeyMapping();

    const sortedKeys = Object.keys(mapping).sort();
    console.log(`Found ${sortedKeys.length} key mappings:\n`);
    for (const key of sortedKeys) {
        console.log(`  ${key} → ${mapping[key]}`);
    }

    console.log("\n--- Migrating workspaces ---\n");

    const workspaces = JSON.parse(fs.readFileSync(WORKSPACES_FILE, "utf8"));
    let totalChanges = 0;

    for (const wsKey of Object.keys(workspaces)) {
        const ws = workspaces[wsKey];
        const name = ws.name || `(workspace ${wsKey})`;
        console.log(`Workspace ${wsKey}: "${name}"`);

        const changes = migrateLayout(ws.layout || [], mapping);
        if (changes === 0) {
            console.log("  (no changes needed)");
        }
        totalChanges += changes;
    }

    console.log(`\n--- Summary ---`);
    console.log(`Total replacements: ${totalChanges}`);

    if (isDryRun) {
        console.log("\n[Dry run] No files modified.");
    } else if (totalChanges > 0) {
        // Backup the original file
        const backupPath = WORKSPACES_FILE + ".bak";
        fs.copyFileSync(WORKSPACES_FILE, backupPath);
        console.log(`\nBackup: ${backupPath}`);

        fs.writeFileSync(WORKSPACES_FILE, JSON.stringify(workspaces, null, 2));
        console.log(`Updated: ${WORKSPACES_FILE}`);
        console.log("\nRestart the app to see the changes.");
    } else {
        console.log("\nNothing to migrate.");
    }
}

main();
