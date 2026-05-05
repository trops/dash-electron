/**
 * 06-fs-domain.spec.js
 *
 * Phase 2 of JIT consent — covers the filesystem domain end-to-end:
 * `mainApi.data.saveData` and `mainApi.data.readData` (the two
 * widget-facing IPC channels in this slice).
 *
 * Pins:
 *   - No fs grant + JIT off + enforcement on → call denied silently
 *   - No fs grant + JIT on → JIT modal pops; approve persists grant
 *     under domains.fs; retry succeeds
 *   - Granted with matching filename → call succeeds without prompting
 *   - Cross-widget isolation: widget A's grant doesn't help widget B
 */
const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");
const { setSecurityFlags, seedGrant, readAllGrants } = require("./helpers");

let electronApp;
let window;
let tempUserData;

async function triggerSaveData(window, { widgetId, filename, data }) {
    return await window.evaluate(
        async ({ widgetId, filename, data }) => {
            return new Promise((resolve) => {
                const eApi = window.mainApi;
                const onComplete = (_e, response) => {
                    eApi.removeAllListeners(
                        eApi.events.DATA_SAVE_TO_FILE_COMPLETE
                    );
                    eApi.removeAllListeners(
                        eApi.events.DATA_SAVE_TO_FILE_ERROR
                    );
                    resolve({ success: true, response });
                };
                const onError = (_e, response) => {
                    eApi.removeAllListeners(
                        eApi.events.DATA_SAVE_TO_FILE_COMPLETE
                    );
                    eApi.removeAllListeners(
                        eApi.events.DATA_SAVE_TO_FILE_ERROR
                    );
                    resolve({ success: false, response });
                };
                eApi.on(eApi.events.DATA_SAVE_TO_FILE_COMPLETE, onComplete);
                eApi.on(eApi.events.DATA_SAVE_TO_FILE_ERROR, onError);
                eApi.data.saveData(data, filename, false, {}, widgetId);
                // Safety timeout in case neither event fires
                setTimeout(
                    () =>
                        resolve({
                            success: false,
                            response: { message: "test-timeout-no-event" },
                        }),
                    8000
                );
            });
        },
        { widgetId, filename, data }
    );
}

test.describe("fs domain (Phase 2 JIT consent)", () => {
    test.beforeEach(async () => {
        ({ electronApp, window, tempUserData } = await launchApp({
            hermetic: true,
        }));
    });

    test.afterEach(async () => {
        await closeApp(electronApp, { tempUserData });
    });

    test("no fs grant + JIT off → saveData denied, error event sent", async () => {
        await setSecurityFlags(electronApp, { enforce: true, jit: false });
        const result = await triggerSaveData(window, {
            widgetId: "@e2e/fs-no-grant",
            filename: "x.json",
            data: { hello: "world" },
        });
        expect(result.success).toBe(false);
        expect(result.response?.message || "").toMatch(
            /no fs permissions granted|fs permission gate/i
        );
    });

    test("seeded fs grant for filename → saveData succeeds, no prompt", async () => {
        await setSecurityFlags(electronApp, { enforce: true, jit: false });
        await seedGrant(electronApp, "@e2e/fs-granted", {
            grantOrigin: "manual",
            servers: {},
            domains: {
                fs: { readPaths: [], writePaths: ["allowed.json"] },
            },
        });
        const result = await triggerSaveData(window, {
            widgetId: "@e2e/fs-granted",
            filename: "allowed.json",
            data: { ok: true },
        });
        expect(result.success).toBe(true);
    });

    test("seeded grant but different filename → denied", async () => {
        await setSecurityFlags(electronApp, { enforce: true, jit: false });
        await seedGrant(electronApp, "@e2e/fs-narrow", {
            grantOrigin: "manual",
            servers: {},
            domains: {
                fs: { readPaths: [], writePaths: ["only-this.json"] },
            },
        });
        const result = await triggerSaveData(window, {
            widgetId: "@e2e/fs-narrow",
            filename: "different.json",
            data: { ok: true },
        });
        expect(result.success).toBe(false);
        expect(result.response?.message || "").toMatch(
            /not in.*writePaths|filename.*rejected/i
        );
    });

    test("cross-widget isolation: widget A's grant doesn't help widget B", async () => {
        await setSecurityFlags(electronApp, { enforce: true, jit: false });
        await seedGrant(electronApp, "@e2e/fs-widget-a", {
            grantOrigin: "manual",
            servers: {},
            domains: { fs: { readPaths: [], writePaths: ["shared.json"] } },
        });
        // Widget B has NO grant
        const result = await triggerSaveData(window, {
            widgetId: "@e2e/fs-widget-b",
            filename: "shared.json",
            data: { x: 1 },
        });
        expect(result.success).toBe(false);
        expect(result.response?.message || "").toMatch(
            /no fs permissions granted/i
        );
    });

    test("JIT on + approve → grant persists with domains.fs and retry succeeds", async () => {
        await setSecurityFlags(electronApp, { enforce: true, jit: true });
        // Fire the call asynchronously — it'll block until we approve
        const callPromise = triggerSaveData(window, {
            widgetId: "@e2e/fs-jit-widget",
            filename: "jit-test.json",
            data: { hello: "jit" },
        });

        // Wait for the JIT modal
        await window
            .getByText(/Permission requested/i)
            .waitFor({ state: "visible", timeout: 5000 });
        // Click "Allow saveToFile for jit-test.json"
        await window
            .getByRole("button", {
                name: /Allow saveToFile for jit-test\.json/i,
            })
            .click();

        const result = await callPromise;
        expect(result.success).toBe(true);

        const grants = await readAllGrants(electronApp);
        expect(grants["@e2e/fs-jit-widget"]).toBeTruthy();
        expect(grants["@e2e/fs-jit-widget"].grantOrigin).toBe("live");
        expect(grants["@e2e/fs-jit-widget"].domains?.fs?.writePaths).toContain(
            "jit-test.json"
        );
    });
});
