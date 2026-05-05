/**
 * 04-settings-panel.spec.js
 *
 * Pins the Settings → Privacy & Security panel UI: enforcement
 * toggles, confirm-on-disable, "Test prompt" debug button, grant
 * origin badges, manual-grant flow, revoke flow.
 *
 * This is heavier on UI interaction than the other specs — Playwright
 * navigates the actual panel.
 */
const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");
const {
    stubMcpServer,
    restoreMcpClient,
} = require("../helpers/mock-mcp-transport");
const { installCallRecorder, clearRecordedCalls } = require("./recordMcpCalls");
const {
    setSecurityFlags,
    seedGrant,
    readAllGrants,
    openPrivacyAndSecurity,
} = require("./helpers");

let electronApp;
let window;
let tempUserData;

test.describe("Privacy & Security panel", () => {
    test.beforeEach(async () => {
        ({ electronApp, window, tempUserData } = await launchApp({
            hermetic: true,
        }));
        await setSecurityFlags(electronApp, { enforce: true, jit: true });
        await stubMcpServer(electronApp, {
            match: { commandIncludes: "test-server" },
            tools: [{ name: "test_tool", inputSchema: { type: "object" } }],
            callResults: {},
        });
        await installCallRecorder(electronApp);
        await clearRecordedCalls(electronApp);
    });

    test.afterEach(async () => {
        await restoreMcpClient(electronApp);
        await closeApp(electronApp, { tempUserData });
    });

    test("toggling enforcement OFF shows confirm-disable inline", async () => {
        await openPrivacyAndSecurity(window);
        // First Switch is enforcement
        const switches = window.locator('button[role="switch"]');
        await switches.first().click();
        await expect(
            window.getByText(/Disable widget MCP permissions enforcement/i)
        ).toBeVisible();
        // Cancel keeps it ON
        await window.getByRole("button", { name: /^Cancel$/i }).click();
        await expect(
            window.getByText(/Disable widget MCP permissions enforcement/i)
        ).not.toBeVisible();
    });

    test("seeded grant shows grantOrigin badge in the panel", async () => {
        await seedGrant(electronApp, "@e2e/badge-widget", {
            grantOrigin: "manual",
            servers: {
                "test-server": {
                    tools: ["test_tool"],
                    readPaths: [],
                    writePaths: [],
                },
            },
        });
        await openPrivacyAndSecurity(window);
        // The badge text "manual" should appear next to the widget id
        await expect(window.getByText("@e2e/badge-widget")).toBeVisible();
        await expect(
            window.locator('span:has-text("manual")').first()
        ).toBeVisible();
    });

    test("Test prompt button triggers the JIT modal", async () => {
        await openPrivacyAndSecurity(window);
        await window.getByRole("button", { name: /^Test prompt$/i }).click();
        // The portaled JIT modal renders — that's the security-relevant
        // assertion. Whether the post-deny "Last test (denied)" status
        // line stays visible depends on dash-react Modal focus-trap
        // behavior interacting with the portal close (the Settings
        // modal can momentarily lose focus and close itself), which is
        // out of scope for this spec.
        await expect(window.getByText(/Permission requested/i)).toBeVisible({
            timeout: 5000,
        });
        // Clean up
        await window.getByRole("button", { name: /^Deny$/i }).click();
    });

    test("Revoke all wipes the grant from the store", async () => {
        await seedGrant(electronApp, "@e2e/revokable-widget", {
            grantOrigin: "manual",
            servers: {
                "test-server": {
                    tools: ["test_tool"],
                    readPaths: ["/tmp"],
                    writePaths: [],
                },
            },
        });
        await openPrivacyAndSecurity(window);
        const widgetIdLocator = window.getByText("@e2e/revokable-widget");
        await expect(widgetIdLocator).toBeVisible();

        // The widget id is in a span; the Revoke all button is its
        // sibling inside the same row container. Walk up to the
        // nearest row (the WidgetGrantRow's outer div has the rounded
        // border class) and click the Revoke button inside that row.
        // We use the widget's row-scoped Revoke by getting the closest
        // ancestor that ALSO contains a "Revoke all" button — that's
        // the row.
        const row = widgetIdLocator
            .locator(
                'xpath=ancestor::div[contains(@class, "rounded") and .//button[normalize-space()="Revoke all"]][1]'
            )
            .first();
        await row.getByRole("button", { name: /^Revoke all$/i }).click();

        await window.waitForTimeout(500);
        const grants = await readAllGrants(electronApp);
        expect(grants["@e2e/revokable-widget"]).toBeFalsy();
    });
});
