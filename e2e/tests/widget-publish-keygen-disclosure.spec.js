const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");
const {
    startMockRegistry,
    stopMockRegistry,
    setAuthProfile,
    getMockRootPublicKey,
} = require("../helpers/mock-registry");
const {
    seedAuthToken,
    clearAuthToken,
} = require("../helpers/auth-token-injector");

/**
 * Publisher signing-key — first-publish disclosure flow.
 *
 * Phase 1B-2 added a one-time disclosure step in PublishWidgetModal
 * that fires `window.mainApi.publisherKey.getOrCreate()` only after
 * the user clicks "Generate Key". On every machine the user
 * publishes from, this step runs exactly once; subsequent opens of
 * the modal go straight to the publish form.
 *
 * This spec validates the underlying state contract end-to-end:
 *
 *   1. Fresh hermetic launch → `publisherKey.describe()` returns null.
 *   2. `publisherKey.getOrCreate()` succeeds against the mock
 *      registry, returns a populated view with `generated: true`.
 *   3. A second `getOrCreate()` returns the cached view with
 *      `generated: false` — no second cert-issuance round-trip.
 *   4. `publisherKey.describe()` after the first call mirrors the
 *      view's `keyId` + `fingerprint`.
 *
 * The mock registry signs the cert with its ephemeral root keypair;
 * we inject the matching public key into Electron via
 * `DASH_REGISTRY_ROOT_PUBLIC_KEY` so dash-core's verifier accepts.
 */

const PUBLISHER_USERNAME = "trops";

let electronApp;
let window;
let tempUserData;
let mockRegistryPort;

test.beforeAll(async () => {
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
            DASH_REGISTRY_ROOT_PUBLIC_KEY: getMockRootPublicKey(),
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

test("publisher key: describe→getOrCreate→describe round-trip", async () => {
    await test.step("fresh launch: no key registered yet", async () => {
        const view = await window.evaluate(() =>
            window.mainApi.publisherKey.describe()
        );
        expect(view).toBeNull();
    });

    let generatedKeyId;
    let generatedFingerprint;
    await test.step("getOrCreate: registers + persists + flags generated", async () => {
        const view = await window.evaluate(() =>
            window.mainApi.publisherKey.getOrCreate()
        );
        expect(view).toBeTruthy();
        expect(view.generated).toBe(true);
        expect(view.keyId).toMatch(/^mock-key-/);
        expect(view.fingerprint).toMatch(/^[0-9a-f]{64}$/);
        expect(view.publicKey).toMatch(/^[A-Za-z0-9+/=]+$/);
        expect(view.hasCert).toBe(true);
        generatedKeyId = view.keyId;
        generatedFingerprint = view.fingerprint;
    });

    await test.step("getOrCreate: idempotent — no second registration", async () => {
        const view = await window.evaluate(() =>
            window.mainApi.publisherKey.getOrCreate()
        );
        expect(view.generated).toBe(false);
        expect(view.keyId).toBe(generatedKeyId);
        expect(view.fingerprint).toBe(generatedFingerprint);
    });

    await test.step("describe: reflects the registered key", async () => {
        const view = await window.evaluate(() =>
            window.mainApi.publisherKey.describe()
        );
        expect(view).toBeTruthy();
        expect(view.keyId).toBe(generatedKeyId);
        expect(view.fingerprint).toBe(generatedFingerprint);
        // describe() does NOT include the `generated` flag — that's
        // only on the path that may have just registered.
        expect(view.generated).toBeUndefined();
    });
});
