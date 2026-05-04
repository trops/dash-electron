#!/usr/bin/env node
/**
 * test-no-renderer-bundle-in-main.js
 *
 * Regression pin: `public/electron.js` (Electron main process) must
 * not `require("@trops/dash-core")` without the `/electron` subpath.
 *
 * The bare `@trops/dash-core` resolves to dash-core's renderer bundle
 * (`dist/index.js`) which transitively imports `@trops/dash-react`,
 * which assumes `window`/`document`. Loading either in the main
 * process throws at startup with `ReferenceError: window is not
 * defined`.
 *
 * Main-process code must use `@trops/dash-core/electron` (Node-safe
 * entry exposing controllers, APIs, widgetRegistry, etc.).
 *
 * Run: `node scripts/test-no-renderer-bundle-in-main.js`
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert");

const ELECTRON_JS = path.join(__dirname, "..", "public", "electron.js");

test("public/electron.js exists", () => {
    assert.ok(fs.existsSync(ELECTRON_JS), `expected ${ELECTRON_JS} to exist`);
});

test("public/electron.js does not require dash-core renderer bundle", () => {
    const src = fs.readFileSync(ELECTRON_JS, "utf8");
    // Match `require("@trops/dash-core")` exactly — closing paren must
    // come immediately after the string. Anything with a `/electron`
    // subpath (or any other subpath) is fine.
    const bareMatches =
        src.match(/require\s*\(\s*["']@trops\/dash-core["']\s*\)/g) || [];
    assert.strictEqual(
        bareMatches.length,
        0,
        `public/electron.js contains ${bareMatches.length} bare ` +
            `require("@trops/dash-core") call(s). Use ` +
            `"@trops/dash-core/electron" instead — the bare path resolves ` +
            `to the renderer bundle which assumes window/document and ` +
            `throws "ReferenceError: window is not defined" at main-process ` +
            `startup.`
    );
});
