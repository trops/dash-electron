const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const AdmZip = require("adm-zip");
const { launchApp, closeApp } = require("../helpers/electron-app");
const {
    overrideOpenDialog,
    restoreFileDialogs,
} = require("../helpers/file-dialog-override");
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
 * Dashboard import — auto-install missing widgets from registry
 *
 * The big regression-magnet flow: when a user imports a dashboard
 * whose widgets are NOT yet installed locally, `processDashboardConfig`
 * walks `widgets[]`, calls `getPackage(packageName)`, and installs each
 * via `widgetRegistry.downloadWidget`. This spec exercises that
 * pipeline end-to-end:
 *
 *   1. Mock-registry serves `@trops/current-weather` with a file://
 *      downloadUrl pointing at a freshly-built widget zip on disk
 *      (registry's HTTPS check accepts file:// via `isLocalSource`).
 *   2. Hermetic launch — zero installed widgets to start.
 *   3. Import wizard runs against a dashboard zip that depends on
 *      `@trops/current-weather`.
 *   4. After import, the widget appears in the registry — proving
 *      auto-install ran.
 *
 * Pairs with `dashboard-import.spec.js` (no-deps variant) and
 * `dashboard-export.spec.js` (the other half of the round-trip).
 */

const FIXTURE_DIR = path.resolve(
    __dirname,
    "../../test/fixtures/folder-install-test/current-weather"
);

let electronApp;
let window;
let tempUserData;
let mockRegistryPort;
let widgetZipPath;
let dashboardZipPath;

const DASHBOARD_NAME = `Auto-Fetch Import ${Date.now()}`;

function buildWidgetZip(srcDir, destZip) {
    const zip = new AdmZip();
    function addDir(localDir, zipDir) {
        for (const entry of fs.readdirSync(localDir, { withFileTypes: true })) {
            const localPath = path.join(localDir, entry.name);
            const zipPath = zipDir ? `${zipDir}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                addDir(localPath, zipPath);
            } else if (entry.isFile()) {
                zip.addFile(zipPath, fs.readFileSync(localPath));
            }
        }
    }
    addDir(srcDir, "");
    zip.writeZip(destZip);
}

function buildDashboardZip(zipPath, dashboardName) {
    const config = {
        schemaVersion: "1.0.0",
        name: dashboardName,
        description: "E2E auto-fetch fixture",
        author: { name: "e2e", id: "e2e" },
        shareable: false,
        tags: ["test"],
        widgets: [
            {
                id: "current-weather.CurrentWeather",
                package: "@trops/current-weather",
                version: "1.0.0",
            },
        ],
        providers: [],
        eventWiring: [],
        workspace: {
            layout: [
                {
                    id: 1,
                    component: "CurrentWeather",
                    uuidString: "weather-1",
                },
            ],
        },
    };
    const zip = new AdmZip();
    zip.addFile(
        "dashboard.dashboard.json",
        Buffer.from(JSON.stringify(config, null, 2))
    );
    zip.writeZip(zipPath);
}

test.beforeAll(async () => {
    widgetZipPath = path.join(
        os.tmpdir(),
        `dash-e2e-current-weather-${Date.now()}.zip`
    );
    dashboardZipPath = path.join(
        os.tmpdir(),
        `dash-e2e-auto-fetch-${Date.now()}.zip`
    );

    buildWidgetZip(FIXTURE_DIR, widgetZipPath);
    buildDashboardZip(dashboardZipPath, DASHBOARD_NAME);

    mockRegistryPort = await startMockRegistry({ seedThemes: false });
    registerPackage({
        type: "widget",
        scope: "trops",
        name: "current-weather",
        version: "1.0.0",
        metadata: {
            displayName: "Current Weather",
            description: "Auto-fetch test widget",
            author: "trops",
            category: "weather",
            tags: ["test"],
            // file:// downloadUrl bypasses the HTTPS check via
            // widgetRegistry.isLocalSource → installFromLocalPath.
            downloadUrl: `file://${widgetZipPath}`,
            widgets: [
                {
                    name: "CurrentWeather",
                    displayName: "Current Weather",
                },
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
    await overrideOpenDialog(electronApp, {
        filePaths: [dashboardZipPath],
    });
});

test.afterAll(async () => {
    await restoreFileDialogs(electronApp);
    await clearAuthToken(electronApp);
    await closeApp(electronApp, { tempUserData });
    await stopMockRegistry();
    for (const p of [widgetZipPath, dashboardZipPath]) {
        try {
            if (p && fs.existsSync(p)) fs.unlinkSync(p);
        } catch (_) {}
    }
});

test("import a dashboard whose dependencies auto-install from the registry", async () => {
    await test.step("baseline: no widgets installed", async () => {
        const widgets = await window.evaluate(async () =>
            window.mainApi.widgets.list()
        );
        // `widget:list` returns ONLY installed widgets (built-ins live
        // in the renderer's ComponentManager and never appear here).
        // Hermetic launch starts with zero entries.
        expect((widgets || []).length).toBe(0);
    });

    await test.step("walk import wizard to completion", async () => {
        await window
            .locator("aside")
            .getByText("New Dashboard", { exact: true })
            .first()
            .click();
        await window.waitForTimeout(700);
        await window.getByRole("button", { name: /Import from File/ }).click();
        await window.waitForTimeout(700);
        await window
            .getByRole("button", { name: "Choose File", exact: true })
            .click();
        // ZIP parse + preview, then auto-install kicks in on Save.
        await window.waitForTimeout(2000);

        for (let i = 0; i < 3; i++) {
            const next = window.getByRole("button", {
                name: "Next",
                exact: true,
            });
            await expect(next).toBeVisible({ timeout: 5000 });
            await expect(next).toBeEnabled({ timeout: 5000 });
            await next.click();
            await window.waitForTimeout(700);
        }

        const save = window.getByRole("button", {
            name: "Save",
            exact: true,
        });
        await expect(save).toBeVisible({ timeout: 5000 });
        await save.click();
        // Auto-install runs against the mock-registry; allow time
        // for download + extract + register.
        await window.waitForTimeout(4000);
    });

    await test.step("widget auto-installed from mock-registry", async () => {
        const widgets = await window.evaluate(async () =>
            window.mainApi.widgets.list()
        );
        const names = (widgets || []).map((w) => w.name || "");
        // The package was registered as `@trops/current-weather`;
        // dash-core's installer stores it under that scoped key.
        const hasCurrentWeather = names.some((n) => /current-weather/i.test(n));
        expect(hasCurrentWeather).toBe(true);
    });

    await test.step("workspace was created on disk", async () => {
        const list = await window.evaluate(async () =>
            window.mainApi.workspace.listWorkspacesForApplication(
                "@trops/dash-electron"
            )
        );
        const names = (list?.workspaces || []).map((w) => w.name);
        expect(names).toContain(DASHBOARD_NAME);
    });
});
