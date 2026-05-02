const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Account — signed-out UI surfaces the Sign In affordance
 *
 * Hermetic launch (no token) → "Not signed in" + Sign In button.
 *
 * Selectors derived from `node scripts/explore-ui.js --to
 * settings.account`.
 *
 * (We don't assert the seeded-token "signed in" state because the
 * renderer fetches the user profile from the registry on Account
 * mount — a fake token causes that fetch to fail and the UI falls
 * back to signed-out. Validating the seeded-token path requires
 * mock-registry returning a `/api/user/profile` payload, which is
 * a follow-up spec. The auth-token-injector itself is independently
 * verified by helpers-integration.spec.js + registry-theme-install
 * (it makes registry-gated calls succeed).)
 */

let electronApp;
let window;
let tempUserData;

test.afterEach(async () => {
    if (electronApp) {
        await closeApp(electronApp, { tempUserData });
        electronApp = null;
        window = null;
        tempUserData = null;
    }
});

async function openAccountPane(win) {
    await win.locator("aside").getByText("Account", { exact: true }).click();
    await win.waitForTimeout(500);
    await win
        .getByRole("button", { name: "Settings", exact: true })
        .first()
        .click();
    await win.waitForTimeout(1000);
    await win
        .getByRole("dialog")
        .getByRole("button", { name: "Account", exact: true })
        .first()
        .click();
    await win.waitForTimeout(500);
}

test("signed-out: Account shows 'Not signed in' + Sign In button", async () => {
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
    await openAccountPane(window);

    await expect(
        window.getByText("Not signed in", { exact: true })
    ).toBeVisible({ timeout: 5000 });
    await expect(
        window.getByRole("button", { name: "Sign In", exact: true })
    ).toBeVisible();
});
