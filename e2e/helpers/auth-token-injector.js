/**
 * Auth-token injector for E2E tests.
 *
 * Pre-seeds the registry auth token in electron-store so specs can run
 * registry-gated flows (install, publish, owned packages, etc.) without
 * walking the real Cognito hosted-UI flow.
 *
 * Usage:
 *
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
 *
 * Implementation note: Playwright's `electronApp.evaluate(fn, arg)` calls
 * `fn(electronModule, arg)` — the first param is always the result of
 * `require('electron')` in the main script. `require()` itself is not
 * lexically in scope inside the evaluate body (Playwright wraps it in a
 * fresh `Function` scope), so we use `process.mainModule.require` —
 * `process` is a true Node global and `mainModule.require` resolves
 * relative to the launched main script.
 */

const DEFAULT_TOKEN = "test-e2e-token";
const DEFAULT_USER_ID = "test-user";

async function seedAuthToken(electronApp, opts = {}) {
    const token = opts.token || DEFAULT_TOKEN;
    const userId = opts.userId || DEFAULT_USER_ID;

    await electronApp.evaluate(
        async (_electron, { tokenValue, userIdValue }) => {
            const _require = process.mainModule && process.mainModule.require;
            const Store = _require("electron-store");
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

async function clearAuthToken(electronApp) {
    if (!electronApp) return;
    await electronApp
        .evaluate(async (_electron) => {
            const _require = process.mainModule && process.mainModule.require;
            const Store = _require("electron-store");
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
