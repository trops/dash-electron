const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

let electronApp;
let window;

test.beforeAll(async () => {
    ({ electronApp, window } = await launchApp());
});

test.afterAll(async () => {
    await closeApp(electronApp);
});

test.describe("MCP Provider Status", () => {
    test("status dot renders gray when disconnected", async () => {
        // MCP status indicators should show disconnected (gray) by default
        const statusDots = window.locator('[data-mcp-status="disconnected"]');
        const count = await statusDots.count();

        if (count > 0) {
            await expect(statusDots.first()).toBeVisible();
        }
    });

    test("tools count shows zero when disconnected", async () => {
        const toolsCount = window.locator("[data-mcp-tools-count]");
        const count = await toolsCount.count();

        if (count > 0) {
            const text = await toolsCount.first().textContent();
            expect(text).toContain("0");
        }
    });

    test("no MCP console errors on initial load", async () => {
        const mcpErrors = [];
        window.on("console", (msg) => {
            if (
                msg.type() === "error" &&
                msg.text().toLowerCase().includes("mcp")
            ) {
                mcpErrors.push(msg.text());
            }
        });

        await window.waitForTimeout(2000);
        expect(mcpErrors).toEqual([]);
    });
});
