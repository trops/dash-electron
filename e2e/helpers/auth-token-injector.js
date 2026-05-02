/**
 * Auth-token injector for E2E tests.
 *
 * Pre-seeds the registry auth token in electron-store so specs can run
 * registry-gated flows (install, publish, owned packages, etc.) without
 * walking the real Cognito hosted-UI flow.
 *
 * Mirrors the pattern that was inlined in registry-theme-install.spec.js
 * (lines 41-67 of the original) so every new spec doesn't reinvent it.
 *
 * Usage:
 *   const { seedAuthToken, clearAuthToken } = require("./auth-token-injector");
 *
 *   test.beforeAll(async () => {
 *     ({ electronApp, window } = await launchApp({ env: {...} }));
 *     await seedAuthToken(electronApp);
 *   });
 *
 *   test.afterAll(async () => {
 *     await clearAuthToken(electronApp);
 *     await closeApp(electronApp);
 *   });
 */

const DEFAULT_TOKEN = "test-e2e-token";
const DEFAULT_USER_ID = "test-user";

/**
 * Pre-seed the registry auth electron-store with a fake token.
 *
 * @param {ElectronApplication} electronApp - Playwright Electron app handle.
 * @param {Object} [opts]
 * @param {string} [opts.token] - Access token value.
 * @param {string} [opts.userId] - User id (drives the registry-cache key).
 * @returns {Promise<void>}
 */
async function seedAuthToken(electronApp, opts = {}) {
    const token = opts.token || DEFAULT_TOKEN;
    const userId = opts.userId || DEFAULT_USER_ID;

    await electronApp.evaluate(
        async ({ tokenValue, userIdValue }) => {
            const Store = require("electron-store");
            const s = new Store({
                name: "dash-registry-auth",
                encryptionKey: "dash-registry-v1",
            });
            s.set("accessToken", tokenValue);
            s.set("userId", userIdValue);
            s.set("tokenType", "bearer");
            s.set("authenticatedAt", new Date().toISOString());
        },
        { tokenValue: token, userIdValue: userId }
    );
}

/**
 * Wipe the registry auth electron-store. Safe to call from afterAll even
 * if the app is mid-shutdown — errors are swallowed.
 *
 * @param {ElectronApplication} electronApp
 * @returns {Promise<void>}
 */
async function clearAuthToken(electronApp) {
    if (!electronApp) return;
    await electronApp
        .evaluate(async () => {
            const Store = require("electron-store");
            const s = new Store({
                name: "dash-registry-auth",
                encryptionKey: "dash-registry-v1",
            });
            s.delete("accessToken");
            s.delete("userId");
            s.delete("tokenType");
            s.delete("authenticatedAt");
        })
        .catch(() => {});
}

module.exports = { seedAuthToken, clearAuthToken };
