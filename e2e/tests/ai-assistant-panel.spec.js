const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * AI Assistant — panel mounts cleanly
 *
 * Smoke-test for the AI Assistant panel: the floating "Open AI
 * Assistant" button works, the panel structure (header, MCP status,
 * New Chat, input box, Stop) is present, and the panel closes via
 * Collapse.
 *
 * Doesn't exercise the actual chat exchange (mock-llm via UI is a
 * follow-up — needs both settings.preferredBackend AND a configured
 * Anthropic provider, which is more orchestration than this smoke
 * test wants). Mock-llm is independently verified at the network
 * level by helpers-integration.spec.js.
 *
 * Selectors derived from `node scripts/explore-ui.js --to aiAssistant`.
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

test("AI Assistant panel opens, structure renders, closes cleanly", async () => {
    await test.step("panel opens via floating Open button", async () => {
        await window
            .getByRole("button", { name: "Open AI Assistant", exact: true })
            .click();
        await window.waitForTimeout(1500);
        // Header text "AI Assistant" appears in the open panel.
        await expect(window.getByText("AI Assistant").first()).toBeVisible({
            timeout: 5000,
        });
    });

    await test.step("expected panel widgets are present", async () => {
        // MCP server status block (running or not).
        await expect(
            window.getByText(/Dash MCP server (running|not running)/i).first()
        ).toBeVisible();
        // New Chat button.
        await expect(
            window.getByRole("button", { name: "New Chat", exact: true })
        ).toBeVisible();
        // The chat input.
        await expect(
            window.getByRole("textbox", { name: "Type a message..." })
        ).toBeVisible();
        // Either Send or Stop is showing — Stop is visible while the
        // welcome message is streaming. We just want one of them.
        const stop = window.getByRole("button", { name: "Stop", exact: true });
        const send = window.getByRole("button", { name: "Send", exact: true });
        const eitherCount =
            (await stop.count().catch(() => 0)) +
            (await send.count().catch(() => 0));
        expect(eitherCount).toBeGreaterThan(0);
    });

    await test.step("panel collapses via Collapse button", async () => {
        await window
            .getByRole("button", { name: "Collapse", exact: true })
            .click();
        await window.waitForTimeout(500);
        // After collapse the floating Open button is back.
        await expect(
            window.getByRole("button", {
                name: "Open AI Assistant",
                exact: true,
            })
        ).toBeVisible({ timeout: 3000 });
    });
});
