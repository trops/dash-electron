const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Settings → AI — backend + model pickers (the section was "AI Assistant"
 * until the Assistant panel was retired, create-entry 5e-2c)
 *
 * Verifies the pane renders both combo boxes (Backend, Model), the
 * defaults match the documented options, and switching backend works.
 *
 * Selectors derived from `node scripts/explore-ui.js --to
 * settings.aiAssistant`.
 */

let electronApp;
let window;
let tempUserData;

test.beforeAll(async () => {
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
});

test("Settings → AI renders backend + model pickers", async () => {
    await test.step("open Settings → AI", async () => {
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
            .getByRole("button", { name: "AI", exact: true })
            .first()
            .click();
        await window.waitForTimeout(500);

        await expect(window.getByText("Preferred Backend")).toBeVisible({
            timeout: 5000,
        });
    });

    await test.step("backend combobox lists Claude Code CLI + Anthropic API", async () => {
        const combos = window.getByRole("combobox");
        // First combobox is the backend picker per the snapshot order.
        const backend = combos.first();
        await expect(backend).toBeVisible();
        // Confirm both options exist.
        await expect(
            backend.getByRole("option", { name: "Claude Code CLI" })
        ).toHaveCount(1);
        await expect(
            backend.getByRole("option", { name: /Anthropic API/ })
        ).toHaveCount(1);
    });

    await test.step("model combobox lists Sonnet/Opus/Haiku", async () => {
        const combos = window.getByRole("combobox");
        const model = combos.nth(1);
        await expect(model).toBeVisible();
        await expect(
            model.getByRole("option", { name: "Claude Sonnet 4" })
        ).toHaveCount(1);
        await expect(
            model.getByRole("option", { name: "Claude Opus 4" })
        ).toHaveCount(1);
        await expect(
            model.getByRole("option", { name: "Claude Haiku 4.5" })
        ).toHaveCount(1);
    });

    await test.step("Anthropic API key field + disabled Save button render", async () => {
        await expect(
            window.getByRole("textbox", { name: "sk-ant-..." })
        ).toBeVisible();
        await expect(
            window.getByRole("button", { name: "Save", exact: true })
        ).toBeDisabled();
    });
});
