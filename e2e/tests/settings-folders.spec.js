const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Settings → Folders — Create
 *
 * Walks Settings → Folders → New Folder, fills a name, accepts the
 * default icon, and confirms the folder appears in the folders list.
 *
 * Selectors derived from `node scripts/explore-ui.js --to
 * settings.folders.new`.
 */

let electronApp;
let window;
let tempUserData;

const FOLDER_NAME = "E2E Test Folder";

test.beforeAll(async () => {
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
});

test("create folder via Settings → Folders", async () => {
    await test.step("open Settings → Folders", async () => {
        await window
            .locator("aside")
            .getByText("Account", { exact: true })
            .click();
        await window.waitForTimeout(500);
        await window
            .getByRole("button", { name: "Settings", exact: true })
            .first()
            .click();
        await window.waitForTimeout(1000);
        await window
            .getByRole("button", { name: "Folders", exact: true })
            .first()
            .click();
        await window.waitForTimeout(500);

        await expect(window.getByText("No folders yet")).toBeVisible({
            timeout: 5000,
        });
    });

    await test.step("open New Folder form, fill name, create", async () => {
        await window.getByText("New Folder", { exact: true }).click();
        await window.waitForTimeout(500);

        await window
            .getByRole("textbox", { name: "Folder name" })
            .fill(FOLDER_NAME);

        await window
            .getByRole("button", { name: "Create", exact: true })
            .click();
        await window.waitForTimeout(1000);
    });

    await test.step("folder appears in the folders list", async () => {
        // The "No folders yet" placeholder should be gone, and our
        // folder name should be visible somewhere in the panel.
        await expect(window.getByText("No folders yet")).toBeHidden({
            timeout: 5000,
        });
        await expect(
            window.getByText(FOLDER_NAME, { exact: true }).first()
        ).toBeVisible({ timeout: 5000 });
    });
});
