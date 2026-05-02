const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Listener reconciliation — IPC contract guard
 *
 * The v0.0.470 reconciliation lives in the renderer (DashboardStage's
 * save flow), NOT in the IPC layer. The IPC handler
 * `saveWorkspaceForApplication` is a passthrough: whatever the
 * renderer sends, gets persisted verbatim. That's by design — moving
 * reconciliation to the IPC would risk silently masking renderer
 * bugs that mutate state with stale listeners.
 *
 * This spec freezes that contract. It writes a workspace with a
 * stale listener entry directly via IPC, reads it back, and asserts
 * the entry survived untouched.
 *
 * If a future change adds reconciliation to the IPC handler this
 * test fails. That's a meaningful event — either the reconciliation
 * boundary moved (update the test), or it crept in by accident
 * (revert it). Either way the change shouldn't land silently.
 *
 * Renderer-side reconciliation has dedicated unit-test coverage in
 * dash-core: `src/utils/workspaceReconciliation.test.js` (15+ cases
 * covering delete-widget, page nesting, sidebar, idempotency,
 * non-mutation, etc.). An e2e duplicate of those cases would just
 * re-run the same logic against the same fixtures — this IPC-level
 * spec catches the orthogonal failure mode (boundary drift) that
 * the unit tests can't.
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

test("workspace IPC save persists stale listener state untouched", async () => {
    const workspaceId = `e2e-recon-${Date.now()}`;
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
                listeners: {
                    onEvent: [staleListenerEntry],
                },
            },
        ],
        pages: [],
        version: Date.now(),
    };

    await test.step("save dirty workspace via IPC", async () => {
        const result = await window.evaluate(
            async ({ appId, ws }) =>
                window.mainApi.workspace.saveWorkspaceForApplication(appId, ws),
            { appId: APP_ID, ws: seedWorkspace }
        );
        expect(result.success).toBe(true);
    });

    await test.step("read back via IPC — stale listener still there", async () => {
        const list = await window.evaluate(
            async (appId) =>
                window.mainApi.workspace.listWorkspacesForApplication(appId),
            APP_ID
        );
        const ws = list.workspaces.find((w) => w.id === workspaceId);
        expect(ws).toBeTruthy();

        const recv = ws.layout.find((it) => it.id === "receiver-1");
        expect(recv).toBeTruthy();
        expect(recv.listeners?.onEvent).toEqual([staleListenerEntry]);
    });

    await test.step("clean up: delete the seeded workspace", async () => {
        await window.evaluate(
            async ({ appId, id }) =>
                window.mainApi.workspace.deleteWorkspaceForApplication(
                    appId,
                    id
                ),
            { appId: APP_ID, id: workspaceId }
        );
    });
});
