const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Themes — "New Theme" picker shows all 5 creation modes
 *
 * Covers manual plan items 3a (registry), 3c (preset), and the
 * "From Colors" / "From Random" / "From Website" alternative paths
 * by verifying their entry-point cards are present in the picker.
 *
 * Selectors derived from `node scripts/explore-ui.js --to
 * settings.themes.newPicker`.
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

test("Themes → New Theme picker exposes all 5 creation modes", async () => {
    await window.locator("aside").getByText("Account", { exact: true }).click();
    await window.waitForTimeout(500);
    await window
        .getByRole("button", { name: "Settings", exact: true })
        .first()
        .click();
    await window.waitForTimeout(1000);
    await window
        .getByRole("dialog")
        .getByRole("button", { name: "Themes", exact: true })
        .first()
        .click();
    await window.waitForTimeout(500);
    await window.getByText("New Theme", { exact: true }).click();
    await window.waitForTimeout(500);

    await expect(window.getByText("Add a Theme")).toBeVisible({
        timeout: 5000,
    });

    const expectedModes = [
        "Search Marketplace",
        "From Presets",
        "From Colors",
        "From Random",
        "From Website",
    ];
    for (const mode of expectedModes) {
        await expect(
            window.getByText(mode, { exact: true }).first()
        ).toBeVisible({ timeout: 3000 });
    }
});
