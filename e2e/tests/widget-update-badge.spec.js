const { test, expect } = require("@playwright/test");
const path = require("path");
const { launchApp, closeApp } = require("../helpers/electron-app");
const { seedInstalledWidgets } = require("../helpers/seed-widgets");
const {
    startMockRegistry,
    stopMockRegistry,
    registerPackage,
} = require("../helpers/mock-registry");
const {
    seedAuthToken,
    clearAuthToken,
} = require("../helpers/auth-token-injector");

/**
 * Widget update badge — UI surface for `checkUpdates`
 *
 * Pairs with `registry-update-check.spec.js` (which pins the IPC
 * itself). This spec walks the renderer surface that consumes the
 * IPC: when an installed widget is at version X and the registry has
 * X+1, Settings → Widgets shows an "Update" badge next to it.
 *
 * The hook `useWidgetUpdates` calls `mainApi.registry.checkUpdates`
 * once when the installed widgets list is available, and the
 * Widgets section renders an "Update" badge for any entry whose
 * package appears in the result map.
 *
 * Surface to pin:
 *   1. Locally-installed v1.0.0 widget + registry serving v2.0.0 →
 *      "Update" badge appears next to the widget.
 *   2. The footer's "N update(s) available" counter reflects the
 *      package count (one count per package, not per widget).
 *
 * If the badge ever stops rendering, users miss new versions
 * silently — exactly the kind of regression QA testers can't catch
 * without a registry to compare against.
 */

const FIXTURE_DIR = path.resolve(
    __dirname,
    "../../test/fixtures/folder-install-test"
);

let electronApp;
let window;
let tempUserData;
let mockRegistryPort;

test.beforeAll(async () => {
    mockRegistryPort = await startMockRegistry({ seedThemes: false });

    // Registry serves the SAME 3 packages we install locally, but at
    // a higher version. checkUpdates matches by bare name (the local
    // packages are unscoped) and emits an entry per package whose
    // registry version differs from the installed version.
    for (const name of [
        "current-weather",
        "weather-alerts",
        "weekly-forecast",
    ]) {
        registerPackage({
            type: "widget",
            scope: "trops",
            name,
            version: "2.0.0",
            metadata: {
                displayName: name
                    .split("-")
                    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                    .join(" "),
                description: "Update-badge fixture",
                author: "trops",
                category: "weather",
                tags: ["test"],
                widgets: [{ name: "Stub", displayName: "Stub" }],
            },
        });
    }

    ({ electronApp, window, tempUserData } = await launchApp({
        env: {
            DASH_REGISTRY_API_URL: `http://127.0.0.1:${mockRegistryPort}`,
        },
        hermetic: true,
    }));
    await seedAuthToken(electronApp);
    await seedInstalledWidgets(window, [FIXTURE_DIR]);
});

test.afterAll(async () => {
    await clearAuthToken(electronApp);
    await closeApp(electronApp, { tempUserData });
    await stopMockRegistry();
});

test("Settings → Widgets shows Update badge when registry has a newer version", async () => {
    await test.step("open Settings → Widgets", async () => {
        await window
            .locator("aside")
            .getByText("Account", { exact: true })
            .click();
        await window.waitForTimeout(500);
        await window
            .getByRole("button", { name: "Settings", exact: true })
            .first()
            .click();
        await window.waitForTimeout(1000);
        await window
            .getByRole("dialog")
            .getByRole("button", { name: "Widgets", exact: true })
            .first()
            .click();
        await window.waitForTimeout(500);

        await expect(window.getByText("3 widgets")).toBeVisible({
            timeout: 5000,
        });
    });

    await test.step("update check resolves and the footer counter appears", async () => {
        // The hook fires once installed widgets land in state. The
        // footer's "N update(s) available" string is keyed by package
        // count — one per package. We seeded 3 packages, all at lower
        // versions, so the counter must show 3.
        await expect(
            window.getByText("3 updates available", { exact: false })
        ).toBeVisible({ timeout: 10000 });
    });

    await test.step("each widget row has its OWN Update badge (row-scoped)", async () => {
        // Phase 4A hardening: pre-Phase-4A this step only asserted "3
        // elements with text 'Update' exist in the dialog" — a badge
        // floating in a footer somewhere would have passed. We now
        // require the badge to be a descendant of the row it belongs
        // to, keyed by the widget's actual name.
        //
        // The data-testids are added by dash-core's WidgetsSection.js:
        //   <span data-testid="widget-row-{widget.name}">
        //     <span data-testid="widget-update-badge-{widget.name}">…</span>
        //
        // If a future refactor moves the badge OUT of the row, this
        // test fails loudly — exactly what we want.
        // Widget names in `installedWidgets` are the package kebab-case
        // names (`current-weather`), not the leaf component PascalCase
        // (`CurrentWeather`) — verified via the page snapshot which
        // shows the rendered rows with `name: "current-weather"`.
        const widgetNames = [
            "current-weather",
            "weather-alerts",
            "weekly-forecast",
        ];
        for (const name of widgetNames) {
            const row = window.getByTestId(`widget-row-${name}`);
            await expect(row).toBeVisible({ timeout: 5000 });
            const badge = row.getByTestId(`widget-update-badge-${name}`);
            await expect(badge).toBeVisible({ timeout: 5000 });
            await expect(badge).toHaveText("Update");
        }
    });
});
