const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Workspace CRUD — IPC contract spec
 *
 * Pins the four behaviors of `mainApi.workspace.*` that every
 * Settings → Dashboards UX path depends on:
 *
 *   - list:    returns the persisted array (empty on hermetic boot)
 *   - save:    upserts by id (rename = save with same id; duplicate
 *              = save with a new id)
 *   - delete:  removes by id; idempotent on a missing id
 *
 * If any of these regresses, every dashboards-list flow breaks
 * silently — the renderer happily shows stale data and the user's
 * "Rename" / "Duplicate" / "Delete" buttons would no-op without an
 * error. Pinning at the IPC level catches that before it ever
 * reaches the UI.
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

test("save upserts by id; rename + duplicate + delete behave correctly", async () => {
    await test.step("baseline: empty workspaces list", async () => {
        const list = await window.evaluate(
            async (appId) =>
                window.mainApi.workspace.listWorkspacesForApplication(appId),
            APP_ID
        );
        expect(Array.isArray(list?.workspaces)).toBe(true);
        expect(list.workspaces.length).toBe(0);
    });

    await test.step("save a new workspace: list grows to 1", async () => {
        const r = await window.evaluate(
            async ({ appId, ws }) =>
                window.mainApi.workspace.saveWorkspaceForApplication(appId, ws),
            {
                appId: APP_ID,
                ws: {
                    id: 1001,
                    name: "Original",
                    menuId: "uncategorized",
                    layout: [],
                    pages: [],
                    version: 1,
                },
            }
        );
        expect(r?.success).toBe(true);

        const list = await window.evaluate(
            async (appId) =>
                window.mainApi.workspace.listWorkspacesForApplication(appId),
            APP_ID
        );
        expect(list.workspaces.length).toBe(1);
        expect(list.workspaces[0].id).toBe(1001);
        expect(list.workspaces[0].name).toBe("Original");
    });

    await test.step("rename: save with SAME id replaces in-place", async () => {
        const r = await window.evaluate(
            async ({ appId, ws }) =>
                window.mainApi.workspace.saveWorkspaceForApplication(appId, ws),
            {
                appId: APP_ID,
                ws: {
                    id: 1001,
                    name: "Renamed",
                    menuId: "uncategorized",
                    layout: [],
                    pages: [],
                    version: 2,
                },
            }
        );
        expect(r?.success).toBe(true);

        const list = await window.evaluate(
            async (appId) =>
                window.mainApi.workspace.listWorkspacesForApplication(appId),
            APP_ID
        );
        expect(list.workspaces.length).toBe(1);
        expect(list.workspaces[0].name).toBe("Renamed");
        expect(list.workspaces[0].version).toBe(2);
    });

    await test.step("duplicate: save with NEW id appends", async () => {
        const r = await window.evaluate(
            async ({ appId, ws }) =>
                window.mainApi.workspace.saveWorkspaceForApplication(appId, ws),
            {
                appId: APP_ID,
                ws: {
                    id: 1002,
                    name: "Renamed (Copy)",
                    menuId: "uncategorized",
                    layout: [],
                    pages: [],
                    version: 3,
                },
            }
        );
        expect(r?.success).toBe(true);

        const list = await window.evaluate(
            async (appId) =>
                window.mainApi.workspace.listWorkspacesForApplication(appId),
            APP_ID
        );
        expect(list.workspaces.length).toBe(2);
        const ids = list.workspaces.map((w) => w.id).sort();
        expect(ids).toEqual([1001, 1002]);
    });

    await test.step("delete: removes by id, list shrinks to 1", async () => {
        const r = await window.evaluate(
            async ({ appId, id }) =>
                window.mainApi.workspace.deleteWorkspaceForApplication(
                    appId,
                    id
                ),
            { appId: APP_ID, id: 1001 }
        );
        expect(r?.success).toBe(true);

        const list = await window.evaluate(
            async (appId) =>
                window.mainApi.workspace.listWorkspacesForApplication(appId),
            APP_ID
        );
        expect(list.workspaces.length).toBe(1);
        expect(list.workspaces[0].id).toBe(1002);
    });

    await test.step("delete: missing id is a no-op (no crash, list unchanged)", async () => {
        const r = await window.evaluate(
            async ({ appId, id }) =>
                window.mainApi.workspace.deleteWorkspaceForApplication(
                    appId,
                    id
                ),
            { appId: APP_ID, id: 9999 }
        );
        expect(r?.success).toBe(true);

        const list = await window.evaluate(
            async (appId) =>
                window.mainApi.workspace.listWorkspacesForApplication(appId),
            APP_ID
        );
        expect(list.workspaces.length).toBe(1);
        expect(list.workspaces[0].id).toBe(1002);
    });
});
