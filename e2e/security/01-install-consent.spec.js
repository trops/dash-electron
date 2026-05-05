/**
 * 01-install-consent.spec.js
 *
 * Pins install-time consent: when a widget arrives via the local-install
 * IPC, the widgetRegistry's `maybeEmitMcpConsentRequired` should fire
 * `widget:mcp-consent-required` with the appropriate payload:
 *   - declared widget → declared block from package.json
 *   - unmanifested + scannable → discovered: true, scan-derived block
 *   - unmanifested + opaque → no event fires
 *
 * Asserts on the IPC payload directly via electronApp.evaluate; doesn't
 * exercise the modal UI (that's covered indirectly elsewhere via the
 * permission-required → JIT modal path).
 */
const { test, expect } = require("@playwright/test");
const path = require("path");
const { launchApp, closeApp } = require("../helpers/electron-app");
const { installLocalWidget, FIXTURES_DIR } = require("./helpers");

let electronApp;
let window;
let tempUserData;

/**
 * Subscribe to the consent-required IPC inside the renderer and
 * collect every payload into a global array. Tests then read the
 * array via evaluate().
 */
async function startCollectingConsentEvents(window) {
    await window.evaluate(async () => {
        global.__dashE2EConsentEvents = [];
        if (window.mainApi?.widgetMcp?.onConsentRequired) {
            window.mainApi.widgetMcp.onConsentRequired((payload) => {
                global.__dashE2EConsentEvents.push(payload);
            });
        }
    });
}

async function getConsentEvents(window) {
    return await window.evaluate(async () => {
        return (global.__dashE2EConsentEvents || []).slice();
    });
}

test.describe("install-time consent emit", () => {
    test.beforeEach(async () => {
        ({ electronApp, window, tempUserData } = await launchApp({
            hermetic: true,
        }));
        await startCollectingConsentEvents(window);
    });

    test.afterEach(async () => {
        await closeApp(electronApp, { tempUserData });
    });

    test("declared widget emits declared block", async () => {
        await installLocalWidget(
            window,
            path.join(FIXTURES_DIR, "declared-filesystem-reader"),
            "@e2e/declared-filesystem-reader"
        );
        await window.waitForTimeout(1000);

        const events = await getConsentEvents(window);
        expect(events.length).toBeGreaterThanOrEqual(1);
        const last = events[events.length - 1];
        expect(last.widgetId).toBe("@e2e/declared-filesystem-reader");
        expect(last.discovered).not.toBe(true);
        expect(last.declared.servers.filesystem.tools).toContain("read_file");
    });

    test("unmanifested + scannable emits discovered: true", async () => {
        await installLocalWidget(
            window,
            path.join(FIXTURES_DIR, "unmanifested-detectable"),
            "@e2e/unmanifested-detectable"
        );
        await window.waitForTimeout(1000);

        const events = await getConsentEvents(window);
        expect(events.length).toBeGreaterThanOrEqual(1);
        const last = events[events.length - 1];
        expect(last.widgetId).toBe("@e2e/unmanifested-detectable");
        expect(last.discovered).toBe(true);
        expect(last.declared.servers.filesystem.tools).toContain("read_file");
    });

    test("unmanifested + opaque source emits NO consent event", async () => {
        await installLocalWidget(
            window,
            path.join(FIXTURES_DIR, "unmanifested-opaque"),
            "@e2e/unmanifested-opaque"
        );
        await window.waitForTimeout(1000);

        const events = await getConsentEvents(window);
        // No event for this widget — scanner found nothing actionable.
        const matching = events.filter(
            (e) => e.widgetId === "@e2e/unmanifested-opaque"
        );
        expect(matching).toHaveLength(0);
    });
});
