const { test, expect } = require("@playwright/test");
const path = require("path");
const { launchApp, closeApp } = require("../helpers/electron-app");
const { seedInstalledWidgets } = require("../helpers/seed-widgets");

/**
 * Widget uninstall — UI flow
 *
 * Seeds 3 fixture widgets, opens Settings → Widgets, selects one,
 * clicks Uninstall, confirms in the modal, and asserts the count
 * dropped from 3 to 2.
 *
 * Selectors derived from `node scripts/explore-ui.js --to
 * settings.widgets.uninstallClicked --seed-widgets <path>`.
 */

const FIXTURE_DIR = path.resolve(
    __dirname,
    "../../test/fixtures/folder-install-test"
);

let electronApp;
let window;
let tempUserData;

test.beforeAll(async () => {
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
    await seedInstalledWidgets(window, [FIXTURE_DIR]);
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
});

test("uninstall a widget from Settings → Widgets", async () => {
    await test.step("open Settings → Widgets, confirm 3 widgets", async () => {
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

        await expect(window.getByText("3 widgets")).toBeVisible({
            timeout: 5000,
        });
        await expect(
            window.getByRole("button", { name: /Current Weather/ })
        ).toBeVisible();
    });

    await test.step("select Current Weather, click Uninstall, confirm", async () => {
        await window
            .getByRole("button", { name: /Current Weather/ })
            .first()
            .click();
        await window.waitForTimeout(500);

        // Detail pane: click Uninstall (opens confirm modal).
        await window
            .getByRole("button", { name: "Uninstall", exact: true })
            .click();
        await window.waitForTimeout(500);

        // Confirm modal — there are now TWO "Uninstall" buttons on the
        // page (the detail pane button + the modal's confirm button).
        // The modal contains the "Are you sure" text. Wait for that
        // text, then click the modal's Uninstall (the second one in
        // DOM order — the detail pane one is first).
        await expect(
            window.getByText(
                'Are you sure you want to uninstall "Current Weather"?'
            )
        ).toBeVisible({ timeout: 5000 });
        // Two Uninstall buttons exist. Use .nth(1) for the modal one.
        await window
            .getByRole("button", { name: "Uninstall", exact: true })
            .nth(1)
            .click();
        await window.waitForTimeout(1500);
    });

    await test.step("widget count drops to 2; Current Weather is gone", async () => {
        await expect(window.getByText("2 widgets")).toBeVisible({
            timeout: 5000,
        });
        // The Current Weather button should no longer be in the list.
        await expect(
            window.getByRole("button", { name: /Current Weather/ })
        ).toHaveCount(0);
        // The other two widgets remain.
        await expect(
            window.getByRole("button", { name: /Weather Alerts/ }).first()
        ).toBeVisible();
        await expect(
            window.getByRole("button", { name: /Weekly Forecast/ }).first()
        ).toBeVisible();
    });
});
