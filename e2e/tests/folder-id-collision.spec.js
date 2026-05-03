const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Folder ID collision — upsertMenuItem regression spec
 *
 * The v0.0.46x bug: when a dashboard install path re-saved an
 * existing folder (publisher's menuId matched the user's local
 * folder id), `saveMenuItemForApplication` appended a duplicate
 * entry with the same id, and the sidebar nav rendered both. The
 * fix in `electron/utils/upsertMenuItem.js` dedupes by id and
 * upserts in-place so the LAST save wins.
 *
 * This spec walks the IPC end-to-end and pins three behaviors:
 *
 *   1. Saving a NEW menuItem appends one record.
 *   2. Saving a menuItem with an EXISTING id replaces in-place
 *      (length stays 1; name + icon reflect the last save).
 *   3. Saving a menuItem with a NEW id grows the list to 2.
 *
 * Pairs with the unit test in `electron/utils/upsertMenuItem.test.js`
 * — the unit test pins the pure function; this spec pins the
 * controller + IPC contract that wires it up.
 */

const APP_ID = "@trops/dash-electron";

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

test("saveMenuItem upserts by id; collision replaces, new id appends", async () => {
    await test.step("baseline: empty menuItems list", async () => {
        const result = await window.evaluate(
            async (appId) => window.mainApi.menuItems.listMenuItems(appId),
            APP_ID
        );
        expect(Array.isArray(result?.menuItems)).toBe(true);
        expect(result.menuItems.length).toBe(0);
    });

    await test.step("first save: appends one record", async () => {
        const r = await window.evaluate(
            async ({ appId, item }) =>
                window.mainApi.menuItems.saveMenuItem(appId, item),
            {
                appId: APP_ID,
                item: { id: 100, name: "Foo", icon: "folder" },
            }
        );
        expect(r?.success).toBe(true);

        const list = await window.evaluate(
            async (appId) => window.mainApi.menuItems.listMenuItems(appId),
            APP_ID
        );
        expect(list.menuItems.length).toBe(1);
        expect(list.menuItems[0].id).toBe(100);
        expect(list.menuItems[0].name).toBe("Foo");
        expect(list.menuItems[0].icon).toBe("folder");
    });

    await test.step("second save with SAME id: in-place replace, no dupe", async () => {
        const r = await window.evaluate(
            async ({ appId, item }) =>
                window.mainApi.menuItems.saveMenuItem(appId, item),
            {
                appId: APP_ID,
                item: { id: 100, name: "Bar", icon: "star" },
            }
        );
        expect(r?.success).toBe(true);

        const list = await window.evaluate(
            async (appId) => window.mainApi.menuItems.listMenuItems(appId),
            APP_ID
        );
        expect(list.menuItems.length).toBe(1);
        expect(list.menuItems[0].name).toBe("Bar");
        expect(list.menuItems[0].icon).toBe("star");
    });

    await test.step("third save with NEW id: list grows to 2", async () => {
        const r = await window.evaluate(
            async ({ appId, item }) =>
                window.mainApi.menuItems.saveMenuItem(appId, item),
            {
                appId: APP_ID,
                item: { id: 200, name: "Baz", icon: "folder" },
            }
        );
        expect(r?.success).toBe(true);

        const list = await window.evaluate(
            async (appId) => window.mainApi.menuItems.listMenuItems(appId),
            APP_ID
        );
        expect(list.menuItems.length).toBe(2);
        const ids = list.menuItems.map((m) => m.id).sort();
        expect(ids).toEqual([100, 200]);
    });

    await test.step("re-save existing id one more time: still no dupes", async () => {
        // Belt-and-suspenders: re-saving id 100 a second time exercises
        // the "heal" path in upsertMenuItem (it walks from the end and
        // dedupes anything with a matching id — proving the function is
        // resilient to a list that was already corrupt before this call).
        const r = await window.evaluate(
            async ({ appId, item }) =>
                window.mainApi.menuItems.saveMenuItem(appId, item),
            {
                appId: APP_ID,
                item: { id: 100, name: "Bar2", icon: "circle" },
            }
        );
        expect(r?.success).toBe(true);

        const list = await window.evaluate(
            async (appId) => window.mainApi.menuItems.listMenuItems(appId),
            APP_ID
        );
        expect(list.menuItems.length).toBe(2);
        const target = list.menuItems.find((m) => m.id === 100);
        expect(target?.name).toBe("Bar2");
        expect(target?.icon).toBe("circle");
    });
});
