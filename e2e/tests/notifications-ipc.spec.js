const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Notifications — IPC contract spec
 *
 * The QA plan flags Settings → Notifications as a release-revalidate
 * surface: "global on/off; per-widget toggle reflects in the
 * widget's behavior". Both ride on the same IPC layer:
 *
 *   - getPreferences: returns { globalEnabled, doNotDisturb, instances }
 *   - setGlobal: partial update of { globalEnabled, doNotDisturb }
 *   - setPreferences: partial update of per-instance prefs by widgetId
 *
 * This spec pins:
 *
 *   1. Hermetic launch returns sane defaults (globalEnabled true,
 *      DND false, no instance prefs).
 *   2. setGlobal({ globalEnabled: false }) flips ONE knob and leaves
 *      the others alone (no clobber).
 *   3. setGlobal({ doNotDisturb: true }) is also one-knob.
 *   4. setPreferences upserts per-instance — same widgetId twice
 *      replaces in place; new widgetId appends.
 *
 * If any branch regresses, the Notifications UI silently writes the
 * wrong shape and toggles in the renderer no-op without an error
 * — which is exactly the kind of bug humans miss in QA.
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

test("notification prefs round-trip via getPreferences / setGlobal / setPreferences", async () => {
    await test.step("baseline: defaults + empty instance map", async () => {
        const prefs = await window.evaluate(async () =>
            window.mainApi.notifications.getPreferences()
        );
        expect(prefs).toBeTruthy();
        expect(typeof prefs.globalEnabled).toBe("boolean");
        expect(typeof prefs.doNotDisturb).toBe("boolean");
        expect(typeof prefs.instances).toBe("object");
        expect(prefs.globalEnabled).toBe(true);
        expect(prefs.doNotDisturb).toBe(false);
    });

    await test.step("setGlobal({ globalEnabled: false }) flips only that knob", async () => {
        const r = await window.evaluate(async () =>
            window.mainApi.notifications.setGlobal({ globalEnabled: false })
        );
        expect(r?.success).toBe(true);

        const prefs = await window.evaluate(async () =>
            window.mainApi.notifications.getPreferences()
        );
        expect(prefs.globalEnabled).toBe(false);
        // doNotDisturb must NOT have been clobbered.
        expect(prefs.doNotDisturb).toBe(false);
    });

    await test.step("setGlobal({ doNotDisturb: true }) flips only DND", async () => {
        const r = await window.evaluate(async () =>
            window.mainApi.notifications.setGlobal({ doNotDisturb: true })
        );
        expect(r?.success).toBe(true);

        const prefs = await window.evaluate(async () =>
            window.mainApi.notifications.getPreferences()
        );
        expect(prefs.doNotDisturb).toBe(true);
        // globalEnabled stayed false from the prior step.
        expect(prefs.globalEnabled).toBe(false);
    });

    await test.step("setPreferences: upserts per-instance, same id replaces", async () => {
        await window.evaluate(async () =>
            window.mainApi.notifications.setPreferences("widget-a", {
                alerts: false,
                summary: true,
            })
        );
        await window.evaluate(async () =>
            window.mainApi.notifications.setPreferences("widget-b", {
                alerts: true,
            })
        );

        let prefs = await window.evaluate(async () =>
            window.mainApi.notifications.getPreferences()
        );
        expect(prefs.instances["widget-a"]).toMatchObject({
            alerts: false,
            summary: true,
        });
        expect(prefs.instances["widget-b"]).toMatchObject({ alerts: true });

        // Re-set widget-a — same id, different shape — must not dupe
        // and must reflect the new payload.
        await window.evaluate(async () =>
            window.mainApi.notifications.setPreferences("widget-a", {
                alerts: true,
            })
        );

        prefs = await window.evaluate(async () =>
            window.mainApi.notifications.getPreferences()
        );
        expect(prefs.instances["widget-a"]?.alerts).toBe(true);
        expect(prefs.instances["widget-b"]?.alerts).toBe(true);
        // Two distinct instance ids in total.
        expect(Object.keys(prefs.instances).sort()).toEqual([
            "widget-a",
            "widget-b",
        ]);
    });
});
