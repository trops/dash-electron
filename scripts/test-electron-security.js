#!/usr/bin/env node
/**
 * Pin: every BrowserWindow in dash-electron's main process must apply
 * the security hardening helper, and the default session must have a
 * permission request handler installed.
 *
 * Why: electronegativity flagged LIMIT_NAVIGATION_GLOBAL_CHECK (HIGH)
 * and PERMISSION_REQUEST_HANDLER_GLOBAL_CHECK (MEDIUM) in v0.0.596.
 * Without will-navigate + setWindowOpenHandler, a compromised renderer
 * (e.g. a malicious widget) can navigate the BrowserWindow to an
 * attacker URL. Without setPermissionRequestHandler, every renderer
 * permission request (notifications, geolocation, mic, etc.) is auto-
 * granted.
 *
 * This regression-pin enforces:
 *   1. public/electronSecurity.js exists and exports
 *      applyWindowHardening + applySessionHardening.
 *   2. The exports actually register the expected handlers when called
 *      against a mock window/session.
 *   3. The will-navigate handler preventDefaults cross-origin URLs and
 *      passes same-origin URLs.
 *   4. public/electron.js imports the helpers and calls
 *      applyWindowHardening at every BrowserWindow site EXCEPT
 *      scanWindow (which has its own custom navigation rules), and
 *      calls applySessionHardening once.
 *
 * Pure node test — no jsdom, no electron module. The helper is required
 * with `electron` mocked to a fake module via require.cache injection.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Module = require("module");

const repoRoot = path.join(__dirname, "..");

// ── 1. Static checks against electron.js source ───────────────────────

const electronJsPath = path.join(repoRoot, "public", "electron.js");
const electronJsSrc = fs.readFileSync(electronJsPath, "utf8");

assert.ok(
    /require\(["']\.\/electronSecurity["']\)/.test(electronJsSrc),
    "public/electron.js must require ./electronSecurity"
);
assert.ok(
    /applyWindowHardening/.test(electronJsSrc),
    "public/electron.js must reference applyWindowHardening"
);
assert.ok(
    /applySessionHardening/.test(electronJsSrc),
    "public/electron.js must reference applySessionHardening"
);

// Count BrowserWindow constructions vs hardening calls. There are 5
// windows total: mainWindow, scanWindow (exempt), 2x popout, debugWindow.
// Expect exactly 4 applyWindowHardening calls (every window except
// scanWindow).
const browserWindowMatches =
    electronJsSrc.match(/new\s+BrowserWindow\s*\(/g) || [];
const hardenWindowMatches =
    electronJsSrc.match(/applyWindowHardening\s*\(/g) || [];
assert.ok(
    browserWindowMatches.length >= 4,
    `Expected at least 4 BrowserWindow constructions in electron.js, found ${browserWindowMatches.length}`
);
assert.ok(
    hardenWindowMatches.length === browserWindowMatches.length - 1,
    `Expected applyWindowHardening called for every BrowserWindow except scanWindow. Got ${hardenWindowMatches.length} hardening calls vs ${browserWindowMatches.length} BrowserWindow constructions.`
);

// scanWindow exemption must be commented near its construction.
assert.ok(
    /scanWindow[\s\S]{0,400}exempt|exempt[\s\S]{0,400}scanWindow/.test(
        electronJsSrc
    ),
    "scanWindow exemption must be documented with a comment near its BrowserWindow construction"
);

assert.ok(
    /applySessionHardening\s*\(/.test(electronJsSrc),
    "electron.js must call applySessionHardening (once, on the default session)"
);

// ── 2. Functional checks on the helper module ─────────────────────────

const helperPath = path.join(repoRoot, "public", "electronSecurity.js");
assert.ok(fs.existsSync(helperPath), "public/electronSecurity.js must exist");

// Mock the electron module before requiring the helper. The helper uses
// shell.openExternal as a fallback; provide a stub that records calls.
const openExternalCalls = [];
const fakeElectron = {
    shell: {
        openExternal: (url) => {
            openExternalCalls.push(url);
            return Promise.resolve();
        },
    },
};

// Inject fake electron into the module cache so require('electron')
// inside the helper resolves to our stub. Resolve from repoRoot so the
// helper's require sees the same fake.
const electronStubId = require.resolve("path"); // any resolvable id
// Use Module._resolveFilename / cache hack: prepend a custom resolver.
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
    if (request === "electron") return "__stub_electron__";
    return originalResolve.call(this, request, parent, ...rest);
};
require.cache["__stub_electron__"] = {
    id: "__stub_electron__",
    filename: "__stub_electron__",
    loaded: true,
    exports: fakeElectron,
};

let helper;
try {
    helper = require(helperPath);
} finally {
    Module._resolveFilename = originalResolve;
}

assert.strictEqual(
    typeof helper.applyWindowHardening,
    "function",
    "applyWindowHardening must be exported as a function"
);
assert.strictEqual(
    typeof helper.applySessionHardening,
    "function",
    "applySessionHardening must be exported as a function"
);

// Mock BrowserWindow shape.
function makeMockWindow() {
    const listeners = {};
    const wc = {
        on: (event, fn) => {
            listeners[event] = fn;
        },
        setWindowOpenHandler: (fn) => {
            wc._windowOpenHandler = fn;
        },
        getURL: () => "http://localhost:3000/",
    };
    return { webContents: wc, _listeners: listeners };
}

const mockWin = makeMockWindow();
helper.applyWindowHardening(mockWin);

assert.strictEqual(
    typeof mockWin._listeners["will-navigate"],
    "function",
    "applyWindowHardening must register a will-navigate handler"
);
assert.strictEqual(
    typeof mockWin.webContents._windowOpenHandler,
    "function",
    "applyWindowHardening must register a setWindowOpenHandler"
);

// Mock session shape.
function makeMockSession() {
    return {
        _permissionHandler: null,
        setPermissionRequestHandler(fn) {
            this._permissionHandler = fn;
        },
    };
}

const mockSession = makeMockSession();
helper.applySessionHardening(mockSession);
assert.strictEqual(
    typeof mockSession._permissionHandler,
    "function",
    "applySessionHardening must register a permission request handler"
);

// ── 3. Behavior checks on the registered handlers ────────────────────

// Same-origin navigation passes (no preventDefault).
let preventCalled = false;
const sameOriginEvent = {
    preventDefault: () => {
        preventCalled = true;
    },
};
mockWin._listeners["will-navigate"](
    sameOriginEvent,
    "http://localhost:3000/some/route"
);
assert.strictEqual(
    preventCalled,
    false,
    "will-navigate must NOT preventDefault for same-origin URLs"
);

// Cross-origin navigation is blocked.
preventCalled = false;
const crossOriginEvent = {
    preventDefault: () => {
        preventCalled = true;
    },
};
mockWin._listeners["will-navigate"](
    crossOriginEvent,
    "https://evil.example.com/phish"
);
assert.strictEqual(
    preventCalled,
    true,
    "will-navigate must preventDefault for cross-origin URLs"
);

// setWindowOpenHandler always denies in-app window creation.
const handlerResult = mockWin.webContents._windowOpenHandler({
    url: "https://github.com/trops/dash-electron",
});
assert.deepStrictEqual(
    handlerResult,
    { action: "deny" },
    "setWindowOpenHandler must always return { action: 'deny' }"
);

// Permission handler allows notifications, denies others.
let permissionGranted = null;
mockSession._permissionHandler({}, "notifications", (granted) => {
    permissionGranted = granted;
});
assert.strictEqual(
    permissionGranted,
    true,
    "permission handler must allow 'notifications'"
);

permissionGranted = null;
mockSession._permissionHandler({}, "geolocation", (granted) => {
    permissionGranted = granted;
});
assert.strictEqual(
    permissionGranted,
    false,
    "permission handler must deny 'geolocation'"
);

permissionGranted = null;
mockSession._permissionHandler({}, "media", (granted) => {
    permissionGranted = granted;
});
assert.strictEqual(
    permissionGranted,
    false,
    "permission handler must deny 'media'"
);

console.log(
    "PASS  electron security hardening: helper exports, handlers registered, navigation + permission rules enforced, every BrowserWindow (except scanWindow) is hardened"
);
