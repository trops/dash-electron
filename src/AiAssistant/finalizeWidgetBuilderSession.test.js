/**
 * @jest-environment jsdom
 */
/**
 * The end of a Widget Builder session, shared by the builder's own window and
 * the builder inside Create: register the bundle, refresh the widget lists,
 * then swap (Edit with AI) or place (empty cell) — and the remount guard.
 */
import {
    finalizeWidgetBuilderSession,
    markWidgetBuilderActive,
    primeWidgetBuilderChat,
    resetWidgetBuilderSessionState,
    suppressStageRemount,
    widgetBuilderBlocksRemount,
} from "./finalizeWidgetBuilderSession";

const INSTALLED = {
    componentName: "ai-built.clock.Clock",
    scopedName: "@ai-built/clock",
};

let events;
const record = (e) => events.push({ type: e.type, detail: e.detail });
const TYPES = [
    "dash:widgets-updated",
    "dash:widget-installed",
    "dash:swap-widget-in-cell",
    "dash:place-widget-in-cell",
];

beforeEach(() => {
    events = [];
    TYPES.forEach((t) => window.addEventListener(t, record));
    window.mainApi = {
        widgets: {
            readBundle: jest.fn().mockResolvedValue({
                success: true,
                source: "module.exports={}",
            }),
        },
        llm: { endCliSession: jest.fn() },
    };
    resetWidgetBuilderSessionState();
});
afterEach(() => {
    TYPES.forEach((t) => window.removeEventListener(t, record));
    delete window.mainApi;
});

describe("finalizeWidgetBuilderSession", () => {
    test("nothing installed → nothing happens", async () => {
        const registerBundle = jest.fn();
        await finalizeWidgetBuilderSession({ installed: null, registerBundle });
        expect(window.mainApi.widgets.readBundle).not.toHaveBeenCalled();
        expect(registerBundle).not.toHaveBeenCalled();
        expect(events).toEqual([]);
    });

    test("registers the fresh bundle (replacing) and refreshes the lists — no cell, no placing", async () => {
        const registerBundle = jest.fn();
        await finalizeWidgetBuilderSession({
            installed: INSTALLED,
            registerBundle,
        });
        expect(window.mainApi.widgets.readBundle).toHaveBeenCalledWith(
            "@ai-built/clock"
        );
        expect(registerBundle).toHaveBeenCalledWith(
            "@ai-built/clock",
            "module.exports={}",
            null,
            { replaceExisting: true }
        );
        expect(events.map((e) => e.type)).toEqual([
            "dash:widgets-updated",
            "dash:widget-installed",
        ]);
        expect(events[1].detail).toEqual({ widgetName: "@ai-built/clock" });
    });

    test("an empty cell → placed in it", async () => {
        await finalizeWidgetBuilderSession({
            installed: INSTALLED,
            cellContext: { cellNumber: "1.1", gridItemId: 4, workspaceId: 7 },
            registerBundle: jest.fn(),
        });
        expect(events[2]).toEqual({
            type: "dash:place-widget-in-cell",
            detail: {
                widgetComponentName: "ai-built.clock.Clock",
                cellNumber: "1.1",
                gridItemId: 4,
                workspaceId: 7,
            },
        });
    });

    test("Edit with AI (a remix in a cell) → swapped in place", async () => {
        await finalizeWidgetBuilderSession({
            installed: INSTALLED,
            cellContext: { cellNumber: "1.2", gridItemId: 9, workspaceId: 7 },
            editContext: { originalWidgetId: "w-old" },
            registerBundle: jest.fn(),
        });
        expect(events[2]).toEqual({
            type: "dash:swap-widget-in-cell",
            detail: {
                widgetComponentName: "ai-built.clock.Clock",
                widgetId: "w-old",
                cellNumber: "1.2",
                gridItemId: 9,
                workspaceId: 7,
            },
        });
        expect(events).toHaveLength(3);
    });

    test("a bundle that can't be read still refreshes and places", async () => {
        window.mainApi.widgets.readBundle.mockRejectedValue(new Error("gone"));
        const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
        const registerBundle = jest.fn();
        await finalizeWidgetBuilderSession({
            installed: INSTALLED,
            cellContext: { cellNumber: "1.1", gridItemId: 4, workspaceId: 7 },
            registerBundle,
        });
        warn.mockRestore();
        expect(registerBundle).not.toHaveBeenCalled();
        expect(events.map((e) => e.type)).toEqual([
            "dash:widgets-updated",
            "dash:widget-installed",
            "dash:place-widget-in-cell",
        ]);
    });
});

describe("the remount guard", () => {
    test("blocks while a builder is open", () => {
        expect(widgetBuilderBlocksRemount()).toBe(false);
        markWidgetBuilderActive(true);
        expect(widgetBuilderBlocksRemount()).toBe(true);
        markWidgetBuilderActive(false);
        expect(widgetBuilderBlocksRemount()).toBe(false);
    });

    test("blocks for a while after one finishes", () => {
        jest.useFakeTimers();
        jest.setSystemTime(1_000_000);
        suppressStageRemount();
        expect(widgetBuilderBlocksRemount()).toBe(true);
        jest.setSystemTime(1_000_000 + 3001);
        expect(widgetBuilderBlocksRemount()).toBe(false);
        jest.useRealTimers();
    });

    test("never goes negative on an extra close", () => {
        markWidgetBuilderActive(false);
        markWidgetBuilderActive(true);
        expect(widgetBuilderBlocksRemount()).toBe(true);
    });
});

describe("primeWidgetBuilderChat", () => {
    test("clears the last chat and ends the Claude Code session", () => {
        localStorage.setItem(
            "dash-widget-builder",
            JSON.stringify({ messages: [{ role: "user", content: "old" }] })
        );
        primeWidgetBuilderChat();
        expect(JSON.parse(localStorage.getItem("dash-widget-builder"))).toEqual(
            { messages: [] }
        );
        expect(window.mainApi.llm.endCliSession).toHaveBeenCalledWith(
            "dash-widget-builder"
        );
    });

    test("a resumed draft keeps its chat", () => {
        const kept = JSON.stringify({
            messages: [{ role: "user", content: "x" }],
        });
        localStorage.setItem("dash-widget-builder", kept);
        primeWidgetBuilderChat({ resuming: true });
        expect(localStorage.getItem("dash-widget-builder")).toBe(kept);
    });
});
