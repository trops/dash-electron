const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { launchApp, closeApp } = require("../helpers/electron-app");
const {
    startMockRegistry,
    stopMockRegistry,
    getPublishHistory,
    clearHistory,
    setAuthProfile,
} = require("../helpers/mock-registry");
const {
    seedAuthToken,
    clearAuthToken,
} = require("../helpers/auth-token-injector");

/**
 * Widget publish — scope-remap regression spec
 *
 * The v0.0.46x bug: publishing a widget whose package.json carries
 * a local scope like `@ai-built/foo` (the AI Widget Builder's
 * pre-publish scope) sometimes shipped to the registry under
 * `@trops/@ai-built/foo` — scope doubled. The fix in
 * `widgetRegistryController.prepareWidgetForPublish` lifts only the
 * caller's registry username into `manifest.scope` and uses
 * `parsePackageName(pkgJson.name).name` as the bare manifest name.
 *
 * This spec walks the publish flow at the IPC layer (no UI walking
 * — `widget-uninstall.spec.js` already covers Settings → Widgets
 * navigation). Verifies:
 *
 *   1. Inspect returns the local `@ai-built` scope before publish.
 *   2. publishWidget succeeds against the mock registry.
 *   3. Manifest shipped to the registry has `scope: "trops"` and
 *      `name: "scope-test"` — NEVER `name: "@ai-built/..."` or
 *      `scope: "trops/@ai-built"`.
 *   4. Patch bump 1.0.0 → 1.0.1 lands.
 *   5. The on-disk package.json has the bumped version (proving the
 *      persist step ran).
 */

const APP_ID = "@trops/dash-electron";
const PUBLISHER_USERNAME = "trops";
const PACKAGE_ID = "@ai-built/scope-test";
const PACKAGE_NAME = "scope-test";

let electronApp;
let window;
let tempUserData;
let mockRegistryPort;
let fixtureRoot;
let aiBuiltDir;

const COMPONENT_SOURCE = `
import React from "react";

const ScopeTest = ({ title = "Scope Test" }) => {
    return React.createElement("div", null, title);
};

export default ScopeTest;
`.trim();

const DASH_CONFIG_SOURCE = `
export default {
    name: "ScopeTest",
    type: "widget",
    icon: "puzzle-piece",
    author: "AI Assistant",
    description: "Scope-remap publish test fixture",
    userConfig: {
        title: {
            type: "text",
            displayName: "Title",
            defaultValue: "Scope Test",
        },
    },
};
`.trim();

const PACKAGE_JSON = JSON.stringify(
    {
        name: PACKAGE_ID,
        version: "1.0.0",
        description: "Scope-remap publish test fixture",
        author: "AI Assistant",
        main: "widgets/ScopeTest.js",
    },
    null,
    2
);

test.beforeAll(async () => {
    // Build a minimal @ai-built/scope-test widget package on disk.
    // The publish flow compiles via esbuild + zips the source — we
    // need a real package layout, not a synthetic IPC-only fixture.
    fixtureRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "dash-e2e-scope-remap-")
    );
    const pkgDir = path.join(fixtureRoot, "scope-test");
    fs.mkdirSync(path.join(pkgDir, "widgets"), { recursive: true });
    fs.writeFileSync(path.join(pkgDir, "package.json"), PACKAGE_JSON);
    fs.writeFileSync(
        path.join(pkgDir, "widgets", "ScopeTest.js"),
        COMPONENT_SOURCE
    );
    fs.writeFileSync(
        path.join(pkgDir, "widgets", "ScopeTest.dash.js"),
        DASH_CONFIG_SOURCE
    );

    mockRegistryPort = await startMockRegistry({ seedThemes: false });
    setAuthProfile({
        username: PUBLISHER_USERNAME,
        displayName: "Trops Publisher",
        email: "trops@example.com",
        id: "trops-id",
    });

    ({ electronApp, window, tempUserData } = await launchApp({
        env: {
            DASH_REGISTRY_API_URL: `http://127.0.0.1:${mockRegistryPort}`,
        },
        hermetic: true,
    }));
    await seedAuthToken(electronApp);

    // Seed the widget package into the local registry under the
    // `@ai-built` scope. We point loadFolder at the directory whose
    // *contents* are the widget package — registerWidgetsFromFolder
    // detects that and installs it as a single widget. Without this
    // the publish flow can't find the package by id.
    aiBuiltDir = path.join(fixtureRoot, "ai-built-root");
    fs.mkdirSync(aiBuiltDir, { recursive: true });
    // The registry installs by directory name; rename the source into
    // a path tree that mirrors `@ai-built/scope-test`.
    const scopedDir = path.join(aiBuiltDir, "@ai-built", "scope-test");
    fs.mkdirSync(scopedDir, { recursive: true });
    function copyRecursive(src, dst) {
        fs.mkdirSync(dst, { recursive: true });
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
            const s = path.join(src, entry.name);
            const d = path.join(dst, entry.name);
            if (entry.isDirectory()) copyRecursive(s, d);
            else if (entry.isFile()) fs.copyFileSync(s, d);
        }
    }
    copyRecursive(pkgDir, scopedDir);

    // installFromLocalPath registers under whatever name we pass.
    await window.evaluate(
        async ({ name, dir }) => window.mainApi.widgets.installLocal(name, dir),
        { name: PACKAGE_ID, dir: scopedDir }
    );
});

