const { test, expect } = require("@playwright/test");
const path = require("path");
const { launchApp, closeApp } = require("../helpers/electron-app");
const { seedInstalledWidgets } = require("../helpers/seed-widgets");

/**
 * Widget uninstall — usage warning regression spec
 *
 * The QA-plan-flagged regression: when a user uninstalls a widget
 * that is in use on one or more dashboards, the confirm modal must
 * call out the affected dashboards (name + instance count) so they
 * are not surprised by orphaned layout items afterward. The
 * "Affected dashboards:" heading + workspace name + instance count
 * are the contract.
 *
 * Pairs with `widget-uninstall.spec.js` (no-usage variant — modal
 * shows the simple "Are you sure" message). Together they pin both
 * branches of the confirm modal's UX.
 */

const APP_ID = "@trops/dash-electron";
const FIXTURE_DIR = path.resolve(
    __dirname,
    "../../test/fixtures/folder-install-test"
);

let electronApp;
let window;
let tempUserData;

const dashboardName = `Usage Warning Test ${Date.now()}`;
const workspaceId = `e2e-uninstall-usage-${Date.now()}`;

test.beforeAll(async () => {
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
    await seedInstalledWidgets(window, [FIXTURE_DIR]);

    // Seed a workspace that uses CurrentWeather so the uninstall
    // confirm modal will surface a usage warning.
    const ws = {
        id: workspaceId,
        name: dashboardName,
        menuId: "uncategorized",
        themeKey: "default-1",
        scrollable: false,
        sidebar: false,
        layout: [
            {
                component: "CurrentWeather",
                uuidString: "weather-1",
                id: "weather-1",
            },
        ],
        pages: [],
        version: Date.now(),
    };
    const r = await window.evaluate(
        async ({ appId, w }) =>
            window.mainApi.workspace.saveWorkspaceForApplication(appId, w),
        { appId: APP_ID, w: ws }
    );
    if (!r?.success) {
        throw new Error(
            `Seed workspace failed: ${r?.error || "unknown error"}`
        );
    }

    // Reload so the renderer-side `useInstalledWidgets` hook picks up
    // the seeded workspace via its workspaces list.
    await window.reload();
    await window.waitForSelector("#root > *", { timeout: 30000 });
    await window.waitForTimeout(2000);
    const done = window.getByText("Done", { exact: true });
    if (await done.isVisible().catch(() => false)) {
        await done.click();
        await window.waitForTimeout(500);
    }
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
});

test("uninstall confirm modal warns about affected dashboards", async () => {
    await test.step("open Settings → Widgets, select Current Weather", async () => {
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

        await window
            .getByRole("button", { name: /Current Weather/ })
            .first()
            .click();
        await window.waitForTimeout(500);
    });

    await test.step("click Uninstall — confirm modal lists the affected dashboard", async () => {
        await window
            .getByRole("button", { name: "Uninstall", exact: true })
            .click();
        await window.waitForTimeout(500);

        // Usage warning surface: "Affected dashboards:" heading, the
        // workspace name, and the instance-count tag are all present.
        await expect(
            window.getByText("Affected dashboards:", { exact: false })
        ).toBeVisible({ timeout: 5000 });
        await expect(
            window.getByText(dashboardName, { exact: false }).first()
        ).toBeVisible({ timeout: 5000 });
        await expect(
            window.getByText("1 instance", { exact: false }).first()
        ).toBeVisible({ timeout: 5000 });
    });

    await test.step("confirm uninstall — widget removed from list", async () => {
        // Two Uninstall buttons exist (detail pane + modal); .nth(1)
        // is the modal's confirm button.
        await window
            .getByRole("button", { name: "Uninstall", exact: true })
            .nth(1)
            .click();
        await window.waitForTimeout(1500);

        await expect(
            window.getByRole("button", { name: /Current Weather/ })
        ).toHaveCount(0);
    });
});
