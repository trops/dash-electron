const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Widget Builder — QuickStartPane reusability after delete-last-component
 *
 * Regression for: user clicks "Start blank — pick a single component"
 * (the escape hatch under the sample layouts), picks a component,
 * deletes it. The grid empties → QuickStartPane reappears. Clicking
 * "Start blank" again silently does nothing — the user is stuck.
 *
 * Cause: `removeCell` left the now-cell-less row as `{ cells: [] }`.
 * ComposerPaneV2 reads `rows[0].cells[0]` as the QuickStartPane's
 * `seedCellId`; that became `undefined`, which disabled the "Start
 * blank" button (its onClick guards on `seedCellId`).
 *
 * Fix: `removeCell` now re-seeds the sole row with a fresh empty
 * cell so the grid always has a valid drop target. This spec drives
 * the full cycle end-to-end.
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

test("can pick → delete → pick again from QuickStartPane's Start blank", async () => {
    await test.step("app reaches steady state", async () => {
        await window.waitForTimeout(2000);
    });

    await test.step("open the widget builder (Compose is the default tab)", async () => {
        await window.evaluate(() => {
            window.dispatchEvent(new CustomEvent("dash:open-widget-builder"));
        });
        await expect(
            window.locator('[data-testid="widget-builder-modal"]')
        ).toBeAttached({ timeout: 10000 });
        await expect(
            window.locator('[data-testid="composer-pane-v2"]')
        ).toBeVisible({ timeout: 5000 });
    });

    await test.step("first cycle: Start blank → pick Panel", async () => {
        await window
            .locator('[data-testid="composer-quick-start-scratch"]')
            .click();
        // Panel is a container with no inspector-worthy props, so
        // picking it leaves the GridEditor (with its remove buttons)
        // visible — no need to close an auto-opened inspector first.
        await window
            .locator('[data-testid="composer-palette-pick-Panel"]')
            .click();
        await expect(
            window.locator('[data-testid="composer-quick-start"]')
        ).toHaveCount(0);
    });

    await test.step("delete the Panel via its cell remove button", async () => {
        // The Panel lives in cell-1 (first add). Each filled cell
        // renders a × remove button at composer-cell-<id>-remove.
        await window
            .locator('[data-testid="composer-cell-cell-1-remove"]')
            .click();
        // Grid is empty again → QuickStartPane is back.
        await expect(
            window.locator('[data-testid="composer-quick-start"]')
        ).toBeVisible({ timeout: 2000 });
    });

    await test.step("second cycle: Start blank → pick SearchInput (was stuck before)", async () => {
        const scratch = window.locator(
            '[data-testid="composer-quick-start-scratch"]'
        );
        await expect(scratch).toBeEnabled({ timeout: 2000 });
        await scratch.click();
        // The palette should open again.
        await expect(
            window.locator('[data-testid="composer-palette-view"]')
        ).toBeVisible({ timeout: 3000 });
        await window
            .locator('[data-testid="composer-palette-pick-SearchInput"]')
            .click();
        // QuickStartPane gone; SearchInput auto-opens the inspector
        // (it has editable props) so the inspector view replaces
        // the grid editor. Either way, the second cycle reached the
        // composition step, which is the regression check.
        await expect(
            window.locator('[data-testid="composer-quick-start"]')
        ).toHaveCount(0);
        await expect(
            window.locator('[data-testid^="composer-inspector-cell-"]')
        ).toBeVisible({ timeout: 3000 });
    });
});
