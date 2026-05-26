const { test, expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { closeApp } = require("../helpers/electron-app");
const {
    seedAuthToken,
    clearAuthToken,
} = require("../helpers/auth-token-injector");

/**
 * Registry discover failure surfacing — Phase 4A pin.
 *
 * The audit flagged "Network failures show a silent empty list" but
 * the recon found the error UI already exists today (per
 * DiscoverDashboardsDetail.js:134-147, DiscoverWidgetsDetail.js:356,
 * DiscoverThemesDetail.js:131). This spec is the regression pin for
 * that existing behavior — without it, a future refactor of the
 * Discover surfaces could silently swallow registry errors and ship
 * a "blank screen on offline" regression that QA can't catch.
 *
 * Pattern: point DASH_REGISTRY_API_URL at a known-unreachable port,
 * launch the app, open Settings → Dashboards' Discover tab, and
 * assert the user sees:
 *   - the error message
 *   - a Retry button
 *
 * One representative surface (Dashboards) is enough — Widgets and
 * Themes use the same `useRegistrySearch` hook + the same
 * error-render branch, so a regression in one almost certainly
 * means a regression in all three.
 *
 * The recovery half (click Retry, surface results) is deferred — it
 * would require switching env mid-test which means an app restart.
 * The audit's gate is "user must SEE the error," not "user must be
 * able to recover from it without restarting."
 */

const UNREACHABLE_REGISTRY_URL = "http://127.0.0.1:1"; // port 1 is reserved + not listening

let electronApp;
let window;
let tempUserData;

test.beforeAll(async () => {
    // Hand-rolled launch — we need the registry URL set before the
    // process starts AND we need to skip launchApp's auto-Done helper
    // because the Discover tab may not auto-open.
    const { _electron: electron } = require("playwright");
    const ROOT = path.resolve(__dirname, "../..");
    tempUserData = fs.mkdtempSync(
        path.join(os.tmpdir(), "dash-e2e-discover-fail-")
    );

    // Pre-seed the Phase 3A onboarding completion flag so the
    // first-run modal doesn't intercept Settings navigation. Inline
    // here (not via launchApp's seeder) because this spec hand-rolls
    // its own launch to set DASH_REGISTRY_API_URL before boot.
    fs.writeFileSync(
        path.join(tempUserData, "dash-onboarding.json"),
        JSON.stringify(
            {
                onboarding: {
                    completed: true,
                    completedAt: new Date().toISOString(),
                    source: "e2e-test-harness",
                },
            },
            null,
            2
        ),
        "utf-8"
    );

    // Pre-seed settings to disable auto-update-check-on-launch so the
    // AppUpdatesModal doesn't intercept clicks either. Matches what
    // launchApp's hermetic mode does for the auto-launched specs.
    const settingsDir = path.join(tempUserData, "Dashboard");
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.writeFileSync(
        path.join(settingsDir, "settings.json"),
        JSON.stringify({ checkForUpdatesOnLaunch: false }, null, 2),
        "utf-8"
    );

    electronApp = await electron.launch({
        args: [
            path.join(ROOT, "public/electron.js"),
            `--user-data-dir=${tempUserData}`,
        ],
        cwd: ROOT,
        env: {
            ...process.env,
            NODE_ENV: "development",
            DASH_E2E: "1",
            DASH_REGISTRY_API_URL: UNREACHABLE_REGISTRY_URL,
        },
    });
    window = await electronApp.firstWindow();
    await window.waitForSelector("#root > *", { timeout: 30000 });
    await window.waitForTimeout(2000);

    // Settings → Discover requires an auth token — without one, the
    // Discover UI shows a sign-in CTA instead of the search results /
    // error UI we want to test. Seed a fake token so the search path
    // runs and the unreachable URL produces the expected error.
    await seedAuthToken(electronApp);
});

test.afterAll(async () => {
    await clearAuthToken(electronApp);
    await closeApp(electronApp, { tempUserData });
});

test("Discover Dashboards shows error + Retry when registry is unreachable", async () => {
    // On a fresh hermetic launch with no folders, Settings auto-opens
    // on the Folders tab — confirmed via the test-failure snapshot.
    // No need to re-open Settings from the sidebar; navigate within
    // the already-visible dialog directly.
    //
    // We scope by the visible "Settings" heading rather than by ARIA
    // role — getByRole("dialog") was matching a hidden HeadlessUI
    // portal stub. The heading is the unambiguous anchor for the
    // visible Settings panel.
    const settingsHeading = window
        .getByText("Settings", { exact: true })
        .first();
    await expect(settingsHeading).toBeVisible({ timeout: 15000 });

    // Switch to the Dashboards tab where the Discover sub-detail
    // lives. The "Dashboards" button in the Settings sidebar is a
    // tab nav button, distinct from the workspace-level "Dashboards"
    // section title.
    await window
        .getByRole("button", { name: "Dashboards", exact: true })
        .first()
        .click();
    await window.waitForTimeout(500);

    // The Discover entry-point lives inside the Dashboards tab.
    // Labels vary by UI version ("Discover", "Browse", "Marketplace").
    // Click whichever appears.
    const discoverEntry = window
        .getByText(/Discover|Marketplace|Browse/i)
        .first();
    if (await discoverEntry.isVisible().catch(() => false)) {
        await discoverEntry.click();
        await window.waitForTimeout(500);
    }

    // The error branch in DiscoverDashboardsDetail renders an error
    // paragraph + a Retry button. The exact error text varies
    // ("Failed to search dashboard registry" or platform-specific
    // fetch errors), so we assert on the Retry button as the
    // canonical "error state surfaced to the user" signal.
    const retry = window.getByRole("button", { name: /Retry/i });
    await expect(retry).toBeVisible({ timeout: 15000 });
});
