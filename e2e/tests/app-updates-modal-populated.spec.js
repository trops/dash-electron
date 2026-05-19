/**
 * AppUpdatesModal — populated-updates state via the useAppUpdates
 * test-override hook (`window.__DASH_APP_UPDATES_OVERRIDE`).
 *
 * Fresh Electron launch with the override installed BEFORE the
 * renderer mounts (via addInitScript) so the React tree sees the
 * fixture from the first render. This avoids the leftover-portal
 * issue when chaining off the empty-updates spec's launch.
 *
 * What this pins:
 *   - The popover → triggerAppUpdatesCheck → modal-opens flow when
 *     there ARE updates (modal lands in the updates-available
 *     branch, not the up-to-date branch).
 *   - Per-package row rendering with version transitions.
 *   - Proactive auth gate: the hermetic user is NOT signed in to the
 *     registry, so useRegistryAuth().checkAuth() resolves to
 *     authenticated=false → footer renders "Sign in to Registry"
 *     instead of "Update N widgets". This is the regression where
 *     the modal previously let users click Update on a stale-auth
 *     state and silently fail; the auth gate now blocks the click.
 */
const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

let electronApp;
let window;
let tempUserData;

test.beforeAll(async () => {
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
    // Install the override BEFORE React mounts the modal so the
    // first useAppUpdates render sees the fixture. addInitScript
    // queues the snippet to run on every page (including the
    // current one) before any user script.
    await window.addInitScript(() => {
        window.__DASH_APP_UPDATES_OVERRIDE = {
            widgetUpdates: [
                {
                    name: "@trops/pipeline",
                    currentVersion: "1.0.0",
                    latestVersion: "1.0.8",
                },
                {
                    name: "@trops/slack",
                    currentVersion: "0.0.700",
                    latestVersion: "0.0.735",
                },
            ],
            dashboardUpdates: [],
            totalUpdates: 2,
            isChecking: false,
            hasChecked: true,
        };
    });
    // Re-load so the addInitScript above runs at page bootstrap.
    await window.reload();
    await window.waitForSelector("#root > *", { timeout: 30000 });
    await window.waitForTimeout(2000);
    // Dismiss the settings modal if it auto-opened (clean userdata
    // behavior — matches the empty spec).
    const doneButton = window.getByText("Done", { exact: true });
    if (await doneButton.isVisible().catch(() => false)) {
        await doneButton.click();
        await window.waitForTimeout(500);
    }
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
});

test("populated-updates state lists package rows + auth-gated 'Sign in to Registry' CTA", async () => {
    // Verify the override actually took effect — fixtures should be
    // present in the test page.
    const overrideTotal = await window.evaluate(
        () => window.__DASH_APP_UPDATES_OVERRIDE?.totalUpdates
    );
    expect(overrideTotal).toBe(2);

    // Open the popover and trigger the check. Fresh app launch so
    // no leftover portals to fight.
    const popoverButton = window
        .locator(
            'aside button:has([data-icon="user"]), aside button:has([data-icon="circle-user"])'
        )
        .last();
    await expect(popoverButton).toBeVisible({ timeout: 10000 });
    await popoverButton.click();

    const checkForUpdatesItem = window.getByRole("button", {
        name: "Check for updates",
    });
    await expect(checkForUpdatesItem).toBeVisible({ timeout: 5000 });
    await checkForUpdatesItem.click();

    const modal = window.locator('[data-testid="app-updates-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Header reflects the count from the fixture.
    await expect(window.getByText(/2 updates available/)).toBeVisible({
        timeout: 5000,
    });

    // Each pending package gets a row with its version transition.
    await expect(
        window.locator(
            '[data-testid="app-updates-modal-widget-row-@trops/pipeline"]'
        )
    ).toHaveText(/@trops\/pipeline.*1\.0\.0.*1\.0\.8/);
    await expect(
        window.locator(
            '[data-testid="app-updates-modal-widget-row-@trops/slack"]'
        )
    ).toHaveText(/@trops\/slack.*0\.0\.700.*0\.0\.735/);

    // Hermetic user is NOT signed in to the registry. The modal's
    // proactive auth check (useRegistryAuth.checkAuth on mount)
    // resolves to authenticated=false, so the footer renders the
    // "Sign in to Registry" CTA instead of "Update N widgets" —
    // which is the correct gate (we can't install without auth).
    // This pins the regression where the modal previously showed
    // Update → click → silent fail on stale auth.
    await expect(
        window.locator('[data-testid="app-updates-modal-sign-in-registry"]')
    ).toBeVisible({ timeout: 10000 });
    await expect(
        window.getByText(/Sign in to the registry to install 2 widget/)
    ).toBeVisible();
    // No "Update 2 widgets" button — gated until sign-in.
    await expect(
        window.getByRole("button", { name: "Update 2 widgets" })
    ).not.toBeVisible();
});
