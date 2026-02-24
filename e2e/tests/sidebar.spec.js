const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

let electronApp;
let window;
let sidebar;

test.beforeAll(async () => {
    ({ electronApp, window } = await launchApp());
    // Scope all sidebar tests to the <aside> element
    sidebar = window.locator("aside");
});

test.afterAll(async () => {
    await closeApp(electronApp);
});

test.describe("Sidebar", () => {
    test("renders Home item", async () => {
        await expect(sidebar.getByText("Home")).toBeVisible();
    });

    test("renders Search item", async () => {
        await expect(sidebar.getByText("Search")).toBeVisible();
    });

    test("renders Providers item", async () => {
        await expect(sidebar.getByText("Providers")).toBeVisible();
    });

    test("renders Themes item", async () => {
        await expect(sidebar.getByText("Themes")).toBeVisible();
    });

    test("renders Folders item", async () => {
        await expect(sidebar.getByText("Folders")).toBeVisible();
    });

    test("renders Settings item", async () => {
        await expect(sidebar.getByText("Settings")).toBeVisible();
    });

    test("renders Dashboards group", async () => {
        await expect(sidebar.getByText("Dashboards")).toBeVisible();
    });

    test("renders theme toggle with Dark Mode or Light Mode text", async () => {
        const darkMode = sidebar.getByText("Dark Mode");
        const lightMode = sidebar.getByText("Light Mode");

        const darkVisible = await darkMode.isVisible().catch(() => false);
        const lightVisible = await lightMode.isVisible().catch(() => false);

        expect(darkVisible || lightVisible).toBe(true);
    });
});
