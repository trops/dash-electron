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

test.describe("Empty State", () => {
    test("shows 'No dashboards open' title", async () => {
        await expect(window.getByText("No dashboards open")).toBeVisible();
    });

    test("shows description with keyboard hint", async () => {
        await expect(
            window.getByText(
                "Press ⌘K to search dashboards, or create a new one."
            )
        ).toBeVisible();
    });

    test("shows Search action button in empty state area", async () => {
        // The empty state area is outside the sidebar (aside).
        // Target the button's <span> text exactly to avoid matching the description.
        const mainContent = window.locator(
            "div.flex.flex-1.items-center.justify-center"
        );
        await expect(
            mainContent.getByText("Search", { exact: true })
        ).toBeVisible();
    });

    test("shows New Dashboard action button in empty state area", async () => {
        const mainContent = window.locator(
            "div.flex.flex-1.items-center.justify-center"
        );
        await expect(mainContent.getByText("New Dashboard")).toBeVisible();
    });
});
