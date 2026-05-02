const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Provider — Credential CRUD
 *
 * Walks Settings → Providers → New Provider → Credential and creates
 * a fake API-key provider, then confirms it lands in the providers
 * list. Hermetic launch — no real provider data, no real keys.
 *
 * Selectors derived from `node scripts/explore-ui.js --to
 * settings.providers.newCredential`.
 */

let electronApp;
let window;
let tempUserData;

const PROVIDER_NAME = "E2E Test Provider";
const PROVIDER_TYPE = "e2e-test";

test.beforeAll(async () => {
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
});

test("create credential provider via Settings → Providers", async () => {
    await test.step("open Settings → Providers", async () => {
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
            .getByRole("button", { name: "Providers", exact: true })
            .first()
            .click();
        await window.waitForTimeout(500);

        await expect(window.getByText("0 providers")).toBeVisible({
            timeout: 5000,
        });
    });

    await test.step("open New Provider → Credential form", async () => {
        await window.getByText("New Provider", { exact: true }).click();
        await window.waitForTimeout(500);
        await window
            .getByRole("button", { name: /Credential.*API key/ })
            .click();
        await window.waitForTimeout(500);

        await expect(
            window.getByRole("textbox", { name: "Provider name" })
        ).toBeVisible({ timeout: 5000 });
    });

    await test.step("fill name + type + apiKey value", async () => {
        await window
            .getByRole("textbox", { name: "Provider name" })
            .fill(PROVIDER_NAME);
        await window
            .getByRole("textbox", {
                name: "Provider type (e.g. algolia, openai)",
            })
            .fill(PROVIDER_TYPE);
        await window
            .getByRole("textbox", { name: "Enter apiKey" })
            .fill("sk-test-fake-token");
    });

    await test.step("submit Create — provider appears in list", async () => {
        await window
            .getByRole("button", { name: "Create", exact: true })
            .click();
        await window.waitForTimeout(1500);

        // Provider count should jump to 1 and our name should appear.
        await expect(window.getByText("1 provider")).toBeVisible({
            timeout: 5000,
        });
        await expect(
            window.getByText(PROVIDER_NAME, { exact: true }).first()
        ).toBeVisible({ timeout: 5000 });
    });
});
