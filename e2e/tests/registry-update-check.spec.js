const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");
const {
    startMockRegistry,
    stopMockRegistry,
    registerPackage,
} = require("../helpers/mock-registry");
const {
    seedAuthToken,
    clearAuthToken,
} = require("../helpers/auth-token-injector");

/**
 * Registry update check — version comparison contract
 *
 * The QA plan calls out: "After a publisher bumps, the 'Update' badge
 * appears in Widgets list within ~5 min." That UX badge is fed by
 * `mainApi.registry.checkUpdates(installedWidgets)`, which walks the
 * registry index and emits an entry for every installed package whose
 * registry `version` differs from the installed `version`.
 *
 * This spec pins three behaviors of `checkUpdates` against the mock
 * registry:
 *
 *   1. A widget the registry has at a HIGHER version surfaces in the
 *      result (the common "update available" case).
 *   2. A widget at the SAME version is silent (no spurious update).
 *   3. A widget NOT in the registry at all is silent (no crash, no
 *      bogus update entry).
 *
 * Catches: semver comparison drift, registry-id matching regressions
 * ("@scope/name" vs bare "name"), and any change that flips the
 * "different version" check to "missing or different".
 */

let electronApp;
let window;
let tempUserData;
let mockRegistryPort;

test.beforeAll(async () => {
    mockRegistryPort = await startMockRegistry({ seedThemes: false });

    // Higher version available — should produce an update entry.
    registerPackage({
        type: "widget",
        scope: "trops",
        name: "alpha-widget",
        version: "2.0.0",
        metadata: {
            displayName: "Alpha Widget",
            description: "Higher than installed",
            author: "trops",
            category: "general",
            tags: ["test"],
            widgets: [{ name: "Alpha", displayName: "Alpha" }],
        },
    });

    // Same version — should NOT produce an update entry.
    registerPackage({
        type: "widget",
        scope: "trops",
        name: "beta-widget",
        version: "1.0.0",
        metadata: {
            displayName: "Beta Widget",
            description: "Same as installed",
            author: "trops",
            category: "general",
            tags: ["test"],
            widgets: [{ name: "Beta", displayName: "Beta" }],
        },
    });

    ({ electronApp, window, tempUserData } = await launchApp({
        env: {
            DASH_REGISTRY_API_URL: `http://127.0.0.1:${mockRegistryPort}`,
        },
        hermetic: true,
    }));
    await seedAuthToken(electronApp);
});

test.afterAll(async () => {
    await clearAuthToken(electronApp);
    await closeApp(electronApp, { tempUserData });
    await stopMockRegistry();
});

test("checkUpdates returns updates for newer registry versions only", async () => {
    const installed = [
        // Registry has 2.0.0 — update should surface.
        {
            name: "@trops/alpha-widget",
            packageId: "@trops/alpha-widget",
            version: "1.0.0",
        },
        // Registry has 1.0.0 — same version, no update.
        {
            name: "@trops/beta-widget",
            packageId: "@trops/beta-widget",
            version: "1.0.0",
        },
        // Not in registry at all — no update, no crash.
        {
            name: "@trops/gamma-widget",
            packageId: "@trops/gamma-widget",
            version: "1.0.0",
        },
    ];

    const updates = await window.evaluate(
        async (installedArg) =>
            window.mainApi.registry.checkUpdates(installedArg),
        installed
    );

    expect(Array.isArray(updates)).toBe(true);

    const alpha = updates.find((u) => /alpha-widget/.test(u.name));
    expect(alpha).toBeTruthy();
    expect(alpha.currentVersion).toBe("1.0.0");
    expect(alpha.latestVersion).toBe("2.0.0");

    const beta = updates.find((u) => /beta-widget/.test(u.name));
    expect(beta).toBeFalsy();

    const gamma = updates.find((u) => /gamma-widget/.test(u.name));
    expect(gamma).toBeFalsy();
});
