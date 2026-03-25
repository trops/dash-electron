#!/usr/bin/env node

/**
 * reinstallWidgets.js
 *
 * Re-downloads all installed widget packages from the registry to refresh
 * cached dash.json metadata. Preserves the registry.json structure but
 * replaces on-disk files with fresh downloads.
 *
 * Usage:
 *   node scripts/reinstallWidgets.js
 *   node scripts/reinstallWidgets.js --dry-run   # Preview without downloading
 */

const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");
const { authenticate } = require("./lib/registryAuth");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const REGISTRY_BASE_URL =
    process.env.DASH_REGISTRY_API_URL ||
    "https://main.d919rwhuzp7rj.amplifyapp.com";

const WIDGETS_DIR = path.join(
    process.env.HOME,
    "Library/Application Support/Dash/widgets"
);
const REGISTRY_FILE = path.join(WIDGETS_DIR, "registry.json");

const isDryRun = process.argv.includes("--dry-run");

async function downloadPackage(token, scopedId, widgetPath) {
    // Parse @scope/name from the scoped ID
    const match = scopedId.match(/^@([^/]+)\/(.+)$/);
    if (!match) {
        console.error(`  Skipping ${scopedId} — not a scoped package ID`);
        return false;
    }

    const [, scope, name] = match;
    const downloadUrl = `${REGISTRY_BASE_URL}/api/packages/${scope}/${name}/download`;

    const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
        console.error(`  Download failed for ${scopedId}: HTTP ${res.status}`);
        return false;
    }

    let buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "";

    // Registry returns JSON with a pre-signed S3 URL
    if (contentType.includes("application/json")) {
        const jsonData = JSON.parse(buffer.toString("utf-8"));
        if (jsonData.error) {
            console.error(`  Download failed: ${jsonData.error}`);
            return false;
        }
        if (jsonData.downloadUrl) {
            const zipRes = await fetch(jsonData.downloadUrl);
            if (!zipRes.ok) {
                console.error(`  ZIP download failed: HTTP ${zipRes.status}`);
                return false;
            }
            buffer = Buffer.from(await zipRes.arrayBuffer());
        }
    }

    if (buffer.length === 0) {
        console.error(`  Empty download for ${scopedId}`);
        return false;
    }

    // Clear existing directory and extract fresh
    if (fs.existsSync(widgetPath)) {
        fs.rmSync(widgetPath, { recursive: true });
    }
    fs.mkdirSync(widgetPath, { recursive: true });

    const zip = new AdmZip(buffer);
    zip.extractAllTo(widgetPath, true);

    return true;
}

async function main() {
    if (!fs.existsSync(REGISTRY_FILE)) {
        console.error(`Error: Registry file not found at ${REGISTRY_FILE}`);
        process.exit(1);
    }

    const registryData = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
    const entries = registryData.widgets || [];

    // Filter to scoped packages only (registry-installed, not local folders)
    const packages = entries.filter(([key]) => key.startsWith("@"));

    console.log(`Found ${packages.length} installed registry package(s):\n`);
    for (const [key, entry] of packages) {
        console.log(`  ${key} (v${entry.version || "?"})`);
    }

    if (isDryRun) {
        console.log(
            `\n[Dry run] Would re-download ${packages.length} package(s). No changes made.`
        );
        return;
    }

    if (packages.length === 0) {
        console.log("Nothing to reinstall.");
        return;
    }

    const token = await authenticate(REGISTRY_BASE_URL);

    let succeeded = 0;
    let failed = 0;

    for (const [key, entry] of packages) {
        console.log(`\nReinstalling ${key}...`);
        const widgetPath = path.join(WIDGETS_DIR, ...key.split("/"));
        const ok = await downloadPackage(token, key, widgetPath);

        if (ok) {
            console.log(`  OK — extracted to ${widgetPath}`);
            succeeded++;
        } else {
            failed++;
        }
    }

    console.log(`\n── Summary ──`);
    console.log(`Reinstalled: ${succeeded}/${packages.length}`);
    if (failed > 0) {
        console.log(`Failed: ${failed}`);
    }
    console.log("\nRestart the app to pick up the refreshed metadata.");
}

main().catch((err) => {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
});
