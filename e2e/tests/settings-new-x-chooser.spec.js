const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Audit #19 — consolidated "New X" chooser pattern.
 *
 * Previously the Settings header had ambiguous buttons:
 *   - Dashboards section: "Marketplace" (set installMode=marketplace
 *     — same as clicking the in-list Marketplace tab)
 *   - Widgets section: "Install Widgets" (opened a 3-card picker)
 *
 * Phase 19 renames both and routes them through a consolidated
 * chooser that matches the Themes section's ThemeNewChooser pattern:
 *   - Dashboards: "New Dashboard" → NewDashboardChooser
 *     (Search Marketplace + From Wizard)
 *   - Widgets: "New Widget" → InstallWidgetPicker with a new
 *     "Use Widget Builder" card prepended (Builder + Search + Zip
 *     + Folder)
 *
 * The inline "+ New Widget" button (Phase 3B) is removed — its
 * function is now the chooser's first card.
 *
 * This spec pins:
 *   1. The header buttons are renamed (old labels not present).
 *   2. Dashboards chooser shows Marketplace + Wizard cards.
 *   3. Widgets chooser shows Builder + Search + Zip + Folder cards.
 *   4. The Widgets chooser's "Use Widget Builder" card dispatches
 *      the same dash:open-widget-builder event the inline button
 *      used to fire.
 *   5. The inline "+ New Widget" button (data-testid
 *      widgets-section-new-widget-button) is gone.
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

async function openSettings(sectionLabel) {
    const sidebar = window.locator("aside");
    await sidebar.getByText("Account", { exact: true }).click();
    await window.waitForTimeout(400);
    await window
        .getByRole("button", { name: "Settings", exact: true })
        .first()
        .click();
    await window.waitForTimeout(700);
    await window
        .getByRole("button", { name: sectionLabel, exact: true })
        .first()
        .click();
    await window.waitForTimeout(400);
}

async function closeSettings() {
    const doneButton = window.getByRole("button", {
        name: "Done",
        exact: true,
    });
    if (await doneButton.isVisible().catch(() => false)) {
        await doneButton.click();
        await window.waitForTimeout(300);
    }
}

test("Settings → Dashboards header has 'New Dashboard' button (renamed from 'Marketplace')", async () => {
    await openSettings("Dashboards");

    // New label present.
    await expect(
        window.getByText("New Dashboard", { exact: true }).first()
    ).toBeVisible({ timeout: 5000 });

    // Old label gone from the header. The list view's "Marketplace"
    // tab DOES keep that label (different surface), so we constrain
    // to a button role to disambiguate.
    const oldHeaderButton = window.getByRole("button", {
        name: "Marketplace",
        exact: true,
    });
    await expect(oldHeaderButton).toHaveCount(0);

    await closeSettings();
});

test("Settings → Dashboards 'New Dashboard' opens chooser with Marketplace + Wizard cards", async () => {
    await openSettings("Dashboards");
    // Multiple elements match "New Dashboard" (sidebar item +
    // header button). Scope to the header button by role + first to
    // disambiguate.
    await window
        .getByRole("button", { name: "New Dashboard", exact: true })
        .first()
        .click();
    await window.waitForTimeout(400);

    await expect(
        window.getByText("Search Marketplace", { exact: true }).first()
    ).toBeVisible({ timeout: 5000 });
    await expect(
        window.getByText("From Wizard", { exact: true }).first()
    ).toBeVisible({ timeout: 2000 });

    await closeSettings();
});

test("Settings → Widgets header has 'New Widget' button (renamed from 'Install Widgets')", async () => {
    await openSettings("Widgets");

    await expect(
        window.getByText("New Widget", { exact: true }).first()
    ).toBeVisible({ timeout: 5000 });

    const oldHeaderButton = window.getByRole("button", {
        name: "Install Widgets",
        exact: true,
    });
    await expect(oldHeaderButton).toHaveCount(0);

    await closeSettings();
});

test("Settings → Widgets 'New Widget' opens chooser with all 4 cards (Builder + Search + Zip + Folder)", async () => {
    await openSettings("Widgets");
    await window.getByText("New Widget", { exact: true }).click();
    await window.waitForTimeout(400);

    await expect(
        window.getByText("Use Widget Builder", { exact: true })
    ).toBeVisible({ timeout: 5000 });
    await expect(
        window.getByText("Search for Widgets", { exact: true })
    ).toBeVisible();
    await expect(
        window.getByText("Install from File", { exact: true })
    ).toBeVisible();
    await expect(
        window.getByText("Load from Folder", { exact: true })
    ).toBeVisible();

    await closeSettings();
});

test("inline '+ New Widget' button is removed (Phase 3B affordance folded into the chooser)", async () => {
    await openSettings("Widgets");

    // The Phase 3B button used data-testid="widgets-section-new-widget-button".
    // Phase 19 folded its function into the chooser; the inline
    // affordance should be gone.
    const inlineBtn = window.locator(
        '[data-testid="widgets-section-new-widget-button"]'
    );
    await expect(inlineBtn).toHaveCount(0);

    await closeSettings();
});

test("Settings → Widgets 'Use Widget Builder' card dispatches dash:open-widget-builder", async () => {
    // Run LAST in the file — the dash:open-widget-builder handler
    // opens the Widget Builder modal which covers Settings. Closing
    // it cleanly is non-trivial across themes; leaving it open at
    // the end is fine since closeApp tears everything down.
    await openSettings("Widgets");

    await window.evaluate(() => {
        window.__chooserBuilderEvents = 0;
        window.addEventListener("dash:open-widget-builder", () => {
            window.__chooserBuilderEvents += 1;
        });
    });

    await window
        .getByRole("button", { name: "New Widget", exact: true })
        .first()
        .click();
    await window.waitForTimeout(300);
    await window.getByText("Use Widget Builder", { exact: true }).click();
    await window.waitForTimeout(300);

    const fired = await window.evaluate(() => window.__chooserBuilderEvents);
    expect(fired).toBeGreaterThanOrEqual(1);
});
