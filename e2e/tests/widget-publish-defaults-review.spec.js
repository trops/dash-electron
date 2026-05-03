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
 * Widget publish — defaults-review regression spec (v0.0.46x)
 *
 * The PublishWidgetModal's "Verify defaults" step lets a publisher
 * review every `userConfig[field].defaultValue` baked into a widget
 * before the ZIP ships, and optionally blank/edit values that
 * leaked from the publisher's local config (e.g. an API key from
 * the publisher's own account).
 *
 * Two IPCs power that step:
 *
 *   - `registry.scanWidgetDefaults(packageId)` — returns the
 *     `[{ widgetName, field, currentDefault, ... }]` list.
 *   - `registry.publishWidget(appId, packageId, { defaultsOverride })`
 *     — stages a COPY of the package under os.tmpdir(), rewrites
 *     the targeted defaults there, zips the staged dir. Source on
 *     the publisher's machine stays untouched.
 *
 * This spec pins three contracts:
 *
 *   1. scanWidgetDefaults surfaces the leaked default value before
 *      publish.
 *   2. publishWidget with defaultsOverride succeeds against the
 *      mock registry.
 *   3. After publish, scanWidgetDefaults still returns the ORIGINAL
 *      value — proving the override path didn't mutate the
 *      publisher's source files.
 *
 * If staging regresses to in-place rewrites, every publisher's
 * source on disk gets rewritten on each publish — which the QA plan
 * flags as a "must revalidate every release" surface.
 */

const APP_ID = "@trops/dash-electron";
const PUBLISHER_USERNAME = "trops";
const PACKAGE_ID = "@ai-built/defaults-review-test";
const PACKAGE_NAME = "defaults-review-test";

const COMPONENT_SOURCE = `
import React from "react";

const DefaultsReviewTest = ({ apiKey = "" }) => {
    return React.createElement("div", null, "ok");
};

export default DefaultsReviewTest;
`.trim();

const DASH_CONFIG_SOURCE = `
export default {
    name: "DefaultsReviewTest",
    type: "widget",
    icon: "puzzle-piece",
    author: "AI Assistant",
    description: "Defaults-review publish test fixture",
    userConfig: {
        apiKey: {
            type: "text",
            displayName: "API Key",
            defaultValue: "PERSONAL-SECRET-123",
            instructions: "Your personal API key — should be blanked on publish",
        },
        title: {
            type: "text",
            displayName: "Title",
            defaultValue: "Defaults Review",
        },
    },
};
`.trim();

const PACKAGE_JSON = JSON.stringify(
    {
        name: PACKAGE_ID,
        version: "1.0.0",
        description: "Defaults-review publish test fixture",
        author: "AI Assistant",
        main: "widgets/DefaultsReviewTest.js",
    },
    null,
    2
);

let electronApp;
let window;
let tempUserData;
let mockRegistryPort;
let fixtureRoot;
let installedPath;

test.beforeAll(async () => {
    fixtureRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "dash-e2e-defaults-review-")
    );
    installedPath = path.join(
        fixtureRoot,
        "scope-tree",
        "@ai-built",
        PACKAGE_NAME
    );
    fs.mkdirSync(path.join(installedPath, "widgets"), { recursive: true });
    fs.writeFileSync(path.join(installedPath, "package.json"), PACKAGE_JSON);
    fs.writeFileSync(
        path.join(installedPath, "widgets", "DefaultsReviewTest.js"),
        COMPONENT_SOURCE
    );
    fs.writeFileSync(
        path.join(installedPath, "widgets", "DefaultsReviewTest.dash.js"),
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

    await window.evaluate(
        async ({ name, dir }) => window.mainApi.widgets.installLocal(name, dir),
        { name: PACKAGE_ID, dir: installedPath }
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

test("defaults-review: scan + publish-with-override leaves source untouched", async () => {
    await test.step("scanWidgetDefaults surfaces the leaked default", async () => {
        const result = await window.evaluate(
            async (pkg) => window.mainApi.registry.scanWidgetDefaults(pkg),
            PACKAGE_ID
        );
        expect(result?.success).toBe(true);
        expect(Array.isArray(result.defaults)).toBe(true);

        const apiKeyEntry = result.defaults.find((d) => d.field === "apiKey");
        expect(apiKeyEntry).toBeTruthy();
        expect(apiKeyEntry.widgetName).toBe("DefaultsReviewTest");
        expect(apiKeyEntry.currentDefault).toBe("PERSONAL-SECRET-123");
        expect(apiKeyEntry.displayName).toBe("API Key");
        // The non-empty `title` default surfaces too. Empty / nullish
        // defaults are filtered out by the scan; we'd only see entries
        // that need publisher review.
        const titleEntry = result.defaults.find((d) => d.field === "title");
        expect(titleEntry?.currentDefault).toBe("Defaults Review");
    });

    await test.step("publishWidget with defaultsOverride succeeds", async () => {
        clearHistory();

        const result = await window.evaluate(
            async ({ appId, pkg }) =>
                window.mainApi.registry.publishWidget(appId, pkg, {
                    bump: "patch",
                    visibility: "public",
                    // Blank the leaked API key for the published copy.
                    defaultsOverride: {
                        DefaultsReviewTest: {
                            apiKey: "",
                        },
                    },
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

        const history = getPublishHistory();
        expect(history.length).toBe(1);
        // Manifest still ships under the publisher's scope (covered
        // separately by widget-publish-scope-remap.spec.js); just
        // verify a manifest landed.
        expect(history[0].manifest?.name).toBe(PACKAGE_NAME);
    });

    await test.step("source on disk is untouched after publish-with-override", async () => {
        // The override path stages a COPY under os.tmpdir() and rewrites
        // there. The publisher's source files MUST remain unchanged —
        // a regression to in-place rewrite would leak the override into
        // every subsequent build of the package.
        const dashJsAfter = fs.readFileSync(
            path.join(installedPath, "widgets", "DefaultsReviewTest.dash.js"),
            "utf8"
        );
        expect(dashJsAfter).toContain('defaultValue: "PERSONAL-SECRET-123"');

        // And scanWidgetDefaults still surfaces the original value.
        const rescan = await window.evaluate(
            async (pkg) => window.mainApi.registry.scanWidgetDefaults(pkg),
            PACKAGE_ID
        );
        const apiKeyAfter = rescan.defaults.find((d) => d.field === "apiKey");
        expect(apiKeyAfter?.currentDefault).toBe("PERSONAL-SECRET-123");
    });
});
