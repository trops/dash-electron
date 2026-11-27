#!/usr/bin/env node
/**
 * list-tests.js (DASH-158)
 *
 * Finds every unit test file in src/, public/ and scripts/ and says which
 * runner it needs, so CI runs all of them without a hand-kept list (a list
 * once left 23 files running nowhere).
 *
 *   node scripts/list-tests.js node   → files that use node:test
 *   node scripts/list-tests.js jest   → every other *.test.{js,cjs,mjs}
 *
 * Prints one path per line, relative to the repo root. e2e/ (Playwright)
 * is not unit tests and is left out.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const ROOTS = ["src", "public", "scripts"];
const SKIP_DIRS = new Set(["node_modules", "build", "dist", ".git"]);
const TEST_FILE = /\.test\.(?:js|cjs|mjs)$/;
const USES_NODE_TEST = /["']node:test["']/;

function walk(dir, out) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_e) {
        return;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!SKIP_DIRS.has(entry.name)) walk(full, out);
        } else if (entry.isFile() && TEST_FILE.test(entry.name)) {
            out.push(full);
        }
    }
}

function listTests(root = REPO_ROOT) {
    const files = [];
    for (const r of ROOTS) walk(path.join(root, r), files);
    const node = [];
    const jest = [];
    for (const file of files.sort()) {
        const rel = path.relative(root, file).split(path.sep).join("/");
        const src = fs.readFileSync(file, "utf8");
        (USES_NODE_TEST.test(src) ? node : jest).push(rel);
    }
    return { node, jest };
}

module.exports = { listTests };

if (require.main === module) {
    const runner = process.argv[2];
    const lists = listTests();
    if (!Object.prototype.hasOwnProperty.call(lists, runner)) {
        console.error("Usage: node scripts/list-tests.js <node|jest>");
        process.exit(2);
    }
    if (lists[runner].length === 0) {
        console.error(`No ${runner} test files found.`);
        process.exit(1);
    }
    process.stdout.write(lists[runner].join("\n") + "\n");
}
