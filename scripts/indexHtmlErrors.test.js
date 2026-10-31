/**
 * The page the app ships (src/index.html — craco's template) never rebuilds
 * itself on an error. It used to run document.body.innerHTML += "ERROR…" on
 * every error event, and a widget's broken image (a Home Assistant album
 * cover, 2026-10-31) made it loop forever with the app frozen.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "src/index.html"), "utf8");
const loggerOf = (page) =>
    [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)]
        .map((m) => m[1])
        .find((code) => /addEventListener\(\s*"error"/.test(code));

test("the app is built from src/index.html", () => {
    const craco = fs.readFileSync(path.join(ROOT, "craco.config.js"), "utf8");
    assert.match(craco, /src\/index\.html/);
});

test("pictures load from http:// too (a home server on the user's network); scripts never do", () => {
    const csp = /Content-Security-Policy"\s*content="([^"]+)"/.exec(html)[1];
    const rule = (name) =>
        (
            csp
                .split(";")
                .map((r) => r.trim())
                .find((r) => r.startsWith(name + " ")) || ""
        ).split(/\s+/);
    assert.ok(rule("img-src").includes("http:"));
    assert.ok(rule("img-src").includes("https:"));
    assert.ok(!rule("script-src").includes("http:"));
    assert.ok(!rule("default-src").includes("http:"));
});

test("no script on the page writes the page", () => {
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
        (m) => m[1].replace(/\/\/.*$/gm, "")
    );
    for (const code of scripts) {
        assert.doesNotMatch(code, /\.(innerHTML|outerHTML)\s*\+?=/);
        assert.doesNotMatch(code, /document\.write/);
    }
});

function boot() {
    const listeners = {};
    const logged = [];
    const window = {
        addEventListener: (type, fn) => {
            (listeners[type] = listeners[type] || []).push(fn);
        },
    };
    const body = {
        set innerHTML(_v) {
            throw new Error("the page was rewritten");
        },
        get innerHTML() {
            return "";
        },
    };
    const context = {
        window,
        document: {
            body,
            getElementById: () => ({ children: [], remove() {} }),
            getElementsByTagName: () => [],
        },
        MutationObserver: function () {
            return { observe() {}, disconnect() {} };
        },
        console: {
            log() {},
            error: (...a) => logged.push(a.join(" ")),
        },
    };
    context.window.window = window;
    vm.createContext(context);
    // The early-boot error logger, as the page runs it.
    const logger = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
        .map((m) => m[1])
        .find((code) => /addEventListener\(\s*"error"/.test(code));
    assert.ok(logger, "the page has its error logger");
    vm.runInContext(logger, context);
    const fire = (type, event) =>
        (listeners[type] || []).forEach((fn) => fn(event));
    return { fire, logged, window };
}

test("a file that fails to load (a widget's broken image) is left alone", () => {
    const { fire, logged } = boot();
    const img = { tagName: "IMG", src: "file:///api/media_player_proxy/x" };
    for (let i = 0; i < 50; i += 1) fire("error", { target: img });
    assert.deepEqual(logged, []);
});

test("a real script error is logged, and the page stays as it is", () => {
    const { fire, logged, window } = boot();
    fire("error", {
        target: window,
        error: new Error("boom"),
        message: "boom",
    });
    assert.equal(logged.length, 1);
    assert.match(logged[0], /Global error/);
});

test("a widget bundle's own error isn't logged twice", () => {
    const { fire, logged, window } = boot();
    const error = new Error("widget");
    error.stack = "Error: widget\n    at evaluateBundle (x.js:1:1)";
    fire("error", { target: window, error });
    fire("unhandledrejection", { reason: error });
    assert.deepEqual(logged, []);
});

test("an unhandled rejection is still logged", () => {
    const { fire, logged } = boot();
    fire("unhandledrejection", { reason: new Error("nope") });
    assert.equal(logged.length, 1);
    assert.match(logged[0], /Unhandled rejection/);
});

test("nothing is logged while the Widget Builder is open (it shows its own)", () => {
    const { fire, logged, window } = boot();
    window.__DASH_WIDGET_BUILDER_OPEN = true;
    fire("error", { target: window, error: new Error("preview") });
    fire("unhandledrejection", { reason: new Error("preview") });
    assert.deepEqual(logged, []);
});

test("public/index.html (unused, but CRA needs it) has the same logger", () => {
    const pub = fs.readFileSync(path.join(ROOT, "public/index.html"), "utf8");
    assert.equal(loggerOf(pub), loggerOf(html));
});

test("the Widget Builder reads the picture rule (its guide is cut at 24,000 characters)", () => {
    const skill = fs.readFileSync(
        path.join(ROOT, ".claude/skills/dash-widget-builder/SKILL.md"),
        "utf8"
    );
    assert.ok(
        skill.slice(0, 24000).includes("A picture from a service shows only")
    );
});
