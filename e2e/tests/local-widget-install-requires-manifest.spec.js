const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Local widget install — manifest requirement — Phase 5B pin (P1 #11).
 *
 * `installFromLocalPath` now requires a structured manifest (via
 * dash-core/electron/utils/widgetManifest.js#loadWidgetManifest). The
 * carrier is either `dash.json` (preferred) or a `dash` block inside
 * `package.json`. Required fields: name (kebab/scoped), version
 * (semver), entry (relative, no `..`). `declaredProviders` is required
 * for Phase 5C consumption but treated as a deprecation warning today
 * — missing field doesn't block install (one-release grace).
 *
 * This spec pins three rejection cases + two accept cases that prove
 * the gate is tight without breaking the existing widget corpus.
 */

let electronApp;
let window;
let tempUserData;
let fixtureRoot;

const COMPONENT_SOURCE = `
import React from "react";
const Widget = () => React.createElement("div", null, "x");
export default Widget;
`.trim();

const DASH_CONFIG = `
export default { name: "ManifestFixture", type: "widget" };
`.trim();

function writeFixture(name, files) {
    const pkgDir = path.join(fixtureRoot, name);
    fs.mkdirSync(path.join(pkgDir, "widgets"), { recursive: true });
    fs.writeFileSync(
        path.join(pkgDir, "widgets", "ManifestFixture.js"),
        COMPONENT_SOURCE
    );
    fs.writeFileSync(
        path.join(pkgDir, "widgets", "ManifestFixture.dash.js"),
        DASH_CONFIG
    );
    for (const [file, content] of Object.entries(files)) {
        fs.writeFileSync(
            path.join(pkgDir, file),
            typeof content === "string"
                ? content
                : JSON.stringify(content, null, 2)
        );
    }
    return pkgDir;
}

async function tryInstall(name, pkgDir) {
    return window.evaluate(
        async ({ n, d }) => {
            try {
                await window.mainApi.widgets.installLocal(n, d);
                return { ok: true };
            } catch (err) {
                return { ok: false, message: err?.message || String(err) };
            }
        },
        { n: name, d: pkgDir }
    );
}

test.beforeAll(async () => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dash-e2e-manifest-"));
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
    try {
        if (fixtureRoot && fs.existsSync(fixtureRoot)) {
            fs.rmSync(fixtureRoot, { recursive: true, force: true });
        }
    } catch (_) {}
});

test("install rejected for folder with neither dash.json nor package.json", async () => {
    // Bare folder with widget files but no manifest carrier.
    const pkgDir = writeFixture("no-manifest", {});
    const result = await tryInstall("no-manifest", pkgDir);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/dash\.json or package\.json|manifest/i);
});

test("install rejected for dash.json missing version", async () => {
    const pkgDir = writeFixture("no-version", {
        "dash.json": { name: "no-version" },
    });
    const result = await tryInstall("no-version", pkgDir);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/version/i);
});

test("install rejected for dash.json with invalid name", async () => {
    const pkgDir = writeFixture("invalid-name-shape", {
        "dash.json": {
            name: "Has Spaces And Caps",
            version: "1.0.0",
        },
    });
    const result = await tryInstall("invalid-name-shape", pkgDir);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/name/i);
});

test("install accepts dash.json with required fields", async () => {
    const pkgDir = writeFixture("good-manifest", {
        "dash.json": {
            name: "good-manifest",
            version: "1.0.0",
            declaredProviders: [],
        },
    });
    const result = await tryInstall("good-manifest", pkgDir);
    expect(
        result.ok,
        `install of well-formed widget failed: ${result.message}`
    ).toBe(true);
});

test("install accepts package.json with top-level name/version (existing corpus shape)", async () => {
    // This is the shape every @ai-built/* and @trops/* widget already
    // ships today — no dash.json, just a regular npm-style
    // package.json. The Phase 5B gate must NOT reject these.
    const pkgDir = writeFixture("corpus-shape", {
        "package.json": {
            name: "corpus-shape",
            version: "0.2.1",
            description: "back-compat shape",
            author: "e2e",
        },
    });
    const result = await tryInstall("corpus-shape", pkgDir);
    expect(
        result.ok,
        `install of existing-corpus shape failed: ${result.message}`
    ).toBe(true);
});
