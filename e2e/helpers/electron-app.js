const { _electron: electron } = require("playwright");
const path = require("path");
const fs = require("fs");
const os = require("os");

const ROOT = path.resolve(__dirname, "../..");

/**
 * Launch the Electron app in development mode.
 * Expects the React dev server to already be running at http://localhost:3000.
 *
 * @param {Object} [options] - Launch options
 * @param {Object} [options.env] - Additional environment variables to merge
 * @param {boolean} [options.hermetic=false]
 *   If true, launch with a fresh temp directory as the userData root via
 *   Chromium's `--user-data-dir` flag. The app boots with zero installed
 *   themes / dashboards / providers, signed out, with no recents — every
 *   run starts from the same clean slate. Returns `tempUserData` so the
 *   caller can pass it to `closeApp({ tempUserData })` for teardown.
 *   Default: false (uses the developer's actual user-data dir, matching
 *   the existing behavior of other specs).
 * @returns {{
 *   electronApp: import('playwright').ElectronApplication,
 *   window: import('playwright').Page,
 *   tempUserData: string | null
 * }}
 */
async function launchApp(options = {}) {
    const { env = {}, hermetic = false } = options;
    const args = [path.join(ROOT, "public/electron.js")];

    let tempUserData = null;
    if (hermetic) {
        tempUserData = fs.mkdtempSync(
            path.join(os.tmpdir(), "dash-e2e-userdata-")
        );
        // Chromium / Electron CLI flag — overrides app.getPath('userData').
        args.push(`--user-data-dir=${tempUserData}`);
    }

    const electronApp = await electron.launch({
        args,
        cwd: ROOT,
        env: {
            ...process.env,
            NODE_ENV: "development",
            // Tells public/electron.js to expose `require` on globalThis as
            // `__e2eRequire` so helpers can resolve modules from inside
            // the evaluate sandbox (where lexical require is unavailable).
            DASH_E2E: "1",
            ...env,
        },
    });

    // Wait for the first BrowserWindow to open
    const window = await electronApp.firstWindow();

    // Wait for React to mount
    await window.waitForSelector("#root > *", { timeout: 30000 });

    // Wait for the app to settle (sidebar, modals, etc.)
    await window.waitForTimeout(2000);

    // Dismiss the settings modal if it auto-opened (happens when no folders exist)
    const doneButton = window.getByText("Done", { exact: true });
    if (await doneButton.isVisible().catch(() => false)) {
        await doneButton.click();
        await window.waitForTimeout(500);
    }

    return { electronApp, window, tempUserData };
}

/**
 * Close the Electron app cleanly.
 *
 * @param {import('playwright').ElectronApplication} electronApp
 * @param {Object} [opts]
 * @param {string|null} [opts.tempUserData]
 *   If provided, the temp user-data dir created by `launchApp({ hermetic: true })`.
 *   Will be deleted recursively after the app closes. Errors swallowed.
 */
async function closeApp(electronApp, opts = {}) {
    if (electronApp) {
        await electronApp.close();
    }
    if (opts.tempUserData) {
        try {
            fs.rmSync(opts.tempUserData, { recursive: true, force: true });
        } catch (_) {
            /* best-effort cleanup */
        }
    }
}

module.exports = { launchApp, closeApp };
