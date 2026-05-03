#!/usr/bin/env node
/**
 * Pin: Electron must be at >= 39.8.9.
 *
 * Why: 39.6.1 (the prior pin) is exposed to ~18 HIGH-severity advisories
 * patched between 39.6.2 and 39.8.9, including:
 *   - Context Isolation bypass via contextBridge VideoFrame transfer
 *   - AppleScript injection in app.moveToApplicationsFolder on macOS
 *   - Use-after-free in WebContents permission callbacks
 *   - HTTP Response Header Injection in custom protocol handlers
 *   - Service worker can spoof executeJavaScript IPC replies
 *   - Renderer command-line switch injection
 *   (full list: github.com/electron/electron security advisories for 39.x)
 *
 * The pin enforces:
 *   1. devDependencies.electron range allows >= 39.8.9.
 *   2. The actual resolved version in package-lock.json is >= 39.8.9
 *      (a transitive resolution couldn't drag us back to a vulnerable
 *      patch).
 *
 * Pure JSON read — no network, no install.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")
);
const lock = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "package-lock.json"), "utf8")
);

const minRequired = "39.8.9";

function semverGte(a, b) {
    const [aMajor, aMinor, aPatch] = a.split(".").map(Number);
    const [bMajor, bMinor, bPatch] = b.split(".").map(Number);
    if (aMajor !== bMajor) return aMajor > bMajor;
    if (aMinor !== bMinor) return aMinor > bMinor;
    return aPatch >= bPatch;
}

// 1. devDependencies range floor.
const range = pkg?.devDependencies?.electron;
assert.ok(
    typeof range === "string" && range.length > 0,
    `electron must be in devDependencies. Got: ${range}`
);

// Strip range prefix (^, ~, >=, v) for floor check.
const rangeFloor = range.replace(/^[^\d]*/, "");
assert.ok(
    semverGte(rangeFloor, minRequired),
    `package.json devDependencies.electron range floor must be >= ${minRequired} (HIGH security advisories patched). Got: "${range}"`
);

// 2. Actual resolved version in package-lock.json.
const lockEntry = lock?.packages?.["node_modules/electron"];
assert.ok(
    lockEntry && typeof lockEntry.version === "string",
    `package-lock.json must record an "node_modules/electron" entry with a version`
);
assert.ok(
    semverGte(lockEntry.version, minRequired),
    `package-lock.json electron version must be >= ${minRequired}. Got: ${lockEntry.version}`
);

console.log(
    `PASS  electron pinned at ${lockEntry.version} (range "${range}", floor >= ${minRequired}, HIGH advisories patched)`
);
