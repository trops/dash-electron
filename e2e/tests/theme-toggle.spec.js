const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

let electronApp;
let window;
let sidebar;

test.beforeAll(async () => {
    ({ electronApp, window } = await launchApp());
    sidebar = window.locator("aside");
});

test.afterAll(async () => {
    await closeApp(electronApp);
});

// The sidebar UI was redesigned and no longer exposes a "Dark Mode" /
// "Light Mode" text toggle inline. These tests reference dead UI and
// need to be rewritten against the new theme-switching surface (likely
// inside Settings → Themes). Skipped until then.
test.describe.skip("Theme Toggle (DEAD UI — sidebar redesigned)", () => {
    test("theme toggle button is visible in sidebar", async () => {
        const darkMode = sidebar.getByText("Dark Mode");
        const lightMode = sidebar.getByText("Light Mode");

        const darkVisible = await darkMode.isVisible().catch(() => false);
        const lightVisible = await lightMode.isVisible().catch(() => false);

        expect(darkVisible || lightVisible).toBe(true);
    });

    test("clicking theme toggle switches the label", async () => {
        const darkMode = sidebar.getByText("Dark Mode");
        const lightMode = sidebar.getByText("Light Mode");

        const wasDark = await darkMode.isVisible().catch(() => false);

        if (wasDark) {
            await darkMode.click();
            await expect(lightMode).toBeVisible({ timeout: 5000 });
        } else {
            await lightMode.click();
            await expect(darkMode).toBeVisible({ timeout: 5000 });
        }
    });

    test("clicking theme toggle again restores original label", async () => {
        const darkMode = sidebar.getByText("Dark Mode");
        const lightMode = sidebar.getByText("Light Mode");

        const isDark = await darkMode.isVisible().catch(() => false);

        if (isDark) {
            await darkMode.click();
            await expect(lightMode).toBeVisible({ timeout: 5000 });
        } else {
            await lightMode.click();
            await expect(darkMode).toBeVisible({ timeout: 5000 });
        }
    });
});
