const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");
const {
    startMockRegistry,
    stopMockRegistry,
} = require("../helpers/mock-registry");
const {
    seedAuthToken,
    clearAuthToken,
} = require("../helpers/auth-token-injector");

/**
 * Registry Theme Install — End-to-End
 *
 * Walked as a single sequential test rather than per-assertion tests.
 * Reason: this describe shares one launched Electron app across all
 * tests with no automatic teardown. The Settings modal is stateful
 * and stays open between tests, intercepting clicks in the next.
 * Selector-based reset attempts ("Done" button, Escape, etc.) were
 * fragile and order-dependent. Collapsing into one flow eliminates
 * the inter-test transition entirely — every step runs against the
 * state the previous step left behind, by design.
 *
 * Each step still asserts independently and the test stops at the
 * first failure with a clear step name in the error.
 */

let electronApp;
let window;
let tempUserData;
let mockRegistryPort;

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

const INSTALL_THEMES = ["Nordic Frost", "Dracula Night", "Evergreen Pine"];

test.beforeAll(async () => {
    mockRegistryPort = await startMockRegistry();
    // Hermetic launch — fresh user-data dir per run so previously-
    // installed themes/dashboards from earlier test runs don't appear
    // as duplicate "Nordic Frost" entries in the marketplace view.
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

async function openDiscoverThemes(win) {
    const sidebar = win.locator("aside");
    await sidebar.getByText("Account", { exact: true }).click();
    await win.waitForTimeout(500);
    await win
        .getByRole("button", { name: "Settings", exact: true })
        .first()
        .click();
    await win.waitForTimeout(1000);
    await win
        .getByRole("button", { name: "Themes", exact: true })
        .first()
        .click();
    await win.waitForTimeout(500);
    await win.getByText("New Theme", { exact: true }).click();
    await win.waitForTimeout(500);
    await win.getByText("Search Marketplace", { exact: true }).click();
    await win.waitForTimeout(1000);
    await expect(win.getByText("Loading themes...")).toBeHidden({
        timeout: 10000,
    });
}

async function backToThemeList(win) {
    await win.locator("button").filter({ hasText: "Back" }).first().click();
    await win.waitForTimeout(500);
}

test("Registry theme install — full flow", async () => {
    // ---- Step 1: discover all 10 themes in the registry --------------
    // Use .first() everywhere because previous local runs may have left
    // themes installed — the discover view then shows the same theme
    // text twice (marketplace list + installed list) and strict mode
    // would fail. The assertion is "at least one is visible," which is
    // what we want.
    await test.step("discover: all 10 themes are visible", async () => {
        await openDiscoverThemes(window);
        for (const name of ALL_THEMES) {
            await expect(
                window.getByText(name, { exact: true }).first()
            ).toBeVisible({ timeout: 5000 });
        }
        await expect(window.getByText("10 themes").first()).toBeVisible({
            timeout: 3000,
        });
    });

    // ---- Step 2: theme metadata displays correctly -------------------
    await test.step("metadata: Nordic Frost detail shows author/version/colors/tags", async () => {
        await window.getByText("Nordic Frost", { exact: true }).first().click();
        await window.waitForTimeout(500);

        await expect(window.getByText("Nordic Frost").first()).toBeVisible({
            timeout: 5000,
        });
        await expect(window.getByText("by johng").first()).toBeVisible();
        await expect(window.getByText("v1.0.0").first()).toBeVisible();
        await expect(
            window
                .getByText("Cool Scandinavian palette", { exact: false })
                .first()
        ).toBeVisible();
        await expect(window.getByText("Primary").first()).toBeVisible();
        await expect(window.getByText("Secondary").first()).toBeVisible();
        await expect(window.getByText("PREVIEW").first()).toBeVisible();
        await expect(window.getByText("cool").first()).toBeVisible();
        await expect(window.getByText("minimal").first()).toBeVisible();
        await expect(window.getByText("Install Theme").first()).toBeVisible();

        await backToThemeList(window);
    });

    // ---- Step 3: install 3 themes ------------------------------------
    await test.step("install: 3 themes install successfully", async () => {
        for (const themeName of INSTALL_THEMES) {
            await window.getByText(themeName, { exact: true }).first().click();
            await window.waitForTimeout(500);

            const installBtn = window
                .getByText("Install Theme", { exact: true })
                .first();
            await expect(installBtn).toBeVisible({ timeout: 5000 });
            await installBtn.click();

            await expect(
                window
                    .getByText("installed successfully", { exact: false })
                    .first()
            ).toBeVisible({ timeout: 15000 });

            await backToThemeList(window);
        }
    });

    // ---- Step 4: console-error sweep while browsing details ----------
    await test.step("no critical console errors during browse", async () => {
        const consoleErrors = [];
        const onConsole = (msg) => {
            if (msg.type() === "error") consoleErrors.push(msg.text());
        };
        window.on("console", onConsole);

        await window
            .getByText("Sakura Blossom", { exact: true })
            .first()
            .click();
        await window.waitForTimeout(500);
        await backToThemeList(window);
        await window.getByText("Volcanic Ash", { exact: true }).first().click();
        await window.waitForTimeout(500);
        await backToThemeList(window);

        window.off("console", onConsole);

        const criticalErrors = consoleErrors.filter(
            (e) =>
                !e.includes("[HMR]") &&
                !e.includes("DevTools") &&
                !e.includes("favicon")
        );
        expect(criticalErrors).toEqual([]);
    });

    // ---- Step 5: installed themes appear in main Themes list ---------
    await test.step("installed themes appear in the Themes section list", async () => {
        // We're still inside the Settings modal, in Discover Themes.
        // Click Back to return to the Themes section's main list.
        await backToThemeList(window);
        for (const themeName of INSTALL_THEMES) {
            await expect(
                window.getByText(themeName, { exact: true }).first()
            ).toBeVisible({ timeout: 5000 });
        }
    });
});
