const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * widget-install path traversal — Phase 5B pin (P1 #11).
 *
 * `installFromLocalPath` previously called `fs.cpSync(src, dst,
 * {recursive: true})` on a user-selected folder without any
 * containment check. If the folder contained a symlink pointing
 * outside the source root (e.g. `secrets -> /etc`), cpSync followed
 * it and copied the linked content into the userData widgets cache.
 *
 * Phase 5B adds `walkSourceContainment` (dash-core/electron/utils/
 * widgetManifest.js) which realpath-resolves every entry and rejects
 * any path that escapes the source root. This spec creates such a
 * malicious folder and asserts install fails with a containment
 * error.
 */

let electronApp;
let window;
let tempUserData;
let fixtureRoot;
let escapeTarget;

const PACKAGE_JSON = JSON.stringify(
    {
        name: "path-traversal-fixture",
        version: "1.0.0",
        description: "Phase 5B path-traversal fixture",
        author: "e2e",
    },
    null,
    2
);

const COMPONENT_SOURCE = `
import React from "react";
const Widget = () => React.createElement("div", null, "x");
export default Widget;
`.trim();

const DASH_CONFIG_SOURCE = `
export default {
    name: "PathTraversalFixture",
    type: "widget",
};
`.trim();

test.beforeAll(async () => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dash-e2e-traversal-"));
    escapeTarget = fs.mkdtempSync(
        path.join(os.tmpdir(), "dash-e2e-traversal-escape-")
    );
    // Drop a marker file in the escape target so the install would
    // visibly siphon real content if containment failed.
    fs.writeFileSync(path.join(escapeTarget, "secret.txt"), "sensitive");

    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
    for (const dir of [fixtureRoot, escapeTarget]) {
        try {
            if (dir && fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        } catch (_) {}
    }
});

test("install rejected for source folder with symlink escaping the root", async () => {
    const pkgDir = path.join(fixtureRoot, "path-traversal-fixture");
    fs.mkdirSync(path.join(pkgDir, "widgets"), { recursive: true });
    fs.writeFileSync(path.join(pkgDir, "package.json"), PACKAGE_JSON);
    fs.writeFileSync(
        path.join(pkgDir, "widgets", "PathTraversalFixture.js"),
        COMPONENT_SOURCE
    );
    fs.writeFileSync(
        path.join(pkgDir, "widgets", "PathTraversalFixture.dash.js"),
        DASH_CONFIG_SOURCE
    );
    // Symlink pointing outside the source folder.
    fs.symlinkSync(escapeTarget, path.join(pkgDir, "leak"));

    const result = await window.evaluate(
        async ({ n, d }) => {
            try {
                await window.mainApi.widgets.installLocal(n, d);
                return { ok: true };
            } catch (err) {
                return { ok: false, message: err?.message || String(err) };
            }
        },
        { n: "path-traversal-fixture", d: pkgDir }
    );
    expect(
        result.ok,
        "install with a symlink-escape should have been rejected"
    ).toBe(false);
    expect(result.message).toMatch(/not within any allowed root|containment/i);
});

test("install accepts source folder with a symlink staying inside the root", async () => {
    const pkgDir = path.join(fixtureRoot, "internal-symlink-fixture");
    fs.mkdirSync(path.join(pkgDir, "widgets"), { recursive: true });
    fs.writeFileSync(
        path.join(pkgDir, "package.json"),
        JSON.stringify(
            {
                name: "internal-symlink-fixture",
                version: "1.0.0",
                description: "internal symlink",
                author: "e2e",
            },
            null,
            2
        )
    );
    fs.writeFileSync(
        path.join(pkgDir, "widgets", "InternalSymlinkFixture.js"),
        COMPONENT_SOURCE
    );
    fs.writeFileSync(
        path.join(pkgDir, "widgets", "InternalSymlinkFixture.dash.js"),
        `export default { name: "InternalSymlinkFixture", type: "widget" };`
    );
    fs.mkdirSync(path.join(pkgDir, "real"));
    fs.writeFileSync(path.join(pkgDir, "real", "data.txt"), "ok");
    // Symlink pointing INSIDE the source folder — must be accepted.
    fs.symlinkSync(
        path.join(pkgDir, "real"),
        path.join(pkgDir, "internal-link")
    );

    const result = await window.evaluate(
        async ({ n, d }) => {
            try {
                await window.mainApi.widgets.installLocal(n, d);
                return { ok: true };
            } catch (err) {
                return { ok: false, message: err?.message || String(err) };
            }
        },
        { n: "internal-symlink-fixture", d: pkgDir }
    );
    expect(
        result.ok,
        `install with internal-only symlink failed: ${result.message}`
    ).toBe(true);
});
