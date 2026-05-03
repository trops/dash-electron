const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");
const {
    startMockRegistry,
    stopMockRegistry,
    registerPackage,
    getDeleteHistory,
    clearHistory,
} = require("../helpers/mock-registry");
const {
    seedAuthToken,
    clearAuthToken,
} = require("../helpers/auth-token-injector");

/**
 * Registry — delete (unpublish) package
 *
 * The QA plan calls out: "Unpublish from registry (covers
 * `deleteRegistryPackage` + S3 IAM permissions added in v0.0.46x)".
 *
 * This spec pins the CLIENT side of that contract: the IPC sends
 * Authorization + DELETE to the right URL, and surfaces the
 * registry's response cleanly on success and on 404.
 *
 * Three branches:
 *
 *   1. Successful delete: registry returns 204 → IPC returns
 *      { success: true } and the package is gone from the index.
 *   2. Not-found delete: registry returns 404 → IPC returns
 *      { success: false } with a useful error string.
 *   3. Not-signed-in: with no token, the IPC short-circuits before
 *      hitting the network and returns a "Not signed in" error.
 *
 * The S3 IAM half lives on the registry side (separate repo); this
 * spec ensures the client-side surface stays correct as that side
 * evolves.
 */

let electronApp;
let window;
let tempUserData;
let mockRegistryPort;

test.beforeAll(async () => {
    mockRegistryPort = await startMockRegistry({ seedThemes: false });

    registerPackage({
        type: "widget",
        scope: "trops",
        name: "delete-target",
        version: "1.0.0",
        metadata: {
            displayName: "Delete Target",
            description: "Will be unpublished by this spec",
            author: "trops",
            category: "general",
            tags: ["test"],
            widgets: [{ name: "DeleteTarget", displayName: "Delete Target" }],
        },
    });

    ({ electronApp, window, tempUserData } = await launchApp({
        env: {
            DASH_REGISTRY_API_URL: `http://127.0.0.1:${mockRegistryPort}`,
        },
        hermetic: true,
    }));
});

test.afterAll(async () => {
    await clearAuthToken(electronApp);
    await closeApp(electronApp, { tempUserData });
    await stopMockRegistry();
});

test("not-signed-in: deletePackage short-circuits with an auth error", async () => {
    // Hermetic launch starts without an auth token. The IPC must
    // refuse before hitting the network.
    const result = await window.evaluate(async () =>
        window.mainApi.registryAuth.deletePackage("@trops", "delete-target")
    );
    expect(result.success).toBe(false);
    expect(String(result.error || "")).toMatch(/sign(ed)? in|signed/i);
});

test("signed-in: deletePackage succeeds and the registry records it", async () => {
    await seedAuthToken(electronApp);
    clearHistory();

    const result = await window.evaluate(async () =>
        window.mainApi.registryAuth.deletePackage("@trops", "delete-target")
    );
    expect(result.success).toBe(true);

    const history = getDeleteHistory();
    expect(history.length).toBe(1);
    expect(history[0].scope).toBe("trops");
    expect(history[0].name).toBe("delete-target");
    expect(history[0].existed).toBe(true);
});

test("signed-in: deletePackage on a missing package surfaces a 404", async () => {
    // Auth still seeded from the prior test.
    clearHistory();

    const result = await window.evaluate(async () =>
        window.mainApi.registryAuth.deletePackage(
            "@trops",
            "never-published-widget"
        )
    );
    expect(result.success).toBe(false);
    expect(result.status).toBe(404);

    const history = getDeleteHistory();
    expect(history.length).toBe(1);
    expect(history[0].existed).toBe(false);
});
