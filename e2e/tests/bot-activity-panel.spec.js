const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Bot Activity — panel mounts cleanly (Slice 7-Activity)
 *
 * Smoke-test for the Bot Activity slide-over: the collapsed "Open Bot
 * Activity" rail button opens the panel, the run control + empty feed
 * render, and it collapses again. Doesn't exercise a live bot run
 * (needs a configured Anthropic provider); the IPC round-trip and the
 * feed reducer are covered separately (runFeed.test.js + the Slice-4b
 * bots IPC smoke).
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

test("Bot Activity panel opens, structure renders, closes cleanly", async () => {
    await test.step("panel opens via the collapsed rail button", async () => {
        await window
            .getByRole("button", { name: "Open Bot Activity", exact: true })
            .click();
        await window.waitForTimeout(1000);
        await expect(window.getByText("BOT ACTIVITY").first()).toBeVisible({
            timeout: 5000,
        });
    });

    await test.step("run control + empty feed render", async () => {
        await expect(window.getByText("Run a bot").first()).toBeVisible({
            timeout: 5000,
        });
        await expect(window.getByText("No run yet").first()).toBeVisible({
            timeout: 5000,
        });
    });

    await test.step("panel collapses via the Collapse button", async () => {
        await window
            .getByRole("button", { name: "Collapse", exact: true })
            .click();
        await window.waitForTimeout(500);
        await expect(
            window.getByRole("button", {
                name: "Open Bot Activity",
                exact: true,
            })
        ).toBeVisible({ timeout: 5000 });
    });
});
