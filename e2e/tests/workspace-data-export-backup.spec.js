const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const AdmZip = require("adm-zip");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Export Everything — Phase 4A.
 *
 * End-to-end pin for the new `window.mainApi.export.exportEverything`
 * IPC + the underlying `exportController.exportEverythingForApplication`
 * bundler. The spec seeds workspaces / themes / menu items / providers
 * into the app's user-data directory, triggers the export with a
 * hard-coded path (bypassing the save dialog via the `defaultPath`
 * option), then parses the resulting ZIP and asserts:
 *
 *   1. The 5 expected JSON files are present.
 *   2. The manifest reflects the correct counts.
 *   3. Workspaces / themes / menuItems round-trip exactly.
 *   4. ★ The credential field that was seeded into the provider is
 *      NOT present in providers.json. ★
 *
 * The fourth assertion is the load-bearing one — without it, a future
 * refactor of `stripProviderCredentials` could silently start leaking
 * tokens and this e2e would still pass. We seed a known-bad token
 * string and grep for it across the ENTIRE serialized bundle, not
 * just the providers.json field.
 *
 * Re-import is out of scope for MVP — this spec only proves the
 * export side. Import would be its own controller + spec later.
 */

const APP_ID = "@trops/dash-electron";
const APP_NAME = "Dashboard";

const KNOWN_BAD_TOKEN = "xoxb-MUST-NOT-LEAK-INTO-BUNDLE";

const SEEDED_WORKSPACE = {
    id: 1,
    name: "Export Seed Workspace",
    type: "workspace",
    layout: [],
    version: 1,
    menuId: 1,
};

const SEEDED_THEMES = {
    "test-theme": {
        name: "Test Theme",
        primary: "indigo",
        secondary: "rose",
        tertiary: "amber",
    },
};

const SEEDED_MENU_ITEMS = [{ id: 1, name: "Export Folder", icon: "folder" }];

let electronApp;
let window;
let tempUserData;

test.beforeAll(async () => {
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
        seedUserData: (rootDir) => {
            // Seed before launch so the first IPC reads find a populated
            // userData dir. The path layout mirrors how dash-core's
            // controllers persist:
            //   <userData>/<APP_NAME>/<APP_ID>/{workspaces,themes,menu-items,providers}.json
            const appDir = path.join(rootDir, APP_NAME, APP_ID);
            fs.mkdirSync(appDir, { recursive: true });
            fs.writeFileSync(
                path.join(appDir, "workspaces.json"),
                JSON.stringify([SEEDED_WORKSPACE], null, 2),
                "utf-8"
            );
            fs.writeFileSync(
                path.join(appDir, "themes.json"),
                JSON.stringify(SEEDED_THEMES, null, 2),
                "utf-8"
            );
            // NOTE: menuItemsController uses camelCase "menuItems.json"
            // on disk (controller-side constant), while the exported
            // bundle file is kebab-case "menu-items.json" (audit
            // preference for backup formats). Seed must match the
            // on-disk name; bundle output stays kebab-case.
            fs.writeFileSync(
                path.join(appDir, "menuItems.json"),
                JSON.stringify(SEEDED_MENU_ITEMS, null, 2),
                "utf-8"
            );
        },
    }));

    // Seed a provider with a fake credential so the leak-pin can find
    // the bad-token string if it ever sneaks into the bundle. Providers
    // are stored encrypted via safeStorage; we have to write the raw
    // shape the controller expects (encrypted credentials blob), so we
    // route through the actual providerController via IPC to keep this
    // honest — if the encryption shape changes, this seeder breaks
    // immediately, which is what we want.
    // saveProvider signature:
    //   (appId, providerName, providerType, credentials, providerClass, ...)
    // Credentials live in position 4 (the object); providerClass is the
    // STRING "credential" in position 5. Getting these swapped (as an
    // earlier draft of this spec did) parks the token into providerClass
    // and the regression-pin below catches it — exactly the failure
    // mode the allowlist exists to prevent.
    await window.evaluate(
        async ({ appId, token }) =>
            window.mainApi.providers.saveProvider(
                appId,
                "slack-bundle-leak-pin",
                "slack",
                { token },
                "credential"
            ),
        { appId: APP_ID, token: KNOWN_BAD_TOKEN }
    );
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
});

