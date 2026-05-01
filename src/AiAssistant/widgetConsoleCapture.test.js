/**
 * @jest-environment jsdom
 *
 * Capture utility for the widget builder's Console tab.
 *
 * Contracts pinned here:
 *   - install() returns an uninstall() that restores original console
 *     methods and removes the window listeners
 *   - console.* calls whose stack contains "evaluateBundle" produce a
 *     captured event with severity / args / timestamp / stack
 *   - console.* calls from elsewhere (e.g. the AI Builder modal itself,
 *     other framework code) do NOT produce captured events
 *   - The original console behavior is preserved (calls still pass
 *     through to the real console for devtools visibility)
 *   - window.error and unhandledrejection events filtered to widget
 *     scope produce captured events with severity "error"
 */
import {
    installWidgetConsoleCapture,
    _matchesWidgetScope,
} from "./widgetConsoleCapture";

describe("widgetConsoleCapture._matchesWidgetScope", () => {
    test("returns true when stack contains evaluateBundle", () => {
        const stack = `Error
    at log (console.js:1:1)
    at Module.evaluateBundle (dash-core/dist/index.esm.js:1234:5)
    at MyWidget (eval:5:7)`;
        expect(_matchesWidgetScope(stack)).toBe(true);
    });

    test("returns true when stack contains @ai-built/", () => {
        // AI-built widget instances often appear in the stack via the
        // module URL, even when evaluateBundle is no longer on the
        // current frame (e.g. from a setTimeout fired inside the widget).
        const stack = `Error
    at handler (@ai-built/mywidget/widgets/MyWidget.js:42:10)
    at HTMLButtonElement.onClick (react-dom.js:1:1)`;
        expect(_matchesWidgetScope(stack)).toBe(true);
    });

    test("returns false for ordinary app stacks", () => {
        const stack = `Error
    at click (WidgetBuilderModal.js:200:5)
    at HTMLButtonElement.onClick (react-dom.js:1:1)`;
        expect(_matchesWidgetScope(stack)).toBe(false);
    });

    test("returns false for empty / null stack", () => {
        expect(_matchesWidgetScope("")).toBe(false);
        expect(_matchesWidgetScope(null)).toBe(false);
        expect(_matchesWidgetScope(undefined)).toBe(false);
    });
});

describe("widgetConsoleCapture.installWidgetConsoleCapture", () => {
    let captured;
    let originalConsole;
    let onEventSpy;

    beforeEach(() => {
        captured = [];
        onEventSpy = jest.fn((evt) => captured.push(evt));
        originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info,
            debug: console.debug,
        };
    });

    afterEach(() => {
        // Make sure no test leaks console wrapping.
        console.log = originalConsole.log;
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;
        console.info = originalConsole.info;
        console.debug = originalConsole.debug;
    });

    test("uninstall restores the original console methods", () => {
        const originalLog = console.log;
        const uninstall = installWidgetConsoleCapture(onEventSpy);
        expect(console.log).not.toBe(originalLog); // wrapped
        uninstall();
        expect(console.log).toBe(originalLog); // restored
    });

    test("captures console.* calls whose stack matches widget scope", () => {
        const uninstall = installWidgetConsoleCapture(onEventSpy);
        // Simulate a call from inside widget scope by faking the stack.
        // We achieve this by calling through a function whose name
        // gets baked into the stack — _matchesWidgetScope looks for
        // "evaluateBundle".
        function evaluateBundle() {
            console.log("hello from widget");
        }
        evaluateBundle();
        uninstall();
        expect(onEventSpy).toHaveBeenCalled();
        const evt = captured.find((e) =>
            e.args.some((a) => a === "hello from widget")
        );
        expect(evt).toBeDefined();
        expect(evt.severity).toBe("log");
    });

    test("does NOT capture calls from outside widget scope", () => {
        const uninstall = installWidgetConsoleCapture(onEventSpy);
        // No "evaluateBundle" frame on the stack — should be ignored.
        console.log("framework noise");
        uninstall();
        const evt = captured.find((e) =>
            e.args.some((a) => a === "framework noise")
        );
        expect(evt).toBeUndefined();
    });

    test("captures all severities (log, warn, error, info, debug)", () => {
        const uninstall = installWidgetConsoleCapture(onEventSpy);
        function evaluateBundle() {
            console.log("a");
            console.warn("b");
            console.error("c");
            console.info("d");
            console.debug("e");
        }
        evaluateBundle();
        uninstall();
        const severities = captured.map((e) => e.severity);
        expect(severities).toEqual(
            expect.arrayContaining(["log", "warn", "error", "info", "debug"])
        );
    });

    test("preserves pass-through to the original console", () => {
        const calls = [];
        const originalLog = console.log;
        console.log = (...args) => calls.push(args);
        const uninstall = installWidgetConsoleCapture(onEventSpy);
        function evaluateBundle() {
            console.log("hello");
        }
        evaluateBundle();
        uninstall();
        console.log = originalLog;
        expect(calls).toEqual([["hello"]]);
    });

    test("captures window.error events that match widget scope", () => {
        const uninstall = installWidgetConsoleCapture(onEventSpy);
        // Simulate an error event.
        const stack = `Error
    at evaluateBundle (foo:1:1)`;
        const errorEvent = new Event("error");
        errorEvent.error = { message: "boom", stack };
        errorEvent.message = "boom";
        // jsdom doesn't bubble window error events with .error set
        // through dispatch normally — set both message and error on
        // the event so the handler reads them either way.
        window.dispatchEvent(errorEvent);
        uninstall();
        const evt = captured.find(
            (e) => e.severity === "error" && e.source === "window.error"
        );
        expect(evt).toBeDefined();
        expect(evt.args[0]).toContain("boom");
    });

    test("captures unhandledrejection events that match widget scope", () => {
        const uninstall = installWidgetConsoleCapture(onEventSpy);
        const stack = `Error
    at evaluateBundle (foo:1:1)`;
        const evt = new Event("unhandledrejection");
        evt.reason = { message: "promise broke", stack };
        window.dispatchEvent(evt);
        uninstall();
        const captured1 = captured.find(
            (e) => e.severity === "error" && e.source === "unhandledrejection"
        );
        expect(captured1).toBeDefined();
        expect(captured1.args[0]).toContain("promise broke");
    });
});
