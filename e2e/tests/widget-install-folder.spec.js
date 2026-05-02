const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { launchApp, closeApp } = require("../helpers/electron-app");
const {
    overrideOpenDialog,
    restoreFileDialogs,
} = require("../helpers/file-dialog-override");

function copyDirSync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDirSync(s, d);
        else if (entry.isFile()) fs.copyFileSync(s, d);
    }
}

/**
 * Widget install — Load from Folder
 *
 * Exercises the file-dialog-override helper end-to-end. Without it
 * `Load from Folder` opens a native OS folder picker that Playwright
 * can't drive; with it the picker resolves immediately to our fixture
 * directory and the rest of the flow runs headless.
 *
 * Fixture: test/fixtures/folder-install-test/ contains 3 widget
 * packages (current-weather, weather-alerts, weekly-forecast). All
 * three should land in Settings → Widgets after the load.
 *
 * Selectors derived from `node scripts/explore-ui.js --to
 * settings.widgets.installPicker`.
 */

const FIXTURE_DIR = path.resolve(
    __dirname,
    "../../test/fixtures/folder-install-test"
);

const EXPECTED_WIDGETS = [
    "current-weather",
    "weather-alerts",
    "weekly-forecast",
];

let electronApp;
let window;
let tempUserData;

let tempFixtureDir;

test.beforeAll(async () => {
    // Copy the fixture into a tmp dir so that any subsequent widget
    // uninstall (which rm -rf's `widget.path`) cannot wipe the
    // tracked test/fixtures/ source.
    tempFixtureDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "dash-e2e-fixture-")
    );
    copyDirSync(FIXTURE_DIR, tempFixtureDir);

    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
    await overrideOpenDialog(electronApp, {
        filePaths: [tempFixtureDir],
    });
});

test.afterAll(async () => {
    await restoreFileDialogs(electronApp);
    await closeApp(electronApp, { tempUserData });
});

test("Load from Folder installs all widgets in the fixture directory", async () => {
    await test.step("open Settings → Widgets → Install picker", async () => {
        const sidebar = window.locator("aside");
        await sidebar.getByText("Account", { exact: true }).click();
        await window.waitForTimeout(500);
        await window
            .getByRole("button", { name: "Settings", exact: true })
            .first()
            .click();
        await window.waitForTimeout(1000);
        await window
            .getByRole("button", { name: "Widgets", exact: true })
            .first()
            .click();
        await window.waitForTimeout(500);
        await window.getByText("Install Widgets", { exact: true }).click();
        await window.waitForTimeout(500);

        await expect(
            window.getByText("Load from Folder", { exact: false })
        ).toBeVisible({ timeout: 5000 });
    });

    await test.step("trigger Load from Folder — file dialog returns fixture path", async () => {
        await window.getByRole("button", { name: /Load from Folder/i }).click();
        // The folder load runs async; install progress modal may
        // appear briefly. Wait for it to settle by polling the
        // widgets list for our expected names.
        await window.waitForTimeout(2000);
    });

    await test.step("all 3 fixture widgets appear in the Widgets list", async () => {
        for (const name of EXPECTED_WIDGETS) {
            await expect(
                window.getByText(name, { exact: false }).first()
            ).toBeVisible({ timeout: 15000 });
        }
    });
});
