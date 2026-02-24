const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

let electronApp;
let window;

test.beforeAll(async () => {
    ({ electronApp, window } = await launchApp());
});

test.afterAll(async () => {
    await closeApp(electronApp);
});

test.describe("Command Palette", () => {
    test("opens with Cmd+K and shows search input", async () => {
        // Open command palette with Cmd+K
        await window.keyboard.press("Meta+k");

        // Wait for the search input to appear
        const searchInput = window.getByPlaceholder("Search commands...");
        await expect(searchInput).toBeVisible({ timeout: 5000 });

        // Close for next test
        await window.keyboard.press("Escape");
        await window.waitForTimeout(300);
    });

    test("opens via sidebar Search click", async () => {
        // Click Search in the sidebar
        const sidebar = window.locator("aside");
        await sidebar.getByText("Search").click();

        // Search input should appear
        const searchInput = window.getByPlaceholder("Search commands...");
        await expect(searchInput).toBeVisible({ timeout: 5000 });
    });

    test("shows Settings command group when open", async () => {
        // Palette should still be open from previous test
        // Check for the Settings group (unique to command palette, not sidebar)
        await expect(window.getByText("Application Settings")).toBeVisible();
    });

    test("closes with Escape", async () => {
        // Close command palette
        await window.keyboard.press("Escape");

        // Search input should no longer be visible
        const searchInput = window.getByPlaceholder("Search commands...");
        await expect(searchInput).not.toBeVisible({ timeout: 5000 });
    });
});
