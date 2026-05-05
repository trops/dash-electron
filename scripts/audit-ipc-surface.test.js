/**
 * audit-ipc-surface.test.js
 *
 * Tests the *parser and classifier* for the IPC-surface audit, not
 * the live codebase. Hand-fed source strings let us pin behavior on
 * each category independently, so the audit's classification is
 * reproducible regardless of how the live tree shifts. If a future
 * handler-registration pattern is added (e.g. a new
 * `registerHandler(...)` helper), update both this fixture and the
 * parser — the count divergence will be loud.
 */
"use strict";

const assert = require("node:assert");
const test = require("node:test");

const {
    classifyEvent,
    parseInvokes,
    parseHandlers,
} = require("./audit-ipc-surface");

test("classifyEvent: invoke + no handler → 'dead'", () => {
    assert.strictEqual(
        classifyEvent({ hasInvoke: true, hasHandler: false }),
        "dead"
    );
});

test("classifyEvent: handler exists but no invoke → 'phantom'", () => {
    assert.strictEqual(
        classifyEvent({ hasInvoke: false, hasHandler: true }),
        "phantom"
    );
});

test("classifyEvent: widgetId + gate-in-handler → 'gated'", () => {
    assert.strictEqual(
        classifyEvent({
            hasInvoke: true,
            hasHandler: true,
            handlerHasWidgetId: true,
            handlerHasGateRef: true,
            delegateHasGateRef: false,
        }),
        "gated"
    );
});

test("classifyEvent: widgetId + gate-in-delegate → 'gated'", () => {
    // The MCP/fs case: handler is a thin pass-through that hands off to
    // a controller method whose body has the gate. The audit must
    // recognize this or it will misclassify every Phase 1 + Phase 2
    // surface as ungated.
    assert.strictEqual(
        classifyEvent({
            hasInvoke: true,
            hasHandler: true,
            handlerHasWidgetId: true,
            handlerHasGateRef: false,
            delegateHasGateRef: true,
        }),
        "gated"
    );
});

test("classifyEvent: widgetId but neither gate ref → 'widget-passthru'", () => {
    // Most dangerous case: the handler accepts widgetId, suggesting
    // per-widget scoping, but no gate is reachable. Classify
    // distinctly so reviewers see it apart from generic 'system'.
    assert.strictEqual(
        classifyEvent({
            hasInvoke: true,
            hasHandler: true,
            handlerHasWidgetId: true,
            handlerHasGateRef: false,
            delegateHasGateRef: false,
        }),
        "widget-passthru"
    );
});

test("classifyEvent: handler without widgetId → 'system'", () => {
    assert.strictEqual(
        classifyEvent({
            hasInvoke: true,
            hasHandler: true,
            handlerHasWidgetId: false,
            handlerHasGateRef: false,
            delegateHasGateRef: false,
        }),
        "system"
    );
});

test("parseInvokes: extracts ipcRenderer.invoke channel constants", () => {
    const src = `
    const { CH_ONE, CH_TWO } = require("../events");
    const api = {
      first: () => ipcRenderer.invoke(CH_ONE, {}),
      second: (x) => ipcRenderer.invoke(CH_TWO, { x }),
      noisy: () => ipcRenderer.invoke("inline-string-channel"),
    };
  `;
    const out = parseInvokes(src);
    assert.deepStrictEqual(out.sort(), ["CH_ONE", "CH_TWO"]);
});

test("parseHandlers: extracts loggedHandle + ipcMain.handle channel constants", () => {
    const src = `
    logger.loggedHandle(CH_ONE, (e, message) => {
      const { widgetId, filename } = message;
      return _runFsGate(getSenderWindow(e), "saveToFile", widgetId);
    });
    ipcMain.handle(CH_TWO, (e, message) => {
      return doInternalThing(message.foo);
    });
    ipcMain.handle("popout-open", () => {});
  `;
    const out = parseHandlers(src);
    assert.deepStrictEqual(out.map((h) => h.channel).sort(), [
        "CH_ONE",
        "CH_TWO",
    ]);
    const ch1 = out.find((h) => h.channel === "CH_ONE");
    assert.strictEqual(ch1.handlerHasWidgetId, true, "CH_ONE has widgetId");
    assert.strictEqual(ch1.handlerHasGateRef, true, "CH_ONE has gate ref");
    const ch2 = out.find((h) => h.channel === "CH_TWO");
    assert.strictEqual(ch2.handlerHasWidgetId, false, "CH_TWO has no widgetId");
    assert.strictEqual(ch2.handlerHasGateRef, false, "CH_TWO has no gate ref");
});

test("parseHandlers: handler body slice respects nesting", () => {
    const src = `
    logger.loggedHandle(CH_NESTED, (e, message) =>
      saveToFile(
        getSenderWindow(e),
        message.data,
        message.filename,
        message.append,
        message.returnEmpty,
        message.widgetId,
      ),
    );
  `;
    const out = parseHandlers(src);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].handlerHasWidgetId, true);
});

test("parseHandlers: extracts the delegate function (skips getSenderWindow)", () => {
    const src = `
    logger.loggedHandle(CH_DELEGATE, (e, message) =>
      mcpController.callTool(getSenderWindow(e), message.serverName, message.widgetId)
    );
  `;
    const out = parseHandlers(src);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(
        out[0].delegate,
        "callTool",
        "qualified call form: prefer the method name over the module"
    );
});

test("parseHandlers: bareword delegate", () => {
    const src = `
    logger.loggedHandle(CH_BARE, (e, message) =>
      saveToFile(getSenderWindow(e), message.data, message.widgetId)
    );
  `;
    const out = parseHandlers(src);
    assert.strictEqual(out[0].delegate, "saveToFile");
});
