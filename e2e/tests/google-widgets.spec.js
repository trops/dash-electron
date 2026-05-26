const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Google widgets — McpReauthBanner default-state regression pin.
 *
 * Audit cleanup (#26): the original file mixed three classes of
 * "tests":
 *   - 3 widget-render checks gated on `if (count > 0)` — trivially
 *     satisfied in the hermetic harness where no Google widget is
 *     mounted, so they asserted nothing and pretended to be coverage.
 *   - 2 token-refresh tests that read local OAuth creds and
 *     test.skip()'d when absent — environmental dev-machine
 *     validation, no CI value.
 *   - 2 MCP connectivity tests with the same skip-on-absent pattern.
 *
 * All of those were either noop in CI or noop on machines without
 * local Google auth — masquerading-as-coverage that's worse than no
 * test (the audit's phrase). The simpler closure than a full
 * mock-Google harness (~multi-day project) is to delete the noise
 * and keep only the assertions that fire deterministically.
 *
 * What stays here: the negative assertions about the
 * `McpReauthBanner`. The banner appears when a Google MCP provider
 * has an expired token; the default state is hidden. Both checks use
 * `toHaveCount(0)` so they fail loudly if a regression renders the
 * banner unconditionally.
 */

let electronApp;
let window;

test.beforeAll(async () => {
    ({ electronApp, window } = await launchApp());
});

test.afterAll(async () => {
    await closeApp(electronApp);
});

test.describe("McpReauthBanner default state", () => {
    test("re-auth banner is NOT visible by default", async () => {
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
