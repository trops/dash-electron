const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Themes — "New Theme" opens the ThemeManagerModal with all 5
 * creation modes visible in the chooser.
 *
 * Creation was consolidated into ThemeManagerModal in dash-core
 * 0.1.586 — the inline-wizard inside Settings → Themes was
 * removed. "+ New Theme" now opens the modal pre-loaded in the
 * chooser state.
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

test("Themes → New Theme opens ThemeManagerModal with all 5 creation modes", async () => {
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
    await window.waitForTimeout(800);

    // ThemeManagerModal renders the chooser inside its panel.
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
