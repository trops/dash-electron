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
    parseConstantDeclarations,
    resolveChannel,
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

test("parseInvokes: extracts both constants and inline-string channels", () => {
    const src = `
    const { CH_ONE, CH_TWO } = require("../events");
    const api = {
      first: () => ipcRenderer.invoke(CH_ONE, {}),
      second: (x) => ipcRenderer.invoke(CH_TWO, { x }),
      thirdly: () => ipcRenderer.invoke("inline-string-channel"),
      fourth: () => ipcRenderer.invoke('single-quoted'),
    };
  `;
    const out = parseInvokes(src);
    // Each entry: { displayName, value, isLiteral }
    const byDisplay = Object.fromEntries(out.map((e) => [e.displayName, e]));
    assert.deepStrictEqual(Object.keys(byDisplay).sort(), [
        "CH_ONE",
        "CH_TWO",
        "inline-string-channel",
        "single-quoted",
    ]);
    assert.strictEqual(byDisplay.CH_ONE.isLiteral, false);
    assert.strictEqual(byDisplay["inline-string-channel"].isLiteral, true);
    assert.strictEqual(
        byDisplay["inline-string-channel"].value,
        "inline-string-channel"
    );
    assert.strictEqual(byDisplay["single-quoted"].value, "single-quoted");
});

test("parseInvokes: resolves constant value via the constant map", () => {
    const src = `ipcRenderer.invoke(THEME_LIST, { appId });`;
    const constMap = new Map([["THEME_LIST", "theme-list"]]);
    const out = parseInvokes(src, constMap);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].displayName, "THEME_LIST");
    assert.strictEqual(out[0].value, "theme-list");
    assert.strictEqual(out[0].isLiteral, false);
});

test("parseConstantDeclarations: builds name→value map from events file", () => {
    const src = `
    const FOO = "foo-channel";
    const BAR = 'bar-channel';
    const BAZ = "baz-channel-complete";
    module.exports = { FOO, BAR, BAZ };
  `;
    const map = parseConstantDeclarations(src);
    assert.strictEqual(map.get("FOO"), "foo-channel");
    assert.strictEqual(map.get("BAR"), "bar-channel");
    assert.strictEqual(map.get("BAZ"), "baz-channel-complete");
});

test("resolveChannel: prefers constant displayName over literal when same value", () => {
    // Audit display rule: when invoke side uses a constant and handler
    // side uses an inline string with the same value, the table shows
    // the constant name (more readable for the operator).
    const invoke = {
        displayName: "THEME_LIST",
        value: "theme-list",
        isLiteral: false,
    };
    const handler = {
        displayName: "theme-list",
        value: "theme-list",
        isLiteral: true,
    };
    assert.strictEqual(
        resolveChannel(invoke, handler).displayName,
        "THEME_LIST"
    );
});

test("parseHandlers: extracts both constants and inline-string handlers", () => {
    const src = `
    logger.loggedHandle(CH_ONE, (e, message) => {
      const { widgetId, filename } = message;
      return _runFsGate(getSenderWindow(e), "saveToFile", widgetId);
    });
    ipcMain.handle(CH_TWO, (e, message) => {
      return doInternalThing(message.foo);
    });
    logger.loggedHandle("theme-list", (e, message) => {
      return listThemesForApplication(getSenderWindow(e), message.appId);
    });
    ipcMain.handle('client-cache-invalidate', async (e, { appId }) => {
      return { success: true };
    });
  `;
    const out = parseHandlers(src);
    const byDisplay = Object.fromEntries(out.map((h) => [h.displayName, h]));
    assert.deepStrictEqual(Object.keys(byDisplay).sort(), [
        "CH_ONE",
        "CH_TWO",
        "client-cache-invalidate",
        "theme-list",
    ]);
    assert.strictEqual(byDisplay.CH_ONE.handlerHasWidgetId, true);
    assert.strictEqual(byDisplay.CH_ONE.handlerHasGateRef, true);
    assert.strictEqual(byDisplay.CH_TWO.handlerHasWidgetId, false);
    assert.strictEqual(byDisplay["theme-list"].isLiteral, true);
    assert.strictEqual(byDisplay["theme-list"].value, "theme-list");
    assert.strictEqual(
        byDisplay["client-cache-invalidate"].value,
        "client-cache-invalidate"
    );
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

test("parseHandlers: handler body for inline-string channel slices correctly", () => {
    const src = `
    ipcMain.handle("client-cache-invalidate", async (e, { appId, providerName }) => {
      clientCache.invalidate(appId, providerName);
      responseCache.clear();
      return { success: true };
    });
  `;
    const out = parseHandlers(src);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].displayName, "client-cache-invalidate");
    assert.strictEqual(out[0].handlerHasWidgetId, false);
    assert.strictEqual(out[0].handlerHasGateRef, false);
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

test("parseHandlers: resolves constant displayName via the constant map", () => {
    const src = `logger.loggedHandle(THEME_LIST, (e, m) => listThemesForApplication(getSenderWindow(e), m.appId));`;
    const constMap = new Map([["THEME_LIST", "theme-list"]]);
    const out = parseHandlers(src, constMap);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].displayName, "THEME_LIST");
    assert.strictEqual(out[0].value, "theme-list");
    assert.strictEqual(out[0].isLiteral, false);
});
