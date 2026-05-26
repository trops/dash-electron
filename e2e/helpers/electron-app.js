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
    const {
        env = {},
        hermetic = false,
        seedUserData = null,
        // Phase 3A shipped the first-run OnboardingModal which mounts
        // above every other surface (including the Settings modal's
        // Done button) whenever workspaces are empty + the
        // onboarding flag is unset. For specs that don't test the
        // onboarding flow itself, that modal blocks every interaction
        // and turns every hermetic spec red. Default the flag to
        // pre-completed for hermetic launches so existing specs keep
        // working; the dedicated onboarding spec
        // (first-run-onboarding-kitchen-sink.spec.js) bypasses
        // launchApp entirely and starts from a truly fresh state.
        seedOnboardingCompleted = true,
    } = options;
    const args = [path.join(ROOT, "public/electron.js")];

    let tempUserData = null;
    if (hermetic) {
        tempUserData = fs.mkdtempSync(
            path.join(os.tmpdir(), "dash-e2e-userdata-")
        );
        // Chromium / Electron CLI flag — overrides app.getPath('userData').
        args.push(`--user-data-dir=${tempUserData}`);

        // Pre-stamp the Phase 3A onboarding completion flag so the
        // first-run modal doesn't intercept this spec's interactions.
        // electron-store writes plain JSON at <userData>/<name>.json;
        // matches the shape onboardingController.markOnboardingCompleted
        // produces.
        if (seedOnboardingCompleted) {
            fs.writeFileSync(
                path.join(tempUserData, "dash-onboarding.json"),
                JSON.stringify(
                    {
                        onboarding: {
                            completed: true,
                            completedAt: new Date().toISOString(),
                            source: "e2e-test-harness",
                        },
                    },
                    null,
                    2
                ),
                "utf-8"
            );
        }

        // Suppress the auto-popping AppUpdatesModal for hermetic
        // launches. The modal mounts above every other surface when
        // `settings.checkForUpdatesOnLaunch !== false` AND the
        // registry has updates available — which happens any time a
        // spec seeds installed widgets at lower versions than the
        // mock registry. Specs that explicitly test the updates
        // modal (e.g. widget-update-badge.spec.js) navigate via the
        // Settings → Widgets surface, not the auto-popup.
        //
        // Settings live at <userData>/<APP_NAME>/<APP_ID>/settings.json
        // — we don't yet know the appId at this point, so write a
        // top-level settings file that mirrors the schema. The
        // settingsController will read whichever path is canonical for
        // the running app; if a spec seeds its own settings later via
        // seedUserData, that overrides this default.
        try {
            // settingsController writes to <userData>/Dashboard/settings.json
            // (NOT under the appId — confirmed via
            // settings-migration-on-upgrade.spec.js's seedUserData).
            const settingsDir = path.join(tempUserData, "Dashboard");
            fs.mkdirSync(settingsDir, { recursive: true });
            const settingsPath = path.join(settingsDir, "settings.json");
            if (!fs.existsSync(settingsPath)) {
                fs.writeFileSync(
                    settingsPath,
                    JSON.stringify({ checkForUpdatesOnLaunch: false }, null, 2),
                    "utf-8"
                );
            }
        } catch (_) {
            // Best-effort — if the dir layout differs the spec may
            // see the auto-popup, but that's the previous behavior.
        }

        // Seed-hook: lets specs write fixture files into the temp user-data
        // dir BEFORE the Electron process boots. Required by upgrade-style
        // tests (e.g. settings-migration-on-upgrade) that need a pre-existing
        // file the main process will read on its first load. The callback
        // receives the absolute tempUserData path; any sync I/O is fine here
        // since launch hasn't started yet.
        if (typeof seedUserData === "function") {
            await seedUserData(tempUserData);
        }
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

    // Auto-dismiss any modal that auto-pops on launch. Order matters:
    // the AppUpdatesModal (Phase 1B's auto-update notification) mounts
    // ABOVE the AppSettingsModal, so we have to clear the top one
    // first before the underneath one's "Done" button is reachable.
    //
    // The settings pre-seed above sets `checkForUpdatesOnLaunch=false`
    // which suppresses AppUpdatesModal in steady state, but the
    // effect that reads that flag races with the registry check on
    // some hermetic launches — clicking the dismiss here is the
    // race-proof fallback.
    const remindLater = window.getByRole("button", { name: "Remind me later" });
    if (await remindLater.isVisible().catch(() => false)) {
        await remindLater.click().catch(() => {});
        await window.waitForTimeout(500);
    }
    const doneButton = window.getByText("Done", { exact: true });
    if (await doneButton.isVisible().catch(() => false)) {
        await doneButton.click().catch(() => {});
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
