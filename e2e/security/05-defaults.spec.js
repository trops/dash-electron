/**
 * 05-defaults.spec.js
 *
 * Pins the default-on semantics for the two security flags. A missing
 * settings.json or missing security block must yield {enforce: true,
 * jit: true} when read by the runtime. Explicit false opts out.
 *
 * The boolean logic is inlined here rather than imported from dash-core
 * (the helper lives at electron/utils/securityFlags.js, behind the
 * package's `exports` field which only exposes `.` and `./electron`).
 * The semantics — "anything except literal false is treated as true" —
 * are pinned by dash-core's own securityFlags.test.js; this spec
 * verifies the SAME semantics observed through the actual settings.json
 * file the runtime reads.
 */
const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");
const { setSecurityFlags } = require("./helpers");

async function readFlagsFromSettings(electronApp) {
    return await electronApp.evaluate(async () => {
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
        let settings = null;
        try {
            settings = JSON.parse(fsMod.readFileSync(settingsPath, "utf8"));
        } catch (_) {
            settings = null;
        }
        // Mirrors electron/utils/securityFlags.js — anything except
        // literal false yields true.
        return {
            enforce: settings?.security?.enforceWidgetMcpPermissions !== false,
            jit: settings?.security?.enableJitConsent !== false,
        };
    });
}

test.describe("security flag defaults", () => {
    test("fresh profile (no settings.json) → both flags read as true", async () => {
        const { electronApp, tempUserData } = await launchApp({
            hermetic: true,
        });
        try {
            const flags = await readFlagsFromSettings(electronApp);
            expect(flags.enforce).toBe(true);
            expect(flags.jit).toBe(true);
        } finally {
            await closeApp(electronApp, { tempUserData });
        }
    });

    test("explicit false in settings.json opts out", async () => {
        const { electronApp, tempUserData } = await launchApp({
            hermetic: true,
        });
        try {
            await setSecurityFlags(electronApp, { enforce: false, jit: false });
            const flags = await readFlagsFromSettings(electronApp);
            expect(flags.enforce).toBe(false);
            expect(flags.jit).toBe(false);
        } finally {
            await closeApp(electronApp, { tempUserData });
        }
    });

    test("missing security block → both flags default to true", async () => {
        const { electronApp, tempUserData } = await launchApp({
            hermetic: true,
        });
        try {
            // Write settings without a `security` key
            await electronApp.evaluate(async () => {
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
                fsMod.mkdirSync(pathMod.dirname(settingsPath), {
                    recursive: true,
                });
                fsMod.writeFileSync(
                    settingsPath,
                    JSON.stringify({ debugMode: true }),
                    "utf8"
                );
            });
            const flags = await readFlagsFromSettings(electronApp);
            expect(flags.enforce).toBe(true);
            expect(flags.jit).toBe(true);
        } finally {
            await closeApp(electronApp, { tempUserData });
        }
    });
});
