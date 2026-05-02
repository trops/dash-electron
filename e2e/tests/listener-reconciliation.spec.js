const { test, expect } = require("@playwright/test");
const path = require("path");
const { launchApp, closeApp } = require("../helpers/electron-app");
const { seedInstalledWidgets } = require("../helpers/seed-widgets");

/**
 * Listener reconciliation — v0.0.470 regression spec
 *
 * The bug we shipped: when a widget was deleted from a dashboard,
 * surviving widgets' `item.listeners` arrays still carried event-
 * string references pointing at the deleted widget. Runtime silently
 * no-opped because the source couldn't be found, but the stale data
 * accumulated in saved workspaces.
 *
 * The fix: `reconcileWorkspaceAfterLayoutChange` runs in every
 * DashboardStage save path in the renderer, dropping listener
 * entries that reference widgets no longer in the layout.
 *
 * This spec catches BOTH failure modes the regression could come
 * back as:
 *
 *   Test 1 (IPC contract guard):
 *     The IPC layer is a passthrough — no reconciliation. If a future
 *     change adds reconciliation to the IPC handler, that's worth
 *     knowing about (silent masking of renderer bugs).
 *
 *   Test 2 (renderer save flow):
 *     Seed a workspace with a stale listener, drive the renderer
 *     through Edit → Save, read back, assert the stale entry got
 *     dropped. If `reconcileWorkspaceAfterLayoutChange` ever stops
 *     running in DashboardStage's save flow, this fails.
 *
 * Together they pin both sides of the boundary the v0.0.470 fix
 * established.
 */

const APP_ID = "@trops/dash-electron";
const FIXTURE_DIR = path.resolve(
    __dirname,
    "../../test/fixtures/folder-install-test"
);

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

test("workspace IPC save persists stale listener state untouched", async () => {
    const workspaceId = `e2e-recon-ipc-${Date.now()}`;
    const staleListenerEntry =
        "EventSenderWidget[sender-not-in-layout].someEvent";

    const seedWorkspace = {
        id: workspaceId,
        name: "Listener Reconciliation IPC Test",
        menuId: "uncategorized",
        themeKey: "default-1",
        scrollable: false,
        sidebar: false,
        layout: [
            {
                component: "EventReceiverWidget",
                uuidString: "receiver-1",
                id: "receiver-1",
                listeners: { onEvent: [staleListenerEntry] },
            },
        ],
        pages: [],
        version: Date.now(),
    };

    const result = await window.evaluate(
        async ({ appId, ws }) =>
            window.mainApi.workspace.saveWorkspaceForApplication(appId, ws),
        { appId: APP_ID, ws: seedWorkspace }
    );
    expect(result.success).toBe(true);

    const list = await window.evaluate(
        async (appId) =>
            window.mainApi.workspace.listWorkspacesForApplication(appId),
        APP_ID
    );
    const ws = list.workspaces.find((w) => w.id === workspaceId);
    expect(ws).toBeTruthy();
    const recv = ws.layout.find((it) => it.id === "receiver-1");
    expect(recv?.listeners?.onEvent).toEqual([staleListenerEntry]);

    // Clean up so the next test starts from a known sidebar state.
    await window.evaluate(
        async ({ appId, id }) =>
            window.mainApi.workspace.deleteWorkspaceForApplication(appId, id),
        { appId: APP_ID, id: workspaceId }
    );
});

test("renderer save flow reconciles stale listeners on a dashboard", async () => {
    // Seed real widgets so the dashboard renders without "Widget Not
    // Found" placeholders that would block UI navigation.
    await seedInstalledWidgets(window, [FIXTURE_DIR]);

    const workspaceId = `e2e-recon-ui-${Date.now()}`;
    const dashboardName = `Recon UI Test ${Date.now()}`;
    const staleListenerEntry = "GhostSender[sender-not-in-layout].ghostEvent";

    await test.step("seed a workspace with a CurrentWeather widget + stale listener", async () => {
        const ws = {
            id: workspaceId,
            name: dashboardName,
            menuId: "uncategorized",
            themeKey: "default-1",
            scrollable: false,
            sidebar: false,
            layout: [
                {
                    component: "CurrentWeather",
                    uuidString: "weather-1",
                    id: "weather-1",
                    listeners: { onEvent: [staleListenerEntry] },
                },
            ],
            pages: [],
            version: Date.now(),
        };
        const r = await window.evaluate(
            async ({ appId, w }) =>
                window.mainApi.workspace.saveWorkspaceForApplication(appId, w),
            { appId: APP_ID, w: ws }
        );
        expect(r.success).toBe(true);
    });

    await test.step("reload renderer so the workspace appears in the sidebar", async () => {
        await window.reload();
        await window.waitForSelector("#root > *", { timeout: 30000 });
        await window.waitForTimeout(2500);
        // Dismiss any auto-modal.
        const done = window.getByText("Done", { exact: true });
        if (await done.isVisible().catch(() => false)) {
            await done.click();
            await window.waitForTimeout(500);
        }
    });

    await test.step("open the dashboard from the sidebar", async () => {
        await window
            .locator("aside")
            .getByText(dashboardName, { exact: true })
            .first()
            .click();
        await window.waitForTimeout(1500);
    });

    await test.step("click the pencil (Edit) icon to enter edit mode", async () => {
        // Header icon buttons are FontAwesomeIcon-rendered with no
        // accessible name; target the button containing the pencil
        // svg's data-icon attribute.
        const editBtn = window
            .locator('button:has([data-icon="pencil"])')
            .first();
        await expect(editBtn).toBeVisible({ timeout: 5000 });
        await editBtn.click();
        await window.waitForTimeout(800);
        // Confirm we're in edit mode — Save button visible.
        await expect(
            window.getByRole("button", { name: "Save", exact: true })
        ).toBeVisible({ timeout: 5000 });
    });

    await test.step("click Save — renderer save flow runs reconciliation", async () => {
        await window.getByRole("button", { name: "Save", exact: true }).click();
        await window.waitForTimeout(2000);
    });

    await test.step("read back via IPC — stale listener should be gone", async () => {
        const list = await window.evaluate(
            async (appId) =>
                window.mainApi.workspace.listWorkspacesForApplication(appId),
            APP_ID
        );
        const ws = list.workspaces.find((w) => w.id === workspaceId);
        expect(ws).toBeTruthy();
        const weather = ws.layout.find(
            (it) => it.uuidString === "weather-1" || it.id === "weather-1"
        );
        expect(weather).toBeTruthy();

        // Reconciliation should have dropped the stale entry. Either
        // the listeners object is gone entirely (when its only entry
        // was stale and the handler array is now empty), or the
        // onEvent key is gone, or the array no longer contains the
        // stale string. Any of those means reconciliation ran.
        const onEvent = weather.listeners?.onEvent || [];
        expect(onEvent).not.toContain(staleListenerEntry);
    });
});
