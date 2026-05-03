const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const AdmZip = require("adm-zip");
const { launchApp, closeApp } = require("../helpers/electron-app");
const {
    overrideSaveDialog,
    restoreFileDialogs,
} = require("../helpers/file-dialog-override");
const { seedInstalledWidgets } = require("../helpers/seed-widgets");

/**
 * Dashboard export — UI flow + zip output validation
 *
 * Seeds a workspace with one installed widget, navigates Settings →
 * Dashboards → workspace card → Export ZIP, intercepts the save
 * dialog to a known path, then opens the resulting zip and asserts:
 *
 *   1. The export reported success (status banner).
 *   2. The .dashboard.json inside the zip has the right schema
 *      version, name, layout, and widgets[] dependency list.
 *   3. The CurrentWeather widget reference is present (export's
 *      `buildWidgetDependencies` walked the registry correctly).
 *
 * Pairs with `dashboard-import.spec.js` — together they cover the
 * round-trip: a workspace exported here would be importable there.
 *
 * Selectors derived from `node scripts/explore-ui.js --to
 * settings.dashboards.firstSelected`.
 */

const APP_ID = "@trops/dash-electron";
const FIXTURE_DIR = path.resolve(
    __dirname,
    "../../test/fixtures/folder-install-test"
);

let electronApp;
let window;
let tempUserData;
let exportZipPath;

const dashboardName = `Export Test ${Date.now()}`;
const workspaceId = `e2e-export-${Date.now()}`;

test.beforeAll(async () => {
    exportZipPath = path.join(os.tmpdir(), `dash-e2e-export-${Date.now()}.zip`);

    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
    await seedInstalledWidgets(window, [FIXTURE_DIR]);
    await overrideSaveDialog(electronApp, { filePath: exportZipPath });

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
    await restoreFileDialogs(electronApp);
    await closeApp(electronApp, { tempUserData });
    try {
        if (exportZipPath && fs.existsSync(exportZipPath)) {
            fs.unlinkSync(exportZipPath);
        }
    } catch (_) {}
});

test("export a dashboard to .zip via Settings → Dashboards", async () => {
    await test.step("open Settings → Dashboards, select the seeded workspace", async () => {
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
            .getByRole("button", { name: "Dashboards", exact: true })
            .first()
            .click();
        await window.waitForTimeout(500);

        await window
            .getByRole("button", { name: new RegExp(dashboardName) })
            .first()
            .click();
        await window.waitForTimeout(500);

        await expect(
            window.getByRole("button", { name: "Export ZIP", exact: true })
        ).toBeVisible({ timeout: 5000 });
    });

    await test.step("click Export ZIP — save dialog returns the fixture path", async () => {
        await window
            .getByRole("button", { name: "Export ZIP", exact: true })
            .click();
        // The export pipeline writes the zip then sets exportStatus.
        await expect(window.getByText(/Exported successfully\./i)).toBeVisible({
            timeout: 5000,
        });
    });

    await test.step("zip exists on disk and contains a valid .dashboard.json", async () => {
        expect(fs.existsSync(exportZipPath)).toBe(true);

        const zip = new AdmZip(exportZipPath);
        const entries = zip.getEntries();
        const configEntry = entries.find((e) =>
            e.entryName.endsWith(".dashboard.json")
        );
        expect(configEntry).toBeTruthy();

        const config = JSON.parse(configEntry.getData().toString("utf-8"));

        expect(config.schemaVersion).toBe("1.0.0");
        expect(config.name).toBe(dashboardName);
        expect(Array.isArray(config.workspace?.layout)).toBe(true);
        expect(config.workspace.layout.length).toBeGreaterThan(0);

        // The workspace's CurrentWeather widget should be present in
        // both the layout and the dependency list — `buildWidgetDeps`
        // walks the registry to map component → package.
        const layoutComponents = config.workspace.layout.map(
            (it) => it.component
        );
        expect(layoutComponents).toContain("CurrentWeather");

        expect(Array.isArray(config.widgets)).toBe(true);
        const widgetIds = config.widgets.map((w) => w.id || w.package || "");
        const hasCurrentWeather = widgetIds.some((id) =>
            /current-weather|CurrentWeather/i.test(id)
        );
        expect(hasCurrentWeather).toBe(true);
    });
});
