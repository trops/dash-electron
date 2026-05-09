const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Widget Builder — flow + console-error guard
 *
 * Why this exists: we've been iterating on the in-app widget builder
 * one regression at a time (provider not threading, dark preview,
 * wrong dash-react prop names, Dialog open=undefined console errors,
 * skill auto-load using Bash/Read/Glob tools). Each one was caught
 * by the user manually opening the modal, doing the thing, and
 * showing me a screenshot. This spec automates that loop:
 *
 *   1. Hermetic launch of the Electron app.
 *   2. Subscribe to renderer console errors AND the modal's own
 *      "[WidgetBuilderModal] suppressed error" log line (which
 *      surfaces caught-but-otherwise-invisible render failures).
 *   3. Open the widget builder via the `dash:open-widget-builder`
 *      custom event (same dispatcher Dash.js listens to in
 *      production, so the path matches a real button click).
 *   4. Wait for the modal to mount.
 *   5. Assert NO console errors and NO suppressed errors fired
 *      between launch and the assertion. Any future regression
 *      that shows up as a console error or as a caught render
 *      failure trips this assertion BEFORE the user has to file
 *      another bug.
 *
 * Out of scope (deliberately): provider seeding, sending a chat
 * message, asserting preview transitions out of EmptyState. Those
 * each need additional setup (mock-llm with a canned response,
 * provider seeding via electron-store) and can be layered on as
 * separate tests once this foundation lands. The console-error
 * guard alone catches the `Dialog open=undefined` class of bug,
 * mount-time crashes, and any new render error introduced by
 * future changes — which is exactly what we've been chasing.
 */

let electronApp;
let window;
let tempUserData;

// Errors captured between launch and the test's assertion. The
// console listener is attached in beforeAll and accumulates into
// this array; the test reads it at the end.
const consoleErrors = [];
const suppressedErrors = [];

test.beforeAll(async () => {
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));

    // Renderer-side console errors. `console.error(...)` from React
    // (PropTypes failures, error-boundary catches, the HeadlessUI
    // Dialog "open prop must be boolean" warning, etc.) all hit
    // this channel.
    window.on("console", (msg) => {
        const type = msg.type();
        const text = msg.text();
        if (type === "error") {
            consoleErrors.push(text);
        }
        // The widget-builder modal installs a global error handler
        // (see WidgetBuilderModal.js — installs window.error +
        // unhandledrejection listeners filtered to widget bundle
        // errors). When that handler catches something it logs
        // "[WidgetBuilderModal] suppressed error: <message>" via
        // console.warn. Capture those too — a suppressed error is
        // still a render bug we want to know about.
        if (type === "warning" && text.includes("[WidgetBuilderModal]")) {
            suppressedErrors.push(text);
        }
    });

    // Page-level uncaught errors (rare; usually bubble up as
    // console errors first, but caught here as a backstop).
    window.on("pageerror", (err) => {
        consoleErrors.push(String(err?.message || err));
    });
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
});

test("widget builder modal opens without console errors", async () => {
    await test.step("app reaches steady state after launch", async () => {
        // Wait for any startup chatter to settle. We don't assert
        // a specific selector here because the home view varies
        // by user-data (hermetic mode = empty state). A short
        // settle window is enough — the assertion at the end is
        // what actually catches regressions, not the wait itself.
        await window.waitForTimeout(2000);
    });

    await test.step("open the widget builder via dash:open-widget-builder event", async () => {
        // Same dispatcher the production code uses (see
        // Dash.js:512 — `window.addEventListener("dash:open-widget-builder", ...)`).
        // Fires the modal open without depending on a specific
        // sidebar/menu button location, which keeps the test
        // robust against UI-chrome refactors.
        await window.evaluate(() => {
            window.dispatchEvent(new CustomEvent("dash:open-widget-builder"));
        });
    });

    await test.step("modal mounts in the DOM", async () => {
        await expect(
            window.locator('[data-testid="widget-builder-modal"]')
        ).toBeAttached({ timeout: 10000 });
    });

    await test.step("no console errors and no suppressed errors fired", async () => {
        // Filter known noise from the global error pool. Specifically:
        //   - DevTools websocket and source-map warnings that
        //     don't represent app bugs.
        //   - `Failed to load resource: net::ERR_FILE_NOT_FOUND`
        //     for optional asset paths.
        // If a future regression introduces a real error AND it
        // matches one of these patterns, expand the test (don't
        // expand the filter).
        const noise = [
            /Failed to load resource:\s*net::ERR_/,
            /Download the React DevTools/,
            /sourcemap/i,
        ];
        const isNoise = (msg) => noise.some((re) => re.test(msg));
        const realErrors = consoleErrors.filter((m) => !isNoise(m));
        const realSuppressed = suppressedErrors;

        if (realErrors.length > 0 || realSuppressed.length > 0) {
            // Surface the actual errors in the failure output so
            // the next person reading the CI log knows what to
            // fix without re-running locally.
            const lines = [
                "Widget builder opened with console errors:",
                ...realErrors.map((m) => `  console.error: ${m}`),
                ...realSuppressed.map((m) => `  suppressed:    ${m}`),
            ];
            throw new Error(lines.join("\n"));
        }

        expect(realErrors).toEqual([]);
        expect(realSuppressed).toEqual([]);
    });
});
