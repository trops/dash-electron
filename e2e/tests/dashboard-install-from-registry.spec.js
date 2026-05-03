const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const AdmZip = require("adm-zip");
const { launchApp, closeApp } = require("../helpers/electron-app");
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
 * Dashboard install — from registry (IPC pipeline)
 *
 * Pairs with `dashboard-import-auto-fetch.spec.js`. Both end up at
 * `processDashboardConfig`, but enter through different code paths:
 *
 *   - import-auto-fetch: file dialog → ZIP on disk → import wizard
 *   - this spec:        registry GET → /api/packages/.../download
 *
 * Calls the install IPC directly (no Discover UI walk — that's a
 * separate concern). Verifies the registry download branch:
 *
 *   1. dashboard package zip arrives via the mock's download endpoint
 *   2. embedded .dashboard.json is parsed + validated
 *   3. workspace is created on disk
 *   4. missing widget dep is auto-installed via its file:// downloadUrl
 *
 * Together they pin both halves of the v0.0.46x install rewrite —
 * either side breaks, one of these two specs catches it.
 */

const APP_ID = "@trops/dash-electron";
const FIXTURE_WIDGET_DIR = path.resolve(
    __dirname,
    "../../test/fixtures/folder-install-test/current-weather"
);

let electronApp;
let window;
let tempUserData;
let mockRegistryPort;
let widgetZipPath;

const DASHBOARD_NAME = `Registry-Install Dashboard ${Date.now()}`;
const DASHBOARD_PACKAGE = "@trops/registry-install-dashboard";

function buildWidgetZipFromFolder(srcDir, destZip) {
    const zip = new AdmZip();
    function walk(localDir, zipDir) {
        for (const entry of fs.readdirSync(localDir, { withFileTypes: true })) {
            const localPath = path.join(localDir, entry.name);
            const zipPath = zipDir ? `${zipDir}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                walk(localPath, zipPath);
            } else if (entry.isFile()) {
                zip.addFile(zipPath, fs.readFileSync(localPath));
            }
        }
    }
    walk(srcDir, "");
    zip.writeZip(destZip);
}

function buildDashboardZipBuffer(dashboardName) {
    const config = {
        schemaVersion: "1.0.0",
        name: dashboardName,
        description: "Registry install fixture",
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
            name: dashboardName,
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
    return zip.toBuffer();
}

test.beforeAll(async () => {
    widgetZipPath = path.join(os.tmpdir(), `dash-e2e-cw-${Date.now()}.zip`);
    buildWidgetZipFromFolder(FIXTURE_WIDGET_DIR, widgetZipPath);

    mockRegistryPort = await startMockRegistry({ seedThemes: false });

    // Widget the dashboard depends on — auto-installed via file://
    // (HTTPS check bypass via widgetRegistry.isLocalSource).
    registerPackage({
        type: "widget",
        scope: "trops",
        name: "current-weather",
        version: "1.0.0",
        metadata: {
            displayName: "Current Weather",
            description: "Auto-install dep for registry-install dashboard",
            author: "trops",
            category: "weather",
            tags: ["test"],
            downloadUrl: `file://${widgetZipPath}`,
            widgets: [
                {
                    name: "CurrentWeather",
                    displayName: "Current Weather",
                },
            ],
        },
    });

    // Dashboard package — served via mock's
    // /api/packages/:scope/:name/download endpoint as raw zip bytes.
    registerPackage({
        type: "dashboard",
        scope: "trops",
        name: "registry-install-dashboard",
        version: "1.0.0",
        zipBuffer: buildDashboardZipBuffer(DASHBOARD_NAME),
        metadata: {
            displayName: DASHBOARD_NAME,
            description: "E2E registry install fixture",
            author: "trops",
            category: "general",
            tags: ["test"],
        },
    });

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
    try {
        if (widgetZipPath && fs.existsSync(widgetZipPath)) {
            fs.unlinkSync(widgetZipPath);
        }
    } catch (_) {}
});

test("install a dashboard from the registry via IPC", async () => {
    await test.step("baseline: zero installed widgets, no matching workspace", async () => {
        const widgets = await window.evaluate(async () =>
            window.mainApi.widgets.list()
        );
        expect((widgets || []).length).toBe(0);

        const list = await window.evaluate(
            async (appId) =>
                window.mainApi.workspace.listWorkspacesForApplication(appId),
            APP_ID
        );
        const names = (list?.workspaces || []).map((w) => w.name);
        expect(names).not.toContain(DASHBOARD_NAME);
    });

    await test.step("call installDashboardFromRegistry — succeeds", async () => {
        const result = await window.evaluate(
            async ({ appId, pkg }) =>
                window.mainApi.dashboardConfig.installDashboardFromRegistry(
                    appId,
                    pkg
                ),
            { appId: APP_ID, pkg: DASHBOARD_PACKAGE }
        );
        if (!result?.success) {
            throw new Error(
                `Install failed: ${result?.error || JSON.stringify(result)}`
            );
        }
        expect(result.success).toBe(true);
    });

    await test.step("workspace was created", async () => {
        const list = await window.evaluate(
            async (appId) =>
                window.mainApi.workspace.listWorkspacesForApplication(appId),
            APP_ID
        );
        const names = (list?.workspaces || []).map((w) => w.name);
        expect(names).toContain(DASHBOARD_NAME);
    });

    await test.step("widget dependency was auto-installed", async () => {
        const widgets = await window.evaluate(async () =>
            window.mainApi.widgets.list()
        );
        const names = (widgets || []).map((w) => w.name || "");
        const hasCurrentWeather = names.some((n) => /current-weather/i.test(n));
        expect(hasCurrentWeather).toBe(true);
    });
});
