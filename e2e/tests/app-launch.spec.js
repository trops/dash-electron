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

test.describe("App Launch", () => {
    test("window opens with correct minimum dimensions", async () => {
        const { width, height } = await window.evaluate(() => ({
            width: window.innerWidth,
            height: window.innerHeight,
        }));
        expect(width).toBeGreaterThanOrEqual(1024);
        expect(height).toBeGreaterThanOrEqual(768);
    });

    test("React mounts inside #root", async () => {
        const rootChildren = await window.locator("#root > *").count();
        expect(rootChildren).toBeGreaterThan(0);
    });

    test("no JavaScript console errors on load", async () => {
        const errors = [];
        window.on("console", (msg) => {
            if (msg.type() === "error") {
                errors.push(msg.text());
            }
        });

        // Give a moment for any late errors to surface
        await window.waitForTimeout(2000);
        expect(errors).toEqual([]);
    });

    test("app title is set", async () => {
        const title = await window.title();
        expect(title.length).toBeGreaterThan(0);
    });
});
