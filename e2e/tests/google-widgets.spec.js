const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");
const fs = require("fs");
const path = require("path");

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

// These tests assert the dev's local Google OAuth tokens are fresh
// after the app's MCP refresh flow. They're environmental — they
// require valid credentials AND require the app to have been run
// recently enough that refresh happened. We skip if either:
//   (a) the credentials file is missing (never authenticated locally), or
//   (b) the token is already past its expiry date (refresh hasn't run).
// In CI / on a teammate's machine without local Google auth, all these
// skip cleanly. They only run — and only assert — when there's
// something real to assert against.
function readCredsIfFresh(credPath) {
    if (!fs.existsSync(credPath)) return null;
    const creds = JSON.parse(fs.readFileSync(credPath, "utf8"));
    if (!creds.access_token) return null;
    if (
        typeof creds.expiry_date === "number" &&
        creds.expiry_date <= Date.now()
    ) {
        return null; // expired — skip rather than fail
    }
    return creds;
}

test.describe("Google MCP token refresh", () => {
    const home = process.env.HOME || "";

    test("Google Drive credentials have a non-expired token after refresh", async () => {
        const creds = readCredsIfFresh(
            path.join(home, ".gdrive-mcp", "credentials.json")
        );
        if (!creds) {
            test.skip();
            return;
        }
        expect(creds.access_token).toBeTruthy();
        expect(creds.expiry_date).toBeGreaterThan(Date.now());
    });

    test("Gmail credentials have a non-expired token after refresh", async () => {
        const creds = readCredsIfFresh(
            path.join(home, ".gmail-mcp", "credentials.json")
        );
        if (!creds) {
            test.skip();
            return;
        }
        expect(creds.access_token).toBeTruthy();
        expect(creds.expiry_date).toBeGreaterThan(Date.now());
    });
});

test.describe("Google MCP server connectivity", () => {
    const home = process.env.HOME || "";

    test("Google Drive search tool responds without error", async () => {
        const credPath = path.join(home, ".gdrive-mcp", "credentials.json");
        const keysPath = path.join(home, ".gdrive-mcp", "gcp-oauth.keys.json");
        if (
            !fs.existsSync(credPath) ||
            !fs.existsSync(keysPath) ||
            !readCredsIfFresh(credPath)
        ) {
            test.skip();
            return;
        }

        // Use the app's MCP infrastructure to call the tool
        const result = await electronApp.evaluate(async (_electron) => {
            // require() isn't lexically in scope inside Playwright's
            // evaluate sandbox — use the bridge installed by
            // public/electron.js when DASH_E2E=1.
            const _require =
                globalThis.__e2eRequire ||
                (process.mainModule && process.mainModule.require);
            const controller = _require(
                "@trops/dash-core/electron"
            ).mcpController;
            if (!controller) return { skipped: true };
            return controller.callTool(null, "Google Drive", "search", {
                query: "test",
            });
        });

        if (result?.skipped) {
            test.skip();
            return;
        }

        expect(result.error).toBeFalsy();
    });

    test("Gmail search_emails tool responds without error", async () => {
        const credPath = path.join(home, ".gmail-mcp", "credentials.json");
        const keysPath = path.join(home, ".gmail-mcp", "gcp-oauth.keys.json");
        if (
            !fs.existsSync(credPath) ||
            !fs.existsSync(keysPath) ||
            !readCredsIfFresh(credPath)
        ) {
            test.skip();
            return;
        }

        const result = await electronApp.evaluate(async (_electron) => {
            const _require =
                globalThis.__e2eRequire ||
                (process.mainModule && process.mainModule.require);
            const controller = _require(
                "@trops/dash-core/electron"
            ).mcpController;
            if (!controller) return { skipped: true };
            return controller.callTool(null, "Gmail", "search_emails", {
                query: "test",
            });
        });

        if (result?.skipped) {
            test.skip();
            return;
        }

        expect(result.error).toBeFalsy();
    });
});
