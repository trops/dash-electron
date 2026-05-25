const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");
const { startTestServer, stopTestServer } = require("../helpers/test-server");

/**
 * Theme from URL — End-to-End
 *
 * Theme creation was consolidated into ThemeManagerModal in
 * dash-core 0.1.586. The test navigates Settings → Themes →
 * New Theme (opens modal) → From Website, then exercises the
 * happy path: Extract → palette swatches render with non-zero
 * height (pins the dash-react flex-chain bug fixed in 1.0.56)
 * → fill name → Create Theme button enabled.
 *
 * Validation / timeout / retry scenarios are not exercised in
 * this spec because the new modal flow doesn't expose a "Back
 * to chooser" affordance and the cost of opening + tearing down
 * the modal between scenarios is higher than the regression
 * coverage warrants.
 */

let electronApp;
let window;
let tempUserData;
let testServerPort;

test.beforeAll(async () => {
    testServerPort = await startTestServer();
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
    await stopTestServer();
});

async function openThemeFromUrl(win) {
    const sidebar = win.locator("aside");
    await sidebar.getByText("Account", { exact: true }).click();
    await win.waitForTimeout(500);
    await win
        .getByRole("button", { name: "Settings", exact: true })
        .first()
        .click();
    await win.waitForTimeout(1000);
    await win
        .getByRole("dialog")
        .getByRole("button", { name: "Themes", exact: true })
        .first()
        .click();
    await win.waitForTimeout(500);
    await win.getByText("New Theme", { exact: true }).click();
    // ThemeManagerModal opens — chooser is shown.
    await win.waitForTimeout(800);
    await expect(win.getByText("From Website", { exact: true })).toBeVisible({
        timeout: 5000,
    });
    await win.getByText("From Website", { exact: true }).click();
    // Inside the modal, ThemeQuickCreate renders the URL pane.
    await win.waitForTimeout(500);
    await expect(win.locator('input[type="url"]')).toBeVisible({
        timeout: 5000,
    });
    await expect(win.getByText("Extract", { exact: true })).toBeVisible();
}

test("Theme from URL — happy path: palette renders + Create Theme enables", async () => {
    await openThemeFromUrl(window);

    // Validation: bogus URL disables Extract.
    const urlInput = window.locator('input[type="url"]');
    await urlInput.fill("not-a-valid-url");
    await expect(
        window.getByText("Enter a valid URL starting with http://", {
            exact: false,
        })
    ).toBeVisible({ timeout: 3000 });

    // Happy path.
    await urlInput.fill(`http://127.0.0.1:${testServerPort}/colorful`);
    await window.getByText("Extract", { exact: true }).click();

    await expect(window.getByText("Scanning page for colors...")).toBeVisible({
        timeout: 5000,
    });
    await expect(window.getByText("Scanning page for colors...")).toBeHidden({
        timeout: 30000,
    });

    // Snapshot post-extract state for debugging.
    await window.screenshot({
        path: "test-results/theme-from-url-post-extract.png",
        fullPage: false,
    });

    // Regression guard: PalettePreviewPane swatches render with
    // non-zero height. Before dash-react 1.0.56 the inner color
    // block had flex-1 min-h-0 inside a bare div wrapper that
    // didn't propagate flex sizing, collapsing height to 0.
    const roleNames = ["Primary", "Secondary", "Tertiary", "Neutral"];
    for (const r of roleNames) {
        const swatch = window
            .getByRole("button", { name: new RegExp(`${r} color`) })
            .first();
        await expect(swatch).toBeVisible({ timeout: 5000 });
        const box = await swatch.boundingBox();
        expect(box, `boundingBox missing for ${r}`).not.toBeNull();
        expect(
            box.height,
            `${r} swatch collapsed to height ${box.height}`
        ).toBeGreaterThan(40);
    }

    // Wizard stays open (dash-core 0.1.585+) — Theme name input
    // is visible, Create Theme button is gated on a non-empty name.
    const themeNameInput = window.getByPlaceholder("Theme name...").first();
    await expect(themeNameInput).toBeVisible();
    await themeNameInput.fill("Test From URL");

    const createBtn = window.getByRole("button", { name: /^Create Theme$/ });
    await expect(createBtn).toBeEnabled({ timeout: 5000 });

    // No lingering hidden BrowserWindows after extraction.
    await window.waitForTimeout(1000);
    const windows = await electronApp.windows();
    // Expected: main app + Settings dialog + ThemeManagerModal renderer.
    expect(windows.length).toBeLessThanOrEqual(4);
});
