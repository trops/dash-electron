const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const AdmZip = require("adm-zip");
const { closeApp } = require("../helpers/electron-app");
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
 * First-run onboarding — Kitchen Sink install (Phase 3A).
 *
 * Pins the new-user activation path the audit flagged: a fresh
 * launch with zero workspaces, zero installed registry packages,
 * and no `onboarding.completed` flag MUST render the OnboardingModal.
 * The modal walks the user through installing the curated
 * `trops/kitchen-sink` dashboard from the registry; once dismissed
 * or completed, the modal MUST NOT re-appear on the next launch.
 *
 * The dashboard package itself is served by `mock-registry` — the
 * spec registers a minimal Kitchen Sink package (no widget deps, no
 * theme) so we exercise the OnboardingModal → install IPC →
 * workspace-creation path without dragging in the full multi-widget
 * install pipeline (covered by `dashboard-install-from-registry.spec.js`).
 *
 * The persistence half — that the flag survives a relaunch — is the
 * regression-pin against the prior bug class where first-run modals
 * would re-show after every restart.
 */

const APP_ID = "@trops/dash-electron";
const KITCHEN_SINK_WORKSPACE_NAME = `Kitchen Sink ${Date.now()}`;
const ONBOARDING_STORE_FILENAME = "dash-onboarding.json";
const FIXTURE_WIDGET_DIR = path.resolve(
    __dirname,
    "../../test/fixtures/folder-install-test/current-weather"
);

let electronApp;
let window;
let tempUserData;
let mockRegistryPort;
let widgetZipPath;

