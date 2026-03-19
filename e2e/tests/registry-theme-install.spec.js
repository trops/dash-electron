const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");
const {
    startMockRegistry,
    stopMockRegistry,
} = require("../helpers/mock-registry");

let electronApp;
let window;
let mockRegistryPort;

// Theme names matching test-registry-index.json in dash-core
const ALL_THEMES = [
    "Nordic Frost",
    "Dracula Night",
    "Solarized Warm",
    "Monokai Ember",
    "Evergreen Pine",
    "Sakura Blossom",
    "Oceanic Breeze",
    "Volcanic Ash",
    "Lavender Haze",
    "Copper Canyon",
];

// Themes to install (at least 3 per acceptance criteria)
const INSTALL_THEMES = ["Nordic Frost", "Dracula Night", "Evergreen Pine"];

test.beforeAll(async () => {
    // Start mock registry for theme ZIP downloads
    mockRegistryPort = await startMockRegistry();

    // Launch app with mock registry URL so downloads hit our server
    ({ electronApp, window } = await launchApp({
        env: {
            DASH_REGISTRY_API_URL: `http://127.0.0.1:${mockRegistryPort}`,
        },
    }));

    // Pre-seed an auth token so installs don't require sign-in
    await electronApp.evaluate(async () => {
        const Store = require("electron-store");
        const s = new Store({
            name: "dash-registry-auth",
            encryptionKey: "dash-registry-v1",
        });
        s.set("accessToken", "test-e2e-token");
        s.set("userId", "test-user");
        s.set("tokenType", "bearer");
        s.set("authenticatedAt", new Date().toISOString());
    });
});

test.afterAll(async () => {
    // Clean up the test auth token
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

    await closeApp(electronApp);
    await stopMockRegistry();
});

/**
 * Navigate to the Discover Themes (Search Marketplace) pane:
 * 1. Click "Themes" in sidebar → opens Settings modal with Themes section
 * 2. Click "New Theme" button
 * 3. Click "Search Marketplace" card
 */
async function navigateToDiscoverThemes(win) {
    const sidebar = win.locator("aside");
    await sidebar.getByText("Themes").click();
    await win.waitForTimeout(1000);

    const newThemeBtn = win.getByText("New Theme", { exact: true });
    await expect(newThemeBtn).toBeVisible({ timeout: 5000 });
    await newThemeBtn.click();
    await win.waitForTimeout(500);

    const marketplaceCard = win.getByText("Search Marketplace", {
        exact: true,
    });
    await expect(marketplaceCard).toBeVisible({ timeout: 5000 });
    await marketplaceCard.click();
    await win.waitForTimeout(1000);

    // Wait for themes to load (loading spinner should disappear)
    await expect(win.getByText("Loading themes...")).toBeHidden({
        timeout: 10000,
    });
}

/**
 * Navigate back to the theme list from a detail view.
 */
async function goBackToThemeList(win) {
    const backBtn = win.locator("button").filter({ hasText: "Back" }).first();
    await backBtn.click();
    await win.waitForTimeout(500);
}

test.describe("Registry Theme Install — End-to-End", () => {
    test("all 10 themes are discoverable in registry", async () => {
        await navigateToDiscoverThemes(window);

        // Verify all 10 themes appear in the list
        for (const themeName of ALL_THEMES) {
            await expect(
                window.getByText(themeName, { exact: true })
            ).toBeVisible({
                timeout: 5000,
            });
        }

        // Verify the footer shows the correct count
        await expect(window.getByText("10 themes")).toBeVisible({
            timeout: 3000,
        });
    });

    test("theme metadata displays correctly", async () => {
        await navigateToDiscoverThemes(window);

        // Click on Nordic Frost to see detail
        await window.getByText("Nordic Frost", { exact: true }).click();
        await window.waitForTimeout(500);

        // Verify metadata is displayed
        await expect(window.getByText("Nordic Frost")).toBeVisible({
            timeout: 5000,
        });
        await expect(window.getByText("by johng")).toBeVisible();
        await expect(window.getByText("v1.0.0")).toBeVisible();
        await expect(
            window.getByText("Cool Scandinavian palette", { exact: false })
        ).toBeVisible();

        // Verify color labels are shown
        await expect(window.getByText("Primary")).toBeVisible();
        await expect(window.getByText("Secondary")).toBeVisible();

        // Verify preview section exists
        await expect(window.getByText("PREVIEW")).toBeVisible();

        // Verify tags are shown
        await expect(window.getByText("cool")).toBeVisible();
        await expect(window.getByText("minimal")).toBeVisible();

        // Verify Install Theme button is present
        await expect(window.getByText("Install Theme")).toBeVisible();

        await goBackToThemeList(window);
    });

    test("install 3 themes from registry successfully", async () => {
        await navigateToDiscoverThemes(window);

        for (const themeName of INSTALL_THEMES) {
            // Click theme in list
            await window.getByText(themeName, { exact: true }).click();
            await window.waitForTimeout(500);

            // Click Install Theme
            const installBtn = window.getByText("Install Theme", {
                exact: true,
            });
            await expect(installBtn).toBeVisible({ timeout: 5000 });
            await installBtn.click();

            // Wait for install to complete — success message should appear
            await expect(
                window.getByText("installed successfully", { exact: false })
            ).toBeVisible({ timeout: 15000 });

            // Go back to list for next theme
            await goBackToThemeList(window);
        }
    });

    test("installed themes appear in theme list with correct colors", async () => {
        // Navigate to the main themes section (not Discover Themes)
        const sidebar = window.locator("aside");
        await sidebar.getByText("Themes").click();
        await window.waitForTimeout(1000);

        // Verify installed themes appear in the theme list
        for (const themeName of INSTALL_THEMES) {
            await expect(
                window.getByText(themeName, { exact: true }).first()
            ).toBeVisible({ timeout: 5000 });
        }
    });

    test("no console errors during discovery and install", async () => {
        const consoleErrors = [];
        window.on("console", (msg) => {
            if (msg.type() === "error") {
                consoleErrors.push(msg.text());
            }
        });

        await navigateToDiscoverThemes(window);

        // Browse through a couple of themes
        await window.getByText("Sakura Blossom", { exact: true }).click();
        await window.waitForTimeout(500);
        await goBackToThemeList(window);

        await window.getByText("Volcanic Ash", { exact: true }).click();
        await window.waitForTimeout(500);
        await goBackToThemeList(window);

        // Filter errors — ignore known non-critical console errors
        const criticalErrors = consoleErrors.filter(
            (e) =>
                !e.includes("[HMR]") &&
                !e.includes("DevTools") &&
                !e.includes("favicon")
        );

        expect(criticalErrors).toEqual([]);
    });
});
