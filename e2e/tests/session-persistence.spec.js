const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Session persistence — recents + open-tab state
 *
 * The QA plan calls out: "Quit and relaunch — last-active dashboard
 * reopens" and "Open via Command Palette (⌘K)". Both are powered by
 * the session controller (electron-store-backed):
 *
 *   - `recents`: ordered list of recently-opened dashboards. Drives
 *     the Command Palette's "recent" group + the empty-state recent
 *     panel.
 *   - `sessionState`: the open-tab IDs + active tab. Read on launch
 *     to restore which dashboards were open before quit.
 *
 * This spec pins the IPC contract for both:
 *
 *   1. Hermetic launch starts with empty recents + null state.
 *   2. addRecent appends + upserts (re-adding same workspaceId
 *      doesn't dupe; most recent is first).
 *   3. saveState round-trips through getState.
 *   4. clearState wipes state back to null.
 *
 * If any of these regresses, session restore breaks silently — the
 * user quits with 5 tabs open and reopens to a blank app, no error
 * surfaced. Pinning at the controller boundary catches that.
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

test("recents + sessionState round-trip through the IPC", async () => {
    await test.step("baseline: hermetic launch starts with empty recents + null state", async () => {
        const recents = await window.evaluate(async () =>
            window.mainApi.session.getRecents()
        );
        expect(Array.isArray(recents)).toBe(true);
        // Hermetic launch may have already added the auto-opened
        // welcome dashboard; clear and re-baseline.
        await window.evaluate(async () =>
            window.mainApi.session.clearRecents()
        );
        const recentsAfterClear = await window.evaluate(async () =>
            window.mainApi.session.getRecents()
        );
        expect(recentsAfterClear.length).toBe(0);

        const state = await window.evaluate(async () =>
            window.mainApi.session.getState()
        );
        // null OR an empty-ish state — both count as "no saved state".
        if (state !== null) {
            expect(state.openTabIds).toEqual([]);
        }
    });

    await test.step("addRecent: prepends new entries, most recent first", async () => {
        await window.evaluate(async () =>
            window.mainApi.session.addRecent("ws-001", "First Dashboard")
        );
        await window.evaluate(async () =>
            window.mainApi.session.addRecent("ws-002", "Second Dashboard")
        );
        await window.evaluate(async () =>
            window.mainApi.session.addRecent("ws-003", "Third Dashboard")
        );

        const recents = await window.evaluate(async () =>
            window.mainApi.session.getRecents()
        );
        expect(recents.length).toBe(3);
        // Most recent first.
        expect(recents[0].workspaceId).toBe("ws-003");
        expect(recents[1].workspaceId).toBe("ws-002");
        expect(recents[2].workspaceId).toBe("ws-001");
        // Each has a name + openedAt timestamp.
        expect(recents[0].name).toBe("Third Dashboard");
        expect(recents[0].openedAt).toBeTruthy();
    });

    await test.step("addRecent: re-adding same workspaceId upserts, no dupe", async () => {
        await window.evaluate(async () =>
            window.mainApi.session.addRecent(
                "ws-001",
                "First Dashboard Renamed"
            )
        );

        const recents = await window.evaluate(async () =>
            window.mainApi.session.getRecents()
        );
        expect(recents.length).toBe(3); // not 4
        // ws-001 is now most recent (re-added) with the new name.
        expect(recents[0].workspaceId).toBe("ws-001");
        expect(recents[0].name).toBe("First Dashboard Renamed");
        // Other entries shifted but still present.
        const ids = recents.map((r) => r.workspaceId);
        expect(ids).toContain("ws-002");
        expect(ids).toContain("ws-003");
    });

    await test.step("saveState + getState: round-trip preserves shape", async () => {
        await window.evaluate(async () =>
            window.mainApi.session.saveState(
                ["ws-001", "ws-002", "ws-003"],
                "ws-002"
            )
        );

        const state = await window.evaluate(async () =>
            window.mainApi.session.getState()
        );
        expect(state).toBeTruthy();
        expect(state.openTabIds).toEqual(["ws-001", "ws-002", "ws-003"]);
        expect(state.activeTabId).toBe("ws-002");
    });

    await test.step("clearState: wipes session state back to null", async () => {
        await window.evaluate(async () => window.mainApi.session.clearState());
        const state = await window.evaluate(async () =>
            window.mainApi.session.getState()
        );
        expect(state).toBeNull();
    });

    await test.step("clearRecents: wipes recents back to empty", async () => {
        await window.evaluate(async () =>
            window.mainApi.session.clearRecents()
        );
        const recents = await window.evaluate(async () =>
            window.mainApi.session.getRecents()
        );
        expect(recents.length).toBe(0);
    });
});