function buildWidgetZipFromFolder(srcDir, destZip) {
    const zip = new AdmZip();
    (function walk(localDir, zipDir) {
        for (const entry of fs.readdirSync(localDir, { withFileTypes: true })) {
            const localPath = path.join(localDir, entry.name);
            const zipPath = zipDir ? `${zipDir}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                walk(localPath, zipPath);
            } else if (entry.isFile()) {
                zip.addFile(zipPath, fs.readFileSync(localPath));
            }
        }
    })(srcDir, "");
    zip.writeZip(destZip);
}

function buildKitchenSinkZipBuffer(workspaceName) {
    // Minimal-but-valid dashboard config: one widget dep (auto-
    // installed during the install pipeline) + a single layout item.
    // The validator requires both `workspace.layout` to be non-empty
    // AND each widget to declare {id, package}, so we mirror the
    // shape used by dashboard-install-from-registry.spec.js.
    const config = {
        schemaVersion: "1.0.0",
        name: workspaceName,
        description: "First-run Kitchen Sink (e2e fixture)",
        author: { name: "trops", id: "trops" },
        shareable: false,
        tags: ["onboarding", "kitchen-sink"],
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
            name: workspaceName,
            layout: [
                {
                    id: 1,
                    component: "CurrentWeather",
                    uuidString: "ks-weather-1",
                },
            ],
        },
    };
    const zip = new AdmZip();
    zip.addFile(
        "kitchen-sink.dashboard.json",
        Buffer.from(JSON.stringify(config, null, 2))
    );
    return zip.toBuffer();
}

test.beforeAll(async () => {
    widgetZipPath = path.join(os.tmpdir(), `dash-e2e-ks-cw-${Date.now()}.zip`);
    buildWidgetZipFromFolder(FIXTURE_WIDGET_DIR, widgetZipPath);

    mockRegistryPort = await startMockRegistry({ seedThemes: false });
    registerPackage({
        type: "widget",
        scope: "trops",
        name: "current-weather",
        version: "1.0.0",
        metadata: {
            displayName: "Current Weather",
            description: "Auto-install dep for Kitchen Sink",
            author: "trops",
            category: "weather",
            tags: ["onboarding"],
            // file:// downloadUrl bypasses the HTTPS check via
            // widgetRegistry.isLocalSource (same trick as
            // dashboard-install-from-registry.spec.js).
            downloadUrl: `file://${widgetZipPath}`,
            widgets: [
                {
                    name: "CurrentWeather",
                    displayName: "Current Weather",
                },
            ],
        },
    });
    registerPackage({
        type: "dashboard",
        scope: "trops",
        name: "kitchen-sink",
        version: "1.0.0",
        zipBuffer: buildKitchenSinkZipBuffer(KITCHEN_SINK_WORKSPACE_NAME),
        metadata: {
            displayName: "Kitchen Sink",
            description: "Curated first-run dashboard.",
            author: "trops",
            category: "general",
            tags: ["onboarding"],
            icon: "sink",
        },
    });

    // Hand-rolled launch — we bypass launchApp() because its
    // auto-dismiss-Done helper races our OnboardingModal mount: the
    // helper tries to click the AppSettingsModal's "Done" button but
    // the onboarding modal sits on top and intercepts the pointer.
    // For this spec, the onboarding modal IS the empty-state — no
    // auto-dismiss needed.
    const { _electron: electron } = require("playwright");
    const ROOT = path.resolve(__dirname, "../..");
    tempUserData = fs.mkdtempSync(
        path.join(os.tmpdir(), "dash-e2e-onboarding-")
    );
    electronApp = await electron.launch({
        args: [
            path.join(ROOT, "public/electron.js"),
            `--user-data-dir=${tempUserData}`,
        ],
        cwd: ROOT,
        env: {
            ...process.env,
            NODE_ENV: "development",
            DASH_E2E: "1",
            DASH_REGISTRY_API_URL: `http://127.0.0.1:${mockRegistryPort}`,
        },
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector("#root > *", { timeout: 30000 });
    await window.waitForTimeout(2000);
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

test("first launch shows the onboarding modal", async () => {
    // The modal mounts after the first workspaces-load completes (the
    // gating effect waits for isLoadingWorkspaces to flip true→false).
    // Bounded wait covers the React mount + IPC round-trip on slow CI.
    const welcomeHeading = window.getByText("Welcome to Dash", {
        exact: false,
    });
    await expect(welcomeHeading).toBeVisible({ timeout: 15000 });

    // dash-react's Button strips data-* attrs, so we locate by visible
    // text instead.
    const installButton = window.getByRole("button", {
        name: /Install Kitchen Sink/i,
    });
    await expect(installButton).toBeVisible();
});

test("baseline: status reads as not-completed before install", async () => {
    const status = await window.evaluate(() =>
        window.mainApi.onboarding.getStatus()
    );
    expect(status).toEqual({
        completed: false,
        completedAt: null,
        source: null,
    });
});

test("install kitchen sink, open it, and persist the flag", async () => {
    // Drive the install. The progress list is best-effort to assert
    // on (an empty-layout dashboard with no widget deps emits zero
    // progress ticks), so we wait on the Done-state CTA instead.
    await window.getByRole("button", { name: /Install Kitchen Sink/i }).click();

    const openButton = window.getByRole("button", {
        name: /Open Kitchen Sink/i,
    });
    await expect(openButton).toBeVisible({ timeout: 30000 });

    // The workspace should exist on disk by now.
    const list = await window.evaluate(
        async (appId) =>
            window.mainApi.workspace.listWorkspacesForApplication(appId),
        APP_ID
    );
    const names = (list?.workspaces || []).map((w) => w.name);
    expect(names).toContain(KITCHEN_SINK_WORKSPACE_NAME);

    // Click "Open Kitchen Sink" — modal closes + flag is stamped.
    await openButton.click();

    // Modal gone.
    await expect(window.getByTestId("onboarding-modal")).toHaveCount(0);

    // Status now reflects completion with the kitchen-sink source.
    const status = await window.evaluate(() =>
        window.mainApi.onboarding.getStatus()
    );
    expect(status.completed).toBe(true);
    expect(status.source).toBe("kitchen-sink");
    expect(typeof status.completedAt).toBe("string");
});

test("onboarding store is persisted to disk", async () => {
    // The completion flag lives in electron-store at
    // `<userData>/dash-onboarding.json`. We don't pin the file
    // location across platforms beyond "somewhere under tempUserData"
    // — Electron's userData resolver varies between OSes, so we walk
    // the tree instead of hard-coding the relative path.
    let storeFile = null;
    function walk(dir) {
        if (storeFile) return;
        let entries = [];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (storeFile) return;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.name === ONBOARDING_STORE_FILENAME) {
                storeFile = full;
            }
        }
    }
    walk(tempUserData);
    expect(storeFile).not.toBeNull();

    const onDisk = JSON.parse(fs.readFileSync(storeFile, "utf-8"));
    expect(onDisk?.onboarding?.completed).toBe(true);
    expect(onDisk?.onboarding?.source).toBe("kitchen-sink");
});

test("relaunch does NOT re-show the onboarding modal", async () => {
    // Close cleanly, preserving tempUserData on disk so the second
    // launch picks up the stamped flag. We bypass launchApp() here
    // because its `hermetic:true` mode always mints a fresh user-data
    // dir — exactly what we don't want for this assertion.
    await electronApp.close();

    const { _electron: electron } = require("playwright");
    const ROOT = path.resolve(__dirname, "../..");
    electronApp = await electron.launch({
        args: [
            path.join(ROOT, "public/electron.js"),
            `--user-data-dir=${tempUserData}`,
        ],
        cwd: ROOT,
        env: {
            ...process.env,
            NODE_ENV: "development",
            DASH_E2E: "1",
            DASH_REGISTRY_API_URL: `http://127.0.0.1:${mockRegistryPort}`,
        },
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector("#root > *", { timeout: 30000 });
    await window.waitForTimeout(2000);

    // Modal MUST NOT mount this launch — flag is stamped + a
    // workspace already exists.
    await expect(window.getByTestId("onboarding-modal")).toHaveCount(0);

    // Status IPC still reflects the persisted completed flag.
    const status = await window.evaluate(() =>
        window.mainApi.onboarding.getStatus()
    );
    expect(status.completed).toBe(true);
    expect(status.source).toBe("kitchen-sink");
});
