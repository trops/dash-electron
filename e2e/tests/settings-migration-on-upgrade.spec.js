const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Settings migration on upgrade (Phase 2C).
 *
 * Pins the schema-migration framework end-to-end: a legacy
 * `settings.json` file (no `schemaVersion`) seeded into the user-data
 * directory BEFORE app launch is detected as v0, run through the
 * migration chain on first load, and re-written to disk stamped at
 * the current schema version.
 *
 * The migrator (`dash-core/electron/migrations/`) is the load-time
 * hook in `settingsController.getSettingsForApplication`. This spec
 * proves the round trip:
 *
 *   1. Seed pre-launch:  { theme: "dark" }                 (no version)
 *   2. After launch:     IPC returns settings with schemaVersion="1"
 *   3. After launch:     on-disk file rewritten with schemaVersion="1"
 *
 * Future schema changes only need to register a new migration in
 * dash-core's `migrations/registry.js`; existing installs auto-upgrade
 * on next launch.
 */

const APP_NAME = "Dashboard";
const SETTINGS_FILENAME = "settings.json";

const LEGACY_SETTINGS = {
    theme: "dark",
    sidebarCollapsed: false,
    autoSaveInterval: 30,
};

let electronApp;
let window;
let tempUserData;

test.beforeAll(async () => {
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
        seedUserData: (rootDir) => {
            // Plant a legacy settings file at the path the main process
            // reads (`<userData>/Dashboard/settings.json`). No
            // `schemaVersion` field — that's the un-versioned legacy
            // shape the migrator treats as v0.
            const dashboardDir = path.join(rootDir, APP_NAME);
            fs.mkdirSync(dashboardDir, { recursive: true });
            fs.writeFileSync(
                path.join(dashboardDir, SETTINGS_FILENAME),
                JSON.stringify(LEGACY_SETTINGS, null, 2),
                "utf-8"
            );
        },
    }));
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
});

test("legacy settings.json (no schemaVersion) is migrated on first load", async () => {
    // 1. The IPC settings load returns the migrated shape with the
    //    schemaVersion stamp + all of the original fields intact.
    const settingsView = await window.evaluate(() =>
        window.mainApi.settings.getSettingsForApplication()
    );
    expect(settingsView?.success).toBe(true);
    expect(settingsView.settings.schemaVersion).toBe("1");
    expect(settingsView.settings.theme).toBe("dark");
    expect(settingsView.settings.sidebarCollapsed).toBe(false);
    expect(settingsView.settings.autoSaveInterval).toBe(30);
});

test("migrated settings file is persisted back to disk", async () => {
    // 2. The on-disk file was re-written with the stamp. A subsequent
    //    launch would skip the migration entirely (idempotent), which
    //    is what we want — every settings load is fast in steady state.
    const filePath = path.join(tempUserData, APP_NAME, SETTINGS_FILENAME);
    const onDisk = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(onDisk.schemaVersion).toBe("1");
    expect(onDisk.theme).toBe("dark");
    expect(onDisk.sidebarCollapsed).toBe(false);
    expect(onDisk.autoSaveInterval).toBe(30);
});