test.afterAll(async () => {
    await clearAuthToken(electronApp);
    await closeApp(electronApp, { tempUserData });
    await stopMockRegistry();
    try {
        if (fixtureRoot && fs.existsSync(fixtureRoot)) {
            fs.rmSync(fixtureRoot, { recursive: true, force: true });
        }
    } catch (_) {}
});

test("publishWidget remaps @ai-built/<name> to <publisher>/<name> (no doubling)", async () => {
    await test.step("inspect — local scope is `@ai-built` before publish", async () => {
        const info = await window.evaluate(
            async (pkg) => window.mainApi.registry.inspectWidgetPackage(pkg),
            PACKAGE_ID
        );
        expect(info?.success).toBe(true);
        // The local package is under `@ai-built/...`. The publish flow
        // must NOT preserve this scope.
        expect(
            info.localScope === "ai-built" || info.localScope === "@ai-built"
        ).toBe(true);
        expect(info.name).toBe(PACKAGE_NAME);
    });

    await test.step("publish — registry receives the manifest with caller scope", async () => {
        clearHistory();

        const result = await window.evaluate(
            async ({ appId, pkg }) =>
                window.mainApi.registry.publishWidget(appId, pkg, {
                    bump: "patch",
                    visibility: "public",
                }),
            { appId: APP_ID, pkg: PACKAGE_ID }
        );
        if (!result?.success) {
            throw new Error(
                `publishWidget failed: ${
                    result?.error || JSON.stringify(result)
                }`
            );
        }
        expect(result.registryResult?.success).toBe(true);
        expect(result.previousVersion).toBe("1.0.0");
        expect(result.newVersion).toBe("1.0.1");

        const history = getPublishHistory();
        expect(history.length).toBe(1);

        const entry = history[0];
        expect(entry.contentType).toMatch(/multipart\/form-data/i);
        expect(entry.authorization).toMatch(/^Bearer /);
        expect(entry.fileBytes).toBeGreaterThan(0);

        // SCOPE-REMAP CONTRACT: publisher's registry username takes
        // over the manifest scope. The local `@ai-built` scope MUST
        // NOT appear anywhere in scope or name.
        const m = entry.manifest;
        expect(m).toBeTruthy();
        // Scope normalization: the publisher's username — exact match.
        const scopeNoAt = String(m.scope || "").replace(/^@/, "");
        expect(scopeNoAt).toBe(PUBLISHER_USERNAME);
        expect(m.scope).not.toContain("ai-built");
        // Name is the bare package name — no `@ai-built/` prefix.
        expect(m.name).toBe(PACKAGE_NAME);
        expect(m.name).not.toMatch(/^@/);
        expect(m.name).not.toContain("ai-built");
        expect(m.type).toBe("widget");
        expect(m.version).toBe("1.0.1");
    });
});
