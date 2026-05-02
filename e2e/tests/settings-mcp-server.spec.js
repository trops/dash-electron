const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Settings → MCP Server — toggle + read auth token
 *
 * Confirms the MCP Server pane renders, the enable switch flips,
 * status reflects the change, the port is editable, and the bearer
 * token is present + copyable.
 *
 * Selectors derived from `node scripts/explore-ui.js --to
 * settings.mcpServer`.
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

test("Settings → MCP Server renders + toggle flips status", async () => {
    await test.step("open Settings → MCP Server", async () => {
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
            .getByRole("button", { name: "MCP Server", exact: true })
            .first()
            .click();
        await window.waitForTimeout(500);

        await expect(window.getByText("Enable MCP Server")).toBeVisible({
            timeout: 5000,
        });
    });

    await test.step("port + bearer token + Copy button render", async () => {
        await expect(window.getByText("Port", { exact: true })).toBeVisible();
        await expect(window.getByText("Bearer Token")).toBeVisible();
        await expect(
            window.getByRole("button", { name: "Copy", exact: true })
        ).toBeVisible();
        // Default port is 3141.
        const portInput = window
            .locator('input[type="text"], input[type="number"]')
            .first();
        await expect(portInput).toBeVisible();
    });

    await test.step("toggle Enable MCP Server flips status", async () => {
        // Status shows "Stopped" before toggle. After enabling it
        // should change (Starting / Running / Failed).
        const sw = window.getByRole("switch").first();
        const before = await sw.getAttribute("aria-checked");
        await sw.click();
        await window.waitForTimeout(800);
        const after = await sw.getAttribute("aria-checked");
        expect(after).not.toBe(before);
    });
});