test("exporting everything produces a 5-file ZIP with the right counts", async () => {
    const dest = path.join(os.tmpdir(), `dash-e2e-export-${Date.now()}.zip`);

    // Call the bundler directly via the lower-level controller hook so
    // we can pass `defaultPath` and skip the save dialog. The user-
    // facing IPC goes through `window.mainApi.export.exportEverything`
    // which always shows the dialog; for the test we read the env-
    // exposed `__e2eRequire` to invoke the controller in-process.
    const result = await electronApp.evaluate(
        async (_e, { appId, defaultPath }) => {
            const _require =
                globalThis.__e2eRequire ||
                (process.mainModule && process.mainModule.require);
            const dashCore = _require("@trops/dash-core/electron");
            return dashCore.exportController.exportEverythingForApplication(
                null,
                appId,
                { defaultPath }
            );
        },
        { appId: APP_ID, defaultPath: dest }
    );

    expect(result?.success).toBe(true);
    expect(result?.filePath).toBe(dest);
    expect(fs.existsSync(dest)).toBe(true);

    const zip = new AdmZip(dest);
    const entries = zip.getEntries().map((e) => e.entryName);
    expect(entries).toEqual(
        expect.arrayContaining([
            "manifest.json",
            "workspaces.json",
            "themes.json",
            "menu-items.json",
            "providers.json",
        ])
    );

    const manifest = JSON.parse(zip.readAsText("manifest.json"));
    expect(manifest.schemaVersion).toBe("1.0.0");
    expect(manifest.counts.workspaces).toBe(1);
    expect(manifest.counts.themes).toBe(1);
    expect(manifest.counts.menuItems).toBe(1);
    expect(manifest.counts.providers).toBe(1);
});

test("seeded workspaces / themes / menu items round-trip", async () => {
    // Find the ZIP we just wrote in the previous test. Since the test
    // file runs sequentially, the most recently created file matches.
    const files = fs
        .readdirSync(os.tmpdir())
        .filter((f) => f.startsWith("dash-e2e-export-") && f.endsWith(".zip"))
        .map((f) => ({
            name: f,
            mtime: fs.statSync(path.join(os.tmpdir(), f)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);
    expect(files.length).toBeGreaterThan(0);
    const zipPath = path.join(os.tmpdir(), files[0].name);

    const zip = new AdmZip(zipPath);
    const workspaces = JSON.parse(zip.readAsText("workspaces.json"));
    const themes = JSON.parse(zip.readAsText("themes.json"));
    const menuItems = JSON.parse(zip.readAsText("menu-items.json"));

    expect(workspaces).toHaveLength(1);
    expect(workspaces[0].name).toBe(SEEDED_WORKSPACE.name);
    expect(themes["test-theme"]).toEqual(SEEDED_THEMES["test-theme"]);
    expect(menuItems).toEqual(SEEDED_MENU_ITEMS);
});

test("★ credential-leak regression pin — bundle never carries the seeded token", async () => {
    // The MOST IMPORTANT assertion in this file. If this fails, the
    // export feature has become a credential leak vector and the
    // release MUST NOT ship until the pin is green again.
    const files = fs
        .readdirSync(os.tmpdir())
        .filter((f) => f.startsWith("dash-e2e-export-") && f.endsWith(".zip"))
        .map((f) => ({
            name: f,
            mtime: fs.statSync(path.join(os.tmpdir(), f)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);
    const zipPath = path.join(os.tmpdir(), files[0].name);

    const zip = new AdmZip(zipPath);

    // Layer 1: providers.json has no `credentials` field.
    const providers = JSON.parse(zip.readAsText("providers.json"));
    expect(providers).toHaveLength(1);
    expect(providers[0]).not.toHaveProperty("credentials");
    expect(providers[0].name).toBe("slack-bundle-leak-pin");
    expect(providers[0].type).toBe("slack");

    // Layer 2: the literal known-bad token string MUST NOT appear in
    // ANY entry's serialized form. Grep across every JSON blob in the
    // ZIP — including manifest, workspaces, themes, menu-items —
    // because a credential leaking into a "wrong" field (e.g.
    // accidentally serialized into a workspace) would be just as bad.
    for (const entry of zip.getEntries()) {
        const text = entry.getData().toString("utf-8");
        expect(text).not.toContain(KNOWN_BAD_TOKEN);
    }
});

test.afterAll(async () => {
    // Clean up any temp ZIPs this spec created so they don't
    // accumulate on developers' machines.
    const files = fs
        .readdirSync(os.tmpdir())
        .filter((f) => f.startsWith("dash-e2e-export-") && f.endsWith(".zip"));
    for (const f of files) {
        try {
            fs.unlinkSync(path.join(os.tmpdir(), f));
        } catch (_) {}
    }
});
