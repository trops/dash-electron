const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Algolia IPC payload validation — Phase 5A pin (P1 #14).
 *
 * Pins the validator contract at the renderer→main boundary. Each
 * case sends a deliberately malformed payload and asserts that the
 * main process rejects it with the structured `[ipc:<channel>] ...`
 * error from public/lib/ipcValidators.cjs.
 *
 * This spec deliberately does NOT exercise the happy path. A
 * well-formed payload still proceeds to `clientCache.getClient` /
 * `getProvider`, which fail in the hermetic harness without a real
 * Algolia credential — that's a different surface, covered by
 * `google-widgets.spec.js`-style integration when real creds are
 * available. The contract this spec pins is "malformed input never
 * reaches the body."
 */

let electronApp;
let window;
let tempUserData;

test.beforeAll(async () => {
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
});

async function expectIpcRejection(method, payload, errorPattern) {
    const result = await window.evaluate(
        async ({ method, payload }) => {
            const fn = window.mainApi.algolia[method];
            try {
                await fn(payload);
                return { ok: true };
            } catch (err) {
                return { ok: false, message: err?.message || String(err) };
            }
        },
        { method, payload }
    );
    expect(
        result.ok,
        `expected rejection but call succeeded for ${method}`
    ).toBe(false);
    expect(result.message).toMatch(errorPattern);
}

test("algolia-list-indices rejects wrong-type providerHash", async () => {
    await expectIpcRejection(
        "listIndices",
        {
            providerHash: 123,
            dashboardAppId: "app",
            providerName: "algolia",
        },
        /providerHash must match/
    );
});

test("algolia-list-indices rejects empty dashboardAppId", async () => {
    await expectIpcRejection(
        "listIndices",
        { dashboardAppId: "", providerName: "algolia" },
        /dashboardAppId/
    );
});

test("algolia-list-indices rejects missing providerName", async () => {
    await expectIpcRejection(
        "listIndices",
        { dashboardAppId: "app" },
        /providerName is required/
    );
});

test("algolia-search rejects path-traversal in indexName", async () => {
    await expectIpcRejection(
        "search",
        {
            dashboardAppId: "app",
            providerName: "algolia",
            indexName: "../etc/passwd",
        },
        /indexName must be/
    );
});

test("algolia-search rejects indexName > 128 chars", async () => {
    await expectIpcRejection(
        "search",
        {
            dashboardAppId: "app",
            providerName: "algolia",
            indexName: "x".repeat(129),
        },
        /indexName must be/
    );
});

test("algolia-partial-update-objects rejects nonexistent dir", async () => {
    await expectIpcRejection(
        "partialUpdateObjectsFromDirectory",
        {
            dashboardAppId: "app",
            providerName: "algolia",
            indexName: "products",
            dir: "/nonexistent/path/that/does/not/exist",
        },
        /dir must point to an existing directory/
    );
});

test("algolia-partial-update-objects rejects relative dir", async () => {
    await expectIpcRejection(
        "partialUpdateObjectsFromDirectory",
        {
            dashboardAppId: "app",
            providerName: "algolia",
            indexName: "products",
            dir: "relative/path",
        },
        /dir must be an absolute path/
    );
});

test("algolia-save-rule rejects non-object rule", async () => {
    await expectIpcRejection(
        "saveRule",
        {
            providerHash: "a".repeat(64),
            dashboardAppId: "app",
            providerName: "algolia",
            indexName: "products",
            rule: "not-an-object",
        },
        /rule must be a plain object/
    );
});

test("error message includes channel name for debuggability", async () => {
    await expectIpcRejection(
        "listIndices",
        { dashboardAppId: 99, providerName: "algolia" },
        /\[ipc:algolia-list-indices\]/
    );
});
