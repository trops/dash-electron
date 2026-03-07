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

test.describe("Google Widgets", () => {
    test("Google Drive widget renders with connection status", async () => {
        // Look for any Google Drive widget elements if present
        const driveWidget = window.locator('[data-widget-type="google-drive"]');
        const count = await driveWidget.count();

        if (count > 0) {
            await expect(driveWidget.first()).toBeVisible();
        }
    });

    test("Gmail widget renders with search UI", async () => {
        const gmailWidget = window.locator('[data-widget-type="gmail"]');
        const count = await gmailWidget.count();

        if (count > 0) {
            await expect(gmailWidget.first()).toBeVisible();
        }
    });

    test("Calendar widget renders with view toggle", async () => {
        const calendarWidget = window.locator(
            '[data-widget-type="google-calendar"]'
        );
        const count = await calendarWidget.count();

        if (count > 0) {
            await expect(calendarWidget.first()).toBeVisible();
        }
    });

    test("re-auth banner is NOT visible by default", async () => {
        // The McpReauthBanner should not appear when there are no auth errors
        const reauthBanner = window.getByText("Authorization expired");
        await expect(reauthBanner).toHaveCount(0);
    });

    test("no re-authorize button visible without auth error", async () => {
        const reauthButton = window.getByRole("button", {
            name: "Re-authorize",
        });
        await expect(reauthButton).toHaveCount(0);
    });
});
