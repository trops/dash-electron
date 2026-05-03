const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { launchApp, closeApp } = require("../helpers/electron-app");
const {
    overrideSaveDialog,
    restoreFileDialogs,
} = require("../helpers/file-dialog-override");
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
 * Theme publish — IPC pipeline + manifest contract
 *
 * Pairs with `registry-theme-install.spec.js`. That spec covers the
 * download/install half; this one covers the publish half:
 *
 *   1. mainApi.themes.publishTheme reads the theme + auth profile,
 *      generates a manifest, writes a zip, and POSTs to /api/publish.
 *   2. Mock-registry parses the multipart manifest field. The shape
 *      we assert on covers the scope-remap surface (publisher's
 *      registry username → manifest scope, theme key → manifest name)
 *      and the v0.0.46x "always 1.0.0" regression
 *      (publishes-without-bump silently overwrote the registry
 *      record; resolveNextVersion now bumps).
 *   3. After a successful publish, the theme on disk gains the
 *      bumped version + `_registryMeta.packageName` so the next
 *      publish picks up where we left off (dash-core v0.1.477 fix
 *      to the `saveThemeForApplication` call signature).
 */

const APP_ID = "@trops/dash-electron";
const PUBLISHER_USERNAME = "trops";
const THEME_KEY = "publish-test-theme";

let electronApp;
let window;
let tempUserData;
let mockRegistryPort;
let zipPath;

test.beforeAll(async () => {
    mockRegistryPort = await startMockRegistry({ seedThemes: false });
    setAuthProfile({
        username: PUBLISHER_USERNAME,
        displayName: "Trops Publisher",
        email: "trops@example.com",
        id: "trops-id",
    });

    zipPath = path.join(
        os.tmpdir(),
        `dash-e2e-theme-publish-${Date.now()}.zip`
    );

    ({ electronApp, window, tempUserData } = await launchApp({
        env: {
            DASH_REGISTRY_API_URL: `http://127.0.0.1:${mockRegistryPort}`,
        },
        hermetic: true,
    }));
    await seedAuthToken(electronApp);
    await overrideSaveDialog(electronApp, { filePath: zipPath });

    // Seed a theme on disk so the publish flow has something to read.
    const themeData = {
        name: "Publish Test Theme",
        primary: "sky",
        secondary: "slate",
        tertiary: "blue",
        colors: {
            primary: "#0ea5e9",
            secondary: "#64748b",
            tertiary: "#3b82f6",
            neutral: "#334155",
        },
        mode: "dark",
        fontFamily: "Inter, sans-serif",
        version: "1.0.0",
    };
    const r = await window.evaluate(
        async ({ appId, key, data }) =>
            window.mainApi.themes.saveThemeForApplication(appId, key, data),
        { appId: APP_ID, key: THEME_KEY, data: themeData }
    );
    if (!r?.success) {
        throw new Error(`Seed theme failed: ${r?.message || "unknown"}`);
    }
});

test.afterAll(async () => {
    await restoreFileDialogs(electronApp);
    await clearAuthToken(electronApp);
    await closeApp(electronApp, { tempUserData });
    await stopMockRegistry();
    try {
        if (zipPath && fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    } catch (_) {}
});

test("publishTheme writes a zip, POSTs the manifest, and persists registry meta on disk", async () => {
    clearHistory();

    const result = await window.evaluate(
        async ({ appId, key }) =>
            window.mainApi.themes.publishTheme(appId, key, {
                description: "E2E publish test",
                tags: ["test"],
                bump: "patch",
            }),
        { appId: APP_ID, key: THEME_KEY }
    );

    if (!result?.success) {
        throw new Error(
            `publishTheme failed: ${result?.error || JSON.stringify(result)}`
        );
    }
    expect(result.registryResult?.success).toBe(true);

    await test.step("zip landed at the overridden save path", async () => {
        expect(fs.existsSync(zipPath)).toBe(true);
        const stat = fs.statSync(zipPath);
        expect(stat.size).toBeGreaterThan(0);
    });

    await test.step("mock-registry received the publish with the right manifest", async () => {
        const history = getPublishHistory();
        expect(history.length).toBe(1);

        const entry = history[0];
        expect(entry.contentType).toMatch(/multipart\/form-data/i);
        expect(entry.authorization).toMatch(/^Bearer /);
        expect(entry.fileBytes).toBeGreaterThan(0);

        // Scope comes from /api/auth/me's username — proves the
        // publisher-identity loop is wired up. Name is the
        // sanitized theme key.
        expect(entry.manifest.scope).toBe(PUBLISHER_USERNAME);
        expect(entry.manifest.type).toBe("theme");
        expect(entry.manifest.name).toBeTruthy();
        expect(entry.manifest.name).not.toMatch(/^@/); // no scope doubling
        // Patch-bump from 1.0.0 → 1.0.1 — the v0.0.46x regression
        // ("always 1.0.0") would surface as still-1.0.0 here.
        expect(entry.manifest.version).toBe("1.0.1");
        expect(entry.manifest.colors?.primary).toBeTruthy();
    });

    await test.step("theme on disk gains _registryMeta after publish", async () => {
        const list = await window.evaluate(
            async (appId) =>
                window.mainApi.themes.listThemesForApplication(appId),
            APP_ID
        );
        const theme = list?.themes?.[THEME_KEY];
        expect(theme).toBeTruthy();
        expect(theme.version).toBe("1.0.1");
        expect(theme._registryMeta?.packageName).toMatch(
            new RegExp(`^${PUBLISHER_USERNAME}/`)
        );
        expect(theme._registryMeta?.lastPublishedVersion).toBe("1.0.1");
    });
});
