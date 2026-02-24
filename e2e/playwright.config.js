// @ts-check
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
    testDir: "./tests",
    timeout: 60000,
    expect: {
        timeout: 10000,
    },
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [["html", { open: "never" }]],
    use: {
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
    },
    webServer: {
        command: "BROWSER=none npm start",
        url: "http://localhost:3000",
        timeout: 60000,
        reuseExistingServer: true,
        cwd: "..",
    },
});
