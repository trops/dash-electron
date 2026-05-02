const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Settings → General — toggle Debug Mode
 *
 * Walks Settings → General, toggles the Debug Mode switch, and
 * confirms the toggle state changes (visible via the switch's
 * `[checked]` accessibility state). Also verifies the App Info panel
 * renders with the expected fields.
 *
 * Selectors derived from `node scripts/explore-ui.js --to
 * settings.general`.
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

test("Settings → General renders + Debug Mode toggle works", async () => {
    await test.step("open Settings → General", async () => {
        await window
            .locator("aside")
            .getByText("Account", { exact: true })
            .click();
        await window.waitForTimeout(500);
        await window
            .getByRole("button", { name: "Settings", exact: true })
            .first()
            .click();
        await window.waitForTimeout(1000);
        await window
            .getByRole("button", { name: "General", exact: true })
            .first()
            .click();
        await window.waitForTimeout(500);

        // Confirm we're on the General pane.
        await expect(window.getByText("Preferences")).toBeVisible({
            timeout: 5000,
        });
    });

    await test.step("App Info panel shows expected fields", async () => {
        await expect(window.getByText("App ID")).toBeVisible();
        await expect(window.getByText("Version")).toBeVisible();
        await expect(window.getByText("Settings File")).toBeVisible();
        await expect(window.getByText("@trops/dash-electron")).toBeVisible();
    });

    await test.step("Debug Mode toggle flips state", async () => {
        const debugSwitch = window
            .locator("text=Debug Mode")
            .locator("..")
            .locator('[role="switch"]')
            .first();
        // Fallback: just grab the first switch in the General pane —
        // there's only one (Debug Mode).
        const fallbackSwitch = window.getByRole("switch").first();
        const sw =
            (await debugSwitch.count()) > 0 ? debugSwitch : fallbackSwitch;

        const before = await sw.getAttribute("aria-checked");
        await sw.click();
        await window.waitForTimeout(300);
        const after = await sw.getAttribute("aria-checked");

        // The switch state changed.
        expect(after).not.toBe(before);
    });
});
