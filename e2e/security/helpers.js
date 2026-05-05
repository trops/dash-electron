/**
 * helpers.js — utilities specific to the MCP security E2E suite.
 *
 * Wraps the lower-level helpers in `e2e/helpers/` with shapes the
 * security tests want: write flags, seed grants, trigger calls, expect
 * modals, etc. Keeps each spec readable.
 *
 * All write-helpers go through main-process `evaluate` calls so they
 * touch the same files the runtime touches — settings.json,
 * widgetMcpGrants.json — exactly the way the production code does.
 */
"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");

/**
 * Set the security flags by writing settings.json directly. Mirrors
 * `appContext.changeSettings({...settings, security: {...}})` minus the
 * UI roundtrip, so tests can establish a flag state in one line.
 */
async function setSecurityFlags(electronApp, { enforce, jit }) {
    await electronApp.evaluate(
        async (_e, { enforce, jit }) => {
            const moduleRequire =
                globalThis.__e2eRequire ||
                (process.mainModule && process.mainModule.require);
            const fsMod = moduleRequire("fs");
            const pathMod = moduleRequire("path");
            const { app } = moduleRequire("electron");
            const settingsPath = pathMod.join(
                app.getPath("userData"),
                "Dashboard",
                "settings.json"
            );
            fsMod.mkdirSync(pathMod.dirname(settingsPath), { recursive: true });
            let settings = {};
            try {
                settings = JSON.parse(fsMod.readFileSync(settingsPath, "utf8"));
            } catch (_) {
                /* fresh file */
            }
            settings.security = settings.security || {};
            if (typeof enforce === "boolean")
                settings.security.enforceWidgetMcpPermissions = enforce;
            if (typeof jit === "boolean")
                settings.security.enableJitConsent = jit;
            fsMod.writeFileSync(
                settingsPath,
                JSON.stringify(settings, null, 2),
                "utf8"
            );
        },
        { enforce, jit }
    );
}

/**
 * Write a grant directly to widgetMcpGrants.json. Lets tests seed
 * specific grant states without going through any consent UI.
 */
async function seedGrant(electronApp, widgetId, perms) {
    await electronApp.evaluate(
        async (_e, { widgetId, perms }) => {
            const moduleRequire =
                globalThis.__e2eRequire ||
                (process.mainModule && process.mainModule.require);
            const fsMod = moduleRequire("fs");
            const pathMod = moduleRequire("path");
            const { app } = moduleRequire("electron");
            const grantsPath = pathMod.join(
                app.getPath("userData"),
                "widgetMcpGrants.json"
            );
            let store = {};
            try {
                store = JSON.parse(fsMod.readFileSync(grantsPath, "utf8"));
            } catch (_) {
                /* fresh */
            }
            store[widgetId] = perms;
            fsMod.writeFileSync(
                grantsPath,
                JSON.stringify(store, null, 2),
                "utf8"
            );
        },
        { widgetId, perms }
    );
}

/**
 * Read all grants out of widgetMcpGrants.json. Used to assert that a
 * grant was (or wasn't) persisted as a side effect of a test action.
 */
async function readAllGrants(electronApp) {
    return await electronApp.evaluate(async () => {
        const moduleRequire =
            globalThis.__e2eRequire ||
            (process.mainModule && process.mainModule.require);
        const fsMod = moduleRequire("fs");
        const pathMod = moduleRequire("path");
        const { app } = moduleRequire("electron");
        const grantsPath = pathMod.join(
            app.getPath("userData"),
            "widgetMcpGrants.json"
        );
        try {
            return JSON.parse(fsMod.readFileSync(grantsPath, "utf8"));
        } catch (_) {
            return {};
        }
    });
}

/**
 * Start an MCP server in the main process via the regular IPC. Pairs
 * with `stubMcpServer` from helpers/mock-mcp-transport — that one
 * makes the connect/listTools/callTool flow no-op-friendly; this one
 * actually puts an entry in `activeServers` so the gate's post-pass
 * lookup finds something.
 */
async function startServer(window, serverName, mcpConfig = null) {
    const config = mcpConfig || {
        transport: "stdio",
        command: "fake-mcp",
        args: [serverName],
        envMapping: {},
    };
    return await window.evaluate(
        async ({ serverName, config }) => {
            return await window.mainApi.mcp.startServer(
                serverName,
                config,
                {},
                null
            );
        },
        { serverName, config }
    );
}

/**
 * Trigger a tool call from the renderer with the given widget identity.
 * Returns the result object (which may be { error, message } if the
 * gate denied or the call failed).
 */
async function triggerToolCall(
    window,
    { widgetId, serverName, toolName, args }
) {
    return await window.evaluate(
        async ({ widgetId, serverName, toolName, args }) => {
            return await window.mainApi.mcp.callTool(
                serverName,
                toolName,
                args,
                null,
                widgetId
            );
        },
        { widgetId, serverName, toolName, args }
    );
}

/**
 * Wait for the JIT consent modal to appear in the renderer. Looks for
 * the "Permission requested" header text rendered by JitConsentModal.
 */
async function waitForJitModal(window, timeout = 5000) {
    await window
        .getByText("Permission requested", { exact: false })
        .waitFor({ state: "visible", timeout });
}

/**
 * Click an "Allow" button in the JIT modal by partial label match.
 * E.g. "Allow read_file for /tmp/x.txt" matches `for /tmp/x.txt`.
 */
async function clickJitAllow(window, partialLabel) {
    await window
        .getByRole("button", { name: new RegExp(partialLabel, "i") })
        .first()
        .click();
}

async function clickJitDeny(window) {
    await window.getByRole("button", { name: /^Deny$/i }).click();
}

/**
 * Open the Settings → Privacy & Security panel. The hermetic-launch
 * sidebar starts collapsed; opens via the user icon then Privacy.
 */
async function openPrivacyAndSecurity(window) {
    // Mirrors the navigation pattern in settings-general.spec.js:
    //   sidebar → Account → Settings → <section>
    await window.locator("aside").getByText("Account", { exact: true }).click();
    await window.waitForTimeout(500);
    await window
        .getByRole("button", { name: "Settings", exact: true })
        .first()
        .click();
    await window.waitForTimeout(1000);
    await window
        .getByRole("button", { name: "Privacy & Security", exact: true })
        .first()
        .click();
    await window.waitForTimeout(500);
}

/**
 * Copy a fixture widget package into a temp dir and install it via
 * `widget:install-local` — the same IPC the install-from-folder UI
 * uses. This DOES trigger the consent emit (whereas
 * `widget:load-folder` does not), so it's the right path for testing
 * install-time consent flows.
 */
async function installLocalWidget(window, fixtureDir, widgetName) {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dash-e2e-widget-"));
    copyDirSync(fixtureDir, tmpRoot);
    return await window.evaluate(
        async ({ widgetName, localPath }) => {
            return await window.mainApi.widgets.installLocal(
                widgetName,
                localPath
            );
        },
        { widgetName, localPath: tmpRoot }
    );
}

function copyDirSync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDirSync(s, d);
        else if (entry.isFile()) fs.copyFileSync(s, d);
    }
}

const FIXTURES_DIR = path.resolve(__dirname, "fixtures/widgets");

module.exports = {
    setSecurityFlags,
    seedGrant,
    readAllGrants,
    startServer,
    triggerToolCall,
    waitForJitModal,
    clickJitAllow,
    clickJitDeny,
    openPrivacyAndSecurity,
    installLocalWidget,
    FIXTURES_DIR,
};
