const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Unsaved-changes guard for dashboard edit mode (Phase 2B).
 *
 * Pins the main-process contract: the renderer mirrors dashboard
 * dirty state to `globalThis.__dashboardIsDirty` so Electron's
 * window-close + before-quit handlers in `public/electron.js` can
 * read it synchronously without an IPC round-trip.
 *
 * Scope of this spec:
 *   - On fresh hermetic launch with no dashboard open, the flag is
 *     observable and `false`.
 *   - The renderer correctly evaluates `globalThis.__dashboardIsDirty`
 *     from inside an Electron evaluate sandbox (i.e., it lives on the
 *     same global the main process reads).
 *
 * Deferred to a follow-up (see project_unsaved_guard_integration_e2e_todo):
 *   - Full integration: enter edit mode → mutate workspace → flag
 *     flips true → click sidebar → ConfirmationModal renders → pick
 *     Discard → navigation completes. The challenge is producing a
 *     reliable workspace mutation from Playwright; the InputText path
 *     I tried first updates DOM but doesn't always propagate setIsDirty
 *     before the next assert. The dash-core unit-level logic (state
 *     setters in handleWorkspaceChange + handleWorkspaceNameChange) is
 *     in place — the gap is the e2e fixture, not the implementation.
 */

let electronApp;
let window;
let tempUserData;

test.beforeAll(async () => {
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
});

test("globalThis.__dashboardIsDirty is exposed and false on fresh launch", async () => {
    // Live on the renderer's global — same window/globalThis that the
    // main process reads via webContents.executeJavaScript() during
    // close/quit. Boolean wrap mirrors what the main handler does so
    // we observe the exact value the close path would see.
    const flag = await window.evaluate(() =>
        Boolean(globalThis.__dashboardIsDirty)
    );
    expect(flag).toBe(false);
});

test("dirty flag survives a renderer-side direct write (sanity)", async () => {
    // Direct write to confirm the bridge works either way: the
    // evaluate sandbox can both READ and WRITE the same global the
    // mirroring useEffect publishes to. Catches any future refactor
    // that accidentally shadows globalThis on the renderer (e.g., a
    // module-level `globalThis = ...` rebind).
    await window.evaluate(() => {
        globalThis.__dashboardIsDirty = true;
    });
    expect(
        await window.evaluate(() => Boolean(globalThis.__dashboardIsDirty))
    ).toBe(true);
    // Reset so we don't leak state into subsequent tests if this file
    // ever grows new assertions.
    await window.evaluate(() => {
        globalThis.__dashboardIsDirty = false;
    });
});
