const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Provider default-of-type — single-winner invariant
 *
 * Regression coverage for the rule that for any given provider type,
 * at most one provider can be marked `isDefaultForType: true`. The
 * server-side controller enforces single-winner; this spec verifies
 * the UI surface end-to-end:
 *   1. Create provider A of type "test-type", check the default box.
 *   2. Create provider B of the same type.
 *   3. Open B's detail, check ITS default box.
 *   4. Reopen A's detail — A's default checkbox is now unchecked.
 *
 * If the invariant ever drifts (both flagged default, neither
 * unchecked, etc.), every widget that resolves a provider via
 * `isDefaultForType` ends up using stale state at runtime.
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

async function openProvidersPane(win) {
    await win.locator("aside").getByText("Account", { exact: true }).click();
    await win.waitForTimeout(500);
    await win
        .getByRole("button", { name: "Settings", exact: true })
        .first()
        .click();
    await win.waitForTimeout(1000);
    await win
        .getByRole("dialog")
        .getByRole("button", { name: "Providers", exact: true })
        .first()
        .click();
    await win.waitForTimeout(500);
}

async function createCredentialProvider(win, name, type, key) {
    await win.getByText("New Provider", { exact: true }).click();
    await win.waitForTimeout(500);
    await win.getByRole("button", { name: /Credential.*API key/ }).click();
    await win.waitForTimeout(500);
    await win.getByRole("textbox", { name: "Provider name" }).fill(name);
    await win
        .getByRole("textbox", {
            name: "Provider type (e.g. algolia, openai)",
        })
        .fill(type);
    await win.getByRole("textbox", { name: "Enter apiKey" }).fill(key);
    await win.getByRole("button", { name: "Create", exact: true }).click();
    await win.waitForTimeout(1000);
    // After create, the form closes back to the list. Click the
    // provider's name to open the detail pane (where the default
    // checkbox lives).
    await win.getByText(name, { exact: true }).first().click();
    await win.waitForTimeout(500);
}

async function selectProvider(win, name) {
    await win.getByText(name, { exact: true }).first().click();
    await win.waitForTimeout(500);
}

test("default-for-type is a single-winner across providers of same type", async () => {
    await openProvidersPane(window);

    await test.step("create provider A and mark default", async () => {
        await createCredentialProvider(
            window,
            "Provider A",
            "test-type",
            "key-a"
        );
        // Detail panel for A is auto-shown after create. Toggle default.
        const defaultCb = window.getByRole("checkbox", {
            name: /Use as default for test-type/,
        });
        await expect(defaultCb).toBeVisible({ timeout: 5000 });
        // The checkbox's onChange is React-controlled — `.check()`
        // verifies state-change synchronously and fails because the
        // controlled value updates async. Use `.click()` and assert
        // checked state on the next render.
        await defaultCb.click();
        await window.waitForTimeout(500);
        await expect(defaultCb).toBeChecked();
    });

    await test.step("create provider B (same type)", async () => {
        await createCredentialProvider(
            window,
            "Provider B",
            "test-type",
            "key-b"
        );
        // After create, B's detail is showing. Confirm B's default
        // checkbox is currently unchecked (single-winner invariant
        // means freshly created providers are not default by default).
        const defaultCb = window.getByRole("checkbox", {
            name: /Use as default for test-type/,
        });
        await expect(defaultCb).not.toBeChecked();
    });

    await test.step("mark B as default — A's default should drop", async () => {
        const defaultCb = window.getByRole("checkbox", {
            name: /Use as default for test-type/,
        });
        // The checkbox's onChange is React-controlled — `.check()`
        // verifies state-change synchronously and fails because the
        // controlled value updates async. Use `.click()` and assert
        // checked state on the next render.
        await defaultCb.click();
        await window.waitForTimeout(800);
        await expect(defaultCb).toBeChecked();

        // Open A's detail. Its default checkbox should now be unchecked.
        await selectProvider(window, "Provider A");
        const aCb = window.getByRole("checkbox", {
            name: /Use as default for test-type/,
        });
        await expect(aCb).not.toBeChecked();
    });
});
