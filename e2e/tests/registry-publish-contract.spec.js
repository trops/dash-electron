const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const AdmZip = require("adm-zip");
const { launchApp, closeApp } = require("../helpers/electron-app");
const {
    startMockRegistry,
    stopMockRegistry,
    getPublishHistory,
    clearHistory,
} = require("../helpers/mock-registry");
const {
    seedAuthToken,
    clearAuthToken,
} = require("../helpers/auth-token-injector");

/**
 * Registry publish — IPC contract spec
 *
 * The QA plan flags publish as a top-priority regression surface
 * because it touches auth, multipart construction, manifest shape
 * (scope-remap, no doubling), and registry endpoint URL. This spec
 * pins the IPC layer (`mainApi.registryAuth.publish(zipPath, manifest)`)
 * end-to-end against the mock registry:
 *
 *   1. Auth required: with no token, the IPC short-circuits with
 *      authRequired: true (no network hit).
 *   2. Successful publish: the IPC POSTs multipart to /api/publish
 *      with the right Authorization header AND the manifest JSON
 *      arrives intact on the server side.
 *   3. The mock-registry's parsed manifest preserves the scope/name
 *      shape the caller sent — proving the multipart construction
 *      didn't corrupt or drop fields.
 *
 * Pairs with `registry-delete-package.spec.js` (the other half of the
 * publish lifecycle: publish → unpublish).
 */

let electronApp;
let window;
let tempUserData;
let mockRegistryPort;
let zipPath;

test.beforeAll(async () => {
    mockRegistryPort = await startMockRegistry({ seedThemes: false });

    // Pre-build a minimal zip — server doesn't unzip it; only the
    // multipart byte count matters here.
    zipPath = path.join(os.tmpdir(), `dash-e2e-publish-${Date.now()}.zip`);
    const zip = new AdmZip();
    zip.addFile(
        "package.json",
        Buffer.from(
            JSON.stringify({ name: "publish-test-widget", version: "1.0.0" })
        )
    );
    zip.writeZip(zipPath);

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
    try {
        if (zipPath && fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    } catch (_) {}
});

test("not-signed-in: publish short-circuits with authRequired", async () => {
    // Hermetic launch, no token seeded yet.
    const result = await window.evaluate(
        async ({ z, m }) => window.mainApi.registryAuth.publish(z, m),
        { z: zipPath, m: { name: "anything", version: "1.0.0" } }
    );
    expect(result.success).toBe(false);
    expect(result.authRequired).toBe(true);
});

test("signed-in: publish succeeds and the registry receives the manifest", async () => {
    await seedAuthToken(electronApp);
    clearHistory();

    const manifest = {
        scope: "@trops",
        name: "publish-test-widget",
        version: "1.0.0",
        type: "widget",
        displayName: "Publish Test Widget",
    };

    const result = await window.evaluate(
        async ({ z, m }) => window.mainApi.registryAuth.publish(z, m),
        { z: zipPath, m: manifest }
    );
    expect(result.success).toBe(true);
    expect(result.version).toBeTruthy();

    const history = getPublishHistory();
    expect(history.length).toBe(1);

    const entry = history[0];
    expect(entry.contentType).toMatch(/multipart\/form-data/i);
    expect(entry.authorization).toMatch(/^Bearer /);
    expect(entry.fileBytes).toBeGreaterThan(0);
    // Manifest round-trips through multipart intact — proves the
    // client constructs the form correctly and no field is dropped.
    expect(entry.manifest).toMatchObject({
        scope: "@trops",
        name: "publish-test-widget",
        version: "1.0.0",
        type: "widget",
    });
});

test("scope-remap input is preserved by the multipart wire format", async () => {
    // Regression-magnet check: even if a caller sends an unusual scope
    // like `@ai-built` (the AI-builder's pre-publish scope), the wire
    // format must NOT mangle it (e.g. by accidentally prefixing
    // another scope). The publish IPC is a passthrough — scope-remap
    // happens upstream in the publish modal, NOT in the multipart
    // serializer. If that boundary moves, this assertion catches it.
    clearHistory();

    const manifest = {
        scope: "@ai-built",
        name: "double-prefix-canary",
        version: "0.1.0",
        type: "widget",
    };
    const result = await window.evaluate(
        async ({ z, m }) => window.mainApi.registryAuth.publish(z, m),
        { z: zipPath, m: manifest }
    );
    expect(result.success).toBe(true);

    const entry = getPublishHistory()[0];
    expect(entry.manifest.scope).toBe("@ai-built");
    expect(entry.manifest.name).toBe("double-prefix-canary");
    // No `@trops/@ai-built/...` doubling — the scope stays exactly
    // what the caller passed in.
    expect(entry.manifest.name).not.toMatch(/^@/);
});
