const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");
const {
    startMockRegistry,
    stopMockRegistry,
    registerPackage,
} = require("../helpers/mock-registry");
const {
    seedAuthToken,
    clearAuthToken,
} = require("../helpers/auth-token-injector");

/**
 * Registry Discover — Widgets
 *
 * Verifies the mock-registry helper can serve WIDGET packages (we
 * already cover theme packages in registry-theme-install). Seeds
 * two custom widget packages, navigates to Settings → Widgets →
 * Install Widgets → Search for Widgets, and asserts both packages
 * appear in the discover list.
 *
 * Selectors derived from `node scripts/explore-ui.js --to
 * settings.widgets.discover` (against the real registry — the same
 * UI shape applies when pointed at our mock).
 */

let electronApp;
let window;
let tempUserData;
let mockRegistryPort;

test.beforeAll(async () => {
    mockRegistryPort = await startMockRegistry();

    registerPackage({
        type: "widget",
        scope: "trops",
        name: "registry-discover-widget-a",
        version: "1.0.0",
        zipBuffer: Buffer.from("not-a-real-zip"),
        metadata: {
            displayName: "Discover Widget A",
            description: "First test widget for registry discover spec",
            author: "trops",
            category: "general",
            tags: ["test"],
            widgets: [{ name: "WidgetA", displayName: "Widget A" }],
        },
    });
    registerPackage({
        type: "widget",
        scope: "trops",
        name: "registry-discover-widget-b",
        version: "2.0.0",
        zipBuffer: Buffer.from("not-a-real-zip"),
        metadata: {
            displayName: "Discover Widget B",
            description: "Second test widget for registry discover spec",
            author: "trops",
            category: "general",
            tags: ["test"],
            widgets: [
                { name: "WidgetB1", displayName: "Widget B1" },
                { name: "WidgetB2", displayName: "Widget B2" },
            ],
        },
    });

    ({ electronApp, window, tempUserData } = await launchApp({
        env: {
            DASH_REGISTRY_API_URL: `http://127.0.0.1:${mockRegistryPort}`,
        },
        hermetic: true,
    }));
    await seedAuthToken(electronApp);
});

test.afterAll(async () => {
    await clearAuthToken(electronApp);
    await closeApp(electronApp, { tempUserData });
    await stopMockRegistry();
});

test("seeded widget packages appear in Settings → Widgets → Discover", async () => {
    await test.step("navigate to widget discover pane", async () => {
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
            .getByRole("dialog")
            .getByRole("button", { name: "Widgets", exact: true })
            .first()
            .click();
        await window.waitForTimeout(500);
        await window.getByText("Install Widgets", { exact: true }).click();
        await window.waitForTimeout(500);
        await window.getByText("Search for Widgets", { exact: true }).click();
        await window.waitForTimeout(1500);
    });

    await test.step("both seeded widget packages are listed", async () => {
        // Discover shows packages by displayName. Both seeded
        // packages should be present.
        await expect(
            window.getByText("Discover Widget A", { exact: false }).first()
        ).toBeVisible({ timeout: 10000 });
        await expect(
            window.getByText("Discover Widget B", { exact: false }).first()
        ).toBeVisible({ timeout: 5000 });
    });
});
