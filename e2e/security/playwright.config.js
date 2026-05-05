// @ts-check
const { defineConfig } = require("@playwright/test");

/**
 * Playwright config for the MCP security E2E suite. Mirrors the main
 * e2e/playwright.config.js shape but scopes testDir to ./security and
 * doesn't share workers with the broader suite — every test launches
 * its own Electron instance with a hermetic temp user-data dir.
 */
module.exports = defineConfig({
    testDir: ".",
    timeout: 90000,
    expect: {
        timeout: 10000,
    },
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [
        [
            "html",
            { open: "never", outputFolder: "../../playwright-report-security" },
        ],
    ],
    use: {
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
    },
    webServer: {
        command: "BROWSER=none npm start",
        url: "http://localhost:3000",
        timeout: 60000,
        reuseExistingServer: true,
        cwd: "../..",
    },
});
