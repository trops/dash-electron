const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Bots — the dock panel mounts cleanly (bot-teams TEAM-015)
 *
 * Smoke-test for the dock's Bots panel: the rail's Bots button opens it, the
 * contacts controls render (search, Recent / A–Z, By team) — on a fresh
 * install with no bots it says so — and it collapses again. Chatting with a
 * bot needs a configured AI; that path is covered by dash-core's BotContacts
 * and BotChat tests.
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

test("Bots panel opens, contacts controls render, closes cleanly", async () => {
    await test.step("panel opens via the dock's Bots button", async () => {
        await window.getByRole("button", { name: "Bots", exact: true }).click();
        await window.waitForTimeout(1000);
        await expect(window.getByTestId("bot-contacts")).toBeVisible({
            timeout: 5000,
        });
    });

    await test.step("search, sort and grouping render; no bots yet", async () => {
        await expect(window.getByLabel("Search bots")).toBeVisible();
        await expect(
            window.getByRole("radio", { name: "Recent", exact: true })
        ).toBeVisible();
        await expect(
            window.getByRole("radio", { name: "A–Z", exact: true })
        ).toBeVisible();
        await expect(window.getByText("By team").first()).toBeVisible();
        await expect(window.getByText("No bots yet").first()).toBeVisible({
            timeout: 5000,
        });
    });

    await test.step("panel collapses via the Collapse button", async () => {
        await window
            .getByRole("button", { name: "Collapse", exact: true })
            .click();
        await window.waitForTimeout(500);
        await expect(
            window.getByRole("button", { name: "Bots", exact: true })
        ).toBeVisible({ timeout: 5000 });
    });
});
