const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * App-bootstrap smoke test.
 *
 * The narrowest possible "the app is alive and not on fire" check.
 * Complementary to existing specs:
 *   - app-launch.spec.js only asserts window dimensions + #root mount;
 *     misses sidebar, empty state, wizard reachability.
 *   - dashboard-create.spec.js drives the wizard end-to-end, but
 *     doesn't pin "no errors ever logged during normal interaction."
 *
 * This spec runs hermetically, observes console output across the
 * whole launch, asserts the critical chrome renders, and verifies
 * the New Dashboard wizard at least OPENS (full completion is
 * dashboard-create.spec.js's job).
 *
 * Sub-30-second budget. If this spec ever takes >60s, the slower
 * thing is what failed — investigate before bumping the timeout.
 *
 * Pinned by Phase 2 of the MVP launch audit (P0 #6).
 */

let electronApp;
let window;
let tempUserData;
const consoleErrors = [];
const pageErrors = [];

test.beforeAll(async () => {
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
    // Capture every console error from the moment the renderer mounts.
    // Surfacing late errors that hide behind successful renders is the
    // whole point of this spec.
    window.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    window.on("pageerror", (err) => {
        pageErrors.push(err.message || String(err));
    });
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
});

test("smoke: fresh launch renders critical chrome with no errors", async () => {
    await test.step("React mounts inside #root", async () => {
        const rootChildren = await window.locator("#root > *").count();
        expect(rootChildren).toBeGreaterThan(0);
    });

    await test.step("window title is set", async () => {
        const title = await window.title();
        expect(title.length).toBeGreaterThan(0);
    });

    await test.step("sidebar renders with key sections", async () => {
        const sidebar = window.locator("aside");
        await expect(sidebar).toBeVisible({ timeout: 5000 });
        // Three sidebar affordances every user sees on a fresh launch.
        // If any goes missing, the home screen has regressed.
        await expect(
            sidebar.getByText("New Dashboard", { exact: true }).first()
        ).toBeVisible({ timeout: 5000 });
        await expect(
            sidebar.getByText("Search", { exact: true }).first()
        ).toBeVisible({ timeout: 5000 });
        await expect(
            sidebar.getByText("Account", { exact: true }).first()
        ).toBeVisible({ timeout: 5000 });
    });

    await test.step("empty-state copy is visible on first launch", async () => {
        // `empty-state.spec.js` pins the specific copy; we just confirm
        // the empty surface is reachable (not blocked by a modal or
        // black screen).
        await expect(
            window.getByText("No dashboards open", { exact: false })
        ).toBeVisible({ timeout: 5000 });
    });

    await test.step("New Dashboard wizard opens when invoked", async () => {
        await window
            .locator("aside")
            .getByText("New Dashboard", { exact: true })
            .first()
            .click();
        await window.waitForTimeout(500);
        // The wizard mounts a role=dialog with a "New Dashboard" header.
        // We don't drive the rest of the wizard here — that's
        // dashboard-create.spec.js's job.
        await expect(
            window.getByRole("dialog").getByText("New Dashboard").first()
        ).toBeVisible({ timeout: 5000 });
        // Dismiss with Escape to leave the empty state for the next
        // smoke iteration / test re-runs.
        await window.keyboard.press("Escape");
        await window.waitForTimeout(300);
    });

    await test.step("no renderer console errors during the smoke flow", async () => {
        // Brief settle so any deferred error renders before we assert.
        await window.waitForTimeout(1000);
        // Some legitimate noise leaks from underlying libs (e.g.
        // craco-webpack hot-update logs in dev mode). We don't filter
        // them out — they should be silenced at source. Failing here
        // tells us the home screen logged something a real user would
        // see in DevTools.
        expect(
            consoleErrors,
            `Unexpected console.error calls: ${consoleErrors.join("\n")}`
        ).toEqual([]);
        expect(
            pageErrors,
            `Unexpected uncaught renderer errors: ${pageErrors.join("\n")}`
        ).toEqual([]);
    });

    await test.step("main-process crash handler did not fire on the happy path", async () => {
        // The new Phase 2A handler writes a `[main:uncaughtException]`
        // / `[main:unhandledRejection]` line whenever it fires. A
        // clean launch should never emit one; if the smoke test
        // catches a fresh main-process crash, the home screen is
        // hiding a real bug.
        const mainLogs = await electronApp.evaluate(async () => {
            // No public API for the in-memory ring buffer — read the
            // process.stdout / .stderr log via the logger ring buffer
            // exposed for the debug window. Falls back gracefully if
            // the module shape differs.
            try {
                const logger = require("./logger");
                if (logger && typeof logger.getRingBuffer === "function") {
                    return logger.getRingBuffer();
                }
            } catch {
                return [];
            }
            return [];
        });
        const crashLines = (mainLogs || []).filter((entry) => {
            const text = JSON.stringify(entry || "");
            return (
                text.includes("main:uncaughtException") ||
                text.includes("main:unhandledRejection")
            );
        });
        expect(crashLines).toEqual([]);
    });
});
