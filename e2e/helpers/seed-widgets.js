/**
 * Widget seeding helper for E2E tests.
 *
 * Hermetic launch starts with an empty user-data dir — no installed
 * widgets. Specs that need real widgets in the layout (listener
 * reconciliation, widget uninstall, dashboard publish, etc.) call
 * `seedInstalledWidgets()` after launch to install fixture widget
 * packages via the same IPC the "Load from Folder" UI uses.
 *
 * IMPORTANT: `widget:load-folder` registers each widget with its
 * SOURCE path. If a test later uninstalls a widget, the registry's
 * `uninstallWidget` does `fs.rmSync(widget.path, { recursive: true })`
 * which would DELETE the original fixture files on disk. To prevent
 * test runs from corrupting tracked fixtures, this helper copies the
 * fixture dir into the OS temp folder before seeding, so the registry
 * points at an ephemeral copy. The temp dir is cleaned up by the OS.
 *
 * The fixture directory must contain one or more widget package
 * subdirectories, each with the standard structure:
 *
 *   <fixtureDir>/
 *     <packageName>/
 *       package.json
 *       widgets/
 *         <Component>.dash.js
 *         <Component>.js
 *       dist/
 *         index.cjs.js  (optional pre-built bundle)
 *
 * `test/fixtures/folder-install-test/` already follows this shape and
 * has 3 weather widgets (current-weather, weather-alerts,
 * weekly-forecast) — useful as a default fixture for any spec that
 * just needs SOME widgets installed without caring which.
 *
 * Usage:
 *
 *   const { seedInstalledWidgets } = require("../helpers/seed-widgets");
 *
 *   test.beforeAll(async () => {
 *     ({ electronApp, window, tempUserData } = await launchApp({
 *       hermetic: true,
 *     }));
 *     await seedInstalledWidgets(window, [
 *       path.resolve(__dirname, "../../test/fixtures/folder-install-test"),
 *     ]);
 *   });
 *
 * Each call returns the array of registered widget records (same
 * shape `mainApi.widgets.loadFolder` returns), so callers can assert
 * on what got installed if they care.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

function copyDirSync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirSync(s, d);
        } else if (entry.isFile()) {
            fs.copyFileSync(s, d);
        }
    }
}

/**
 * Install widget packages from one or more fixture directories.
 *
 * @param {import('@playwright/test').Page} window  Playwright Page handle
 *   for the launched Electron renderer (the `window` from launchApp).
 * @param {string[]} fixtureDirs  Absolute paths to directories that
 *   each contain widget package subdirectories.
 * @returns {Promise<Array<Object>>}  Array of widget records that
 *   were registered, flattened across all fixture dirs.
 */
async function seedInstalledWidgets(window, fixtureDirs) {
    if (!Array.isArray(fixtureDirs) || fixtureDirs.length === 0) {
        return [];
    }

    const all = [];
    for (const fixtureDir of fixtureDirs) {
        // Copy into a temp dir so an `Uninstall` from the test (which
        // rm -rf's `widget.path`) cannot wipe the tracked fixture.
        const tempDir = fs.mkdtempSync(
            path.join(os.tmpdir(), "dash-e2e-widgets-")
        );
        copyDirSync(fixtureDir, tempDir);

        const result = await window.evaluate(
            async (dir) => window.mainApi.widgets.loadFolder(dir),
            tempDir
        );
        if (Array.isArray(result)) {
            all.push(...result);
        }
    }

    // Give the renderer a beat to receive the `widgets:loaded` event
    // and update its registry-aware caches before tests interact with
    // the widget list.
    await window.waitForTimeout(500);

    return all;
}

module.exports = { seedInstalledWidgets };
