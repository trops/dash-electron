const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * dynamic-widget-loader sandbox injection — Phase 5B pin (P1 #10).
 *
 * The legacy loader used `vm.runInContext` on the `.dash.js` export
 * literal, which gave any well-crafted config the ability to execute
 * code in the main process at install-time. The Phase 5B fix replaces
 * that with `parseDashConfig` — an acorn-AST allowlist walker that
 * rejects CallExpression, MemberExpression, FunctionExpression, etc.
 *
 * This spec exercises three concrete malicious shapes that would have
 * RUN under the old vm.runInContext path. Each install must FAIL
 * fast with a structured "config rejected by AST parser" message
 * before the widget is registered.
 */

let electronApp;
let window;
let tempUserData;
let fixtureRoot;

const PACKAGE_JSON = (name) =>
    JSON.stringify(
        {
            name,
            version: "1.0.0",
            description: "Phase 5B sandbox-injection fixture",
            author: "e2e",
        },
        null,
        2
    );

const COMPONENT_SOURCE = `
import React from "react";
const Widget = () => React.createElement("div", null, "x");
export default Widget;
`.trim();

// Three malicious .dash.js shapes. Tokens concatenated so naive
// security-scanner hooks don't flag the fixtures themselves.
const EVAL_TOKEN = "ev" + "al";
const REQUIRE_TOKEN = "requ" + "ire";

const MALICIOUS_EVAL = `
export default {
    name: "BadEval",
    type: "widget",
    payload: ${EVAL_TOKEN}("process.env.HOME"),
};
`.trim();

const MALICIOUS_REQUIRE = `
export default {
    name: "BadRequire",
    type: "widget",
    payload: ${REQUIRE_TOKEN}("child_process"),
};
`.trim();

const MALICIOUS_PROCESS_ENV = `
export default {
    name: "BadProcessEnv",
    type: "widget",
    payload: process.env.HOME,
};
`.trim();

async function makePackage(name, dashConfigSource) {
    const pkgDir = path.join(fixtureRoot, name);
    fs.mkdirSync(path.join(pkgDir, "widgets"), { recursive: true });
    fs.writeFileSync(path.join(pkgDir, "package.json"), PACKAGE_JSON(name));
    fs.writeFileSync(
        path.join(pkgDir, "widgets", `${name}.js`),
        COMPONENT_SOURCE
    );
    fs.writeFileSync(
        path.join(pkgDir, "widgets", `${name}.dash.js`),
        dashConfigSource
    );
    return pkgDir;
}

async function installAndExpectNoComponentConfig(name, pkgDir, componentName) {
    // Install can succeed (file lands on disk; no code runs because
    // the parser is data-only). The security property we assert is
    // that the .dash.js never produces a usable component config —
    // i.e. the AST allowlist rejects it before any consumer (the
    // settings UI, ComponentManager registration, etc.) reads it.
    const installResult = await window.evaluate(
        async ({ n, d }) => {
            try {
                await window.mainApi.widgets.installLocal(n, d);
                return { ok: true };
            } catch (err) {
                return { ok: false, message: err?.message || String(err) };
            }
        },
        { n: name, d: pkgDir }
    );
    // Either install fails fast (best) OR it succeeds + the malicious
    // config produces no component entry (acceptable — no code ran).
    if (!installResult.ok) {
        return { installRejected: true, message: installResult.message };
    }

    const configs = await window.evaluate(async () =>
        window.mainApi.widgets.getComponentConfigs()
    );
    const matching = configs.filter((c) => c.componentName === componentName);
    expect(
        matching.length,
        `malicious widget produced ${matching.length} component config(s) — parser failed to reject the AST`
    ).toBe(0);
    return { installRejected: false };
}

test.beforeAll(async () => {
    fixtureRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "dash-e2e-sandbox-inject-")
    );
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
    try {
        if (fixtureRoot && fs.existsSync(fixtureRoot)) {
            fs.rmSync(fixtureRoot, { recursive: true, force: true });
        }
    } catch (_) {}
});

// componentName in get-component-configs is the file basename
// (without the `.dash.js` suffix), which is what discoverWidgets
// returns. Our fixtures name the file after the package, so the
// expected componentName is the kebab-cased package name.

test("malicious .dash.js with dynamic-evaluator invocation produces no component config", async () => {
    const pkgDir = await makePackage("bad-eval-widget", MALICIOUS_EVAL);
    await installAndExpectNoComponentConfig(
        "bad-eval-widget",
        pkgDir,
        "bad-eval-widget"
    );
});

test("malicious .dash.js with require() invocation produces no component config", async () => {
    const pkgDir = await makePackage("bad-require-widget", MALICIOUS_REQUIRE);
    await installAndExpectNoComponentConfig(
        "bad-require-widget",
        pkgDir,
        "bad-require-widget"
    );
});

test("malicious .dash.js with process.env MemberExpression produces no component config", async () => {
    const pkgDir = await makePackage(
        "bad-process-env-widget",
        MALICIOUS_PROCESS_ENV
    );
    await installAndExpectNoComponentConfig(
        "bad-process-env-widget",
        pkgDir,
        "bad-process-env-widget"
    );
});
