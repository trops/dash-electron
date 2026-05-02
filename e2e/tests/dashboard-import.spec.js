const { test, expect } = require("@playwright/test");
const fs = require("fs");
const os = require("os");
const path = require("path");
const AdmZip = require("adm-zip");
const { launchApp, closeApp } = require("../helpers/electron-app");
const {
    overrideOpenDialog,
    restoreFileDialogs,
} = require("../helpers/file-dialog-override");

/**
 * Dashboard import — file-dialog override + .dashboard.json fixture
 *
 * Builds a minimal-valid dashboard zip on the fly, overrides
 * `dialog.showOpenDialog` to return its path, walks New Dashboard →
 * Import from File, and asserts the imported dashboard lands in the
 * sidebar.
 *
 * Selectors derived from `node scripts/explore-ui.js --to newDashboard`.
 */

let electronApp;
let window;
let tempUserData;
let fixtureZipPath;

const DASHBOARD_NAME = `Imported E2E Dashboard ${Date.now()}`;

function buildDashboardZip(zipPath, dashboardName) {
    const config = {
        schemaVersion: "1.0.0",
        name: dashboardName,
        description: "E2E import-flow fixture",
        author: { name: "e2e", id: "e2e" },
        shareable: false,
        tags: ["test"],
        widgets: [],
        providers: [],
        eventWiring: [],
        workspace: {
            layout: [
                {
                    id: 1,
                    type: "grid",
                    component: "LayoutGridContainer",
                    grid: { rows: 1, cols: 1 },
                },
            ],
        },
    };
    const zip = new AdmZip();
    zip.addFile(
        "dashboard.dashboard.json",
        Buffer.from(JSON.stringify(config, null, 2))
    );
    zip.writeZip(zipPath);
}

test.beforeAll(async () => {
    fixtureZipPath = path.join(
        os.tmpdir(),
        `dash-e2e-import-${Date.now()}.zip`
    );
    buildDashboardZip(fixtureZipPath, DASHBOARD_NAME);

    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
    await overrideOpenDialog(electronApp, {
        filePaths: [fixtureZipPath],
    });
});

test.afterAll(async () => {
    await restoreFileDialogs(electronApp);
    await closeApp(electronApp, { tempUserData });
    try {
        if (fs.existsSync(fixtureZipPath)) fs.unlinkSync(fixtureZipPath);
    } catch (_) {}
});

test("import a dashboard from a .zip via the New Dashboard dialog", async () => {
    await test.step("open New Dashboard dialog", async () => {
        await window
            .locator("aside")
            .getByText("New Dashboard", { exact: true })
            .first()
            .click();
        await window.waitForTimeout(700);
        await expect(
            window.getByRole("dialog").getByText("New Dashboard").first()
        ).toBeVisible({ timeout: 5000 });
    });

    await test.step("click Import from File — opens import wizard", async () => {
        await window.getByRole("button", { name: /Import from File/ }).click();
        await window.waitForTimeout(700);
        await expect(
            window.getByRole("button", { name: "Choose File", exact: true })
        ).toBeVisible({ timeout: 5000 });
    });

    await test.step("click Choose File — file dialog returns the fixture path", async () => {
        await window
            .getByRole("button", { name: "Choose File", exact: true })
            .click();
        // Wizard advances after file is chosen; allow ZIP parse +
        // preview step to render.
        await window.waitForTimeout(2000);
    });

    await test.step("walk wizard to completion (Name → Organize → Theme → Save)", async () => {
        // Stepper has 4 steps for import: File → Name → Organize →
        // Theme. The final action button is "Save" (handleImportConfirm).
        // Click Next 3 times, then Save.
        for (let i = 0; i < 3; i++) {
            const next = window.getByRole("button", {
                name: "Next",
                exact: true,
            });
            await expect(next).toBeVisible({ timeout: 5000 });
            await expect(next).toBeEnabled({ timeout: 5000 });
            await next.click();
            await window.waitForTimeout(700);
        }

        const save = window.getByRole("button", {
            name: "Save",
            exact: true,
        });
        await expect(save).toBeVisible({ timeout: 5000 });
        await save.click();
        await window.waitForTimeout(2500);
    });

    await test.step("workspace was created on disk", async () => {
        const list = await window.evaluate(async () =>
            window.mainApi.workspace.listWorkspacesForApplication(
                "@trops/dash-electron"
            )
        );
        const names = (list?.workspaces || []).map((w) => w.name);
        expect(names).toContain(DASHBOARD_NAME);
    });

    await test.step("imported dashboard appears in the sidebar", async () => {
        // Reload renderer to force sidebar re-fetch (the auto-reload
        // event after handleImportConfirm doesn't always reach the
        // sidebar in time during a wizard close).
        await window.reload();
        await window.waitForSelector("#root > *", { timeout: 30000 });
        await window.waitForTimeout(2000);
        await expect(
            window
                .locator("aside")
                .getByText(DASHBOARD_NAME, { exact: true })
                .first()
        ).toBeVisible({ timeout: 10000 });
    });
});
