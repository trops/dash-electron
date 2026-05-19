/**
 * AppUpdatesModal — real Electron + Playwright coverage for the
 * "Check for updates" popover trigger and the modal that pops from
 * it. Catches the regressions jsdom unit tests miss:
 *   - DashSidebar's FooterPopover actually rendering the "Check for
 *     updates" item in the running app
 *   - The Popover panel opening on click (Headless UI behavior, not
 *     jsdom-replicable)
 *   - AppContext propagation through DashboardWrapper → AppWrapper →
 *     sidebar so triggerAppUpdatesCheck is wired
 *   - The modal opening in response to the trigger (Modal-on-portal
 *     behavior, real CSS, real z-index stacking)
 *
 * Hermetic: fresh userData dir per run, so installed widgets are
 * empty and the registry-side check returns no updates. We assert
 * the modal pops in the "Up to date" state — which is the right
 * behavior for a clean user. The populated-updates state is
 * covered by app-updates-modal-populated.spec.js which uses the
 * useAppUpdates test-override hook to inject fixture data.
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
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
});

test("popover 'Check for updates' opens modal → empty-updates state shows 'You're all up to date'", async () => {
    // Open the FooterPopover. The button has the user icon — we
    // identify it by the data-icon attribute the FontAwesomeIcon
    // mock sets in the DashSidebar markup. There's only one user/
    // circle-user icon in the sidebar footer area.
    const popoverButton = window
        .locator(
            'aside button:has([data-icon="user"]), aside button:has([data-icon="circle-user"])',
        )
        .last();
    await expect(popoverButton).toBeVisible({ timeout: 10000 });
    await popoverButton.click();

    // PopoverItem renders as <button>. The 'Check for updates' label
    // is the unique identifier — locked in by DashSidebar.test.js so
    // a refactor that drops it would also fail the jsdom suite.
    const checkForUpdatesItem = window.getByRole("button", {
        name: "Check for updates",
    });
    await expect(checkForUpdatesItem).toBeVisible({ timeout: 5000 });

    // Click to fire triggerAppUpdatesCheck (from AppContext). This
    // should open the AppUpdatesModal — data-testid is stable and
    // unique to that modal.
    await checkForUpdatesItem.click();

    const modal = window.locator('[data-testid="app-updates-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Hermetic launch → no installed widgets → registry check returns
    // no updates → modal lands in the "up to date" state. That's the
    // right behavior to assert here (not a placeholder) — it confirms
    // the entire pipeline ran: trigger → manual recheck → both checks
    // settled → modal rendered the resolved state.
    const upToDate = window.locator(
        '[data-testid="app-updates-modal-uptodate"]',
    );
    await expect(upToDate).toBeVisible({ timeout: 15000 });

    // The Close button is the only footer button in the up-to-date
    // state — clicking it cleanly dismisses the modal.
    const closeBtn = window.getByRole("button", { name: "Close" });
    await closeBtn.click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
});
