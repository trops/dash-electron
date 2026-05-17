const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Widget Builder — Test inputs persist across composition recompiles
 *
 * Regression spec for the bug: typing a value into the preview's
 * "Test inputs" panel (e.g. `indexName = "airports"`) for a wired
 * Algolia search, then editing any other part of the composition
 * (drop a Heading, tweak a prop, reorder, …) wiped the typed value.
 *
 * Cause: WidgetBuilderModal's compile-success branch called
 * `setPreviewTestInputs({})` on every recompile. Recompile fires on
 * every grid edit, so any unrelated change blew away the user's
 * inputs.
 *
 * Fix: the success branch now preserves entries whose key still
 * exists in the new userConfig schema; only keys that disappeared
 * are dropped.
 *
 * Setup:
 *   1. Open the builder (defaults to Compose since 0.0.718).
 *   2. Start blank from the quick-start pane → palette opens on seed.
 *   3. Drop SearchInput; the inspector opens automatically.
 *   4. Expand onChange wire → pick algolia → search method. The
 *      auto-bind fix populates `indexName` as userConfig.indexName.
 *   5. Close the inspector.
 *   6. Type "regression_value" into the indexName test input,
 *      click Apply.
 *   7. Drop a Heading into a new row.
 *   8. Assert: the indexName test input still reads
 *      "regression_value". (Before the fix it reverted to empty.)
 */

let electronApp;
let window;
let tempUserData;

test.beforeAll(async () => {
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
});

test("typing into a test input survives recompiling the composition", async () => {
    await test.step("app reaches steady state", async () => {
        await window.waitForTimeout(2000);
    });

    await test.step("open the widget builder (Compose is the default tab)", async () => {
        await window.evaluate(() => {
            window.dispatchEvent(new CustomEvent("dash:open-widget-builder"));
        });
        await expect(
            window.locator('[data-testid="widget-builder-modal"]')
        ).toBeAttached({ timeout: 10000 });
        await expect(
            window.locator('[data-testid="composer-pane-v2"]')
        ).toBeVisible({ timeout: 5000 });
    });

    await test.step("skip the intent wizard and drop a SearchInput", async () => {
        await window
            .locator('[data-testid="composer-quick-start-scratch"]')
            .click();
        await window
            .locator('[data-testid="composer-palette-pick-SearchInput"]')
            .click();
    });

    await test.step("wire onChange → algolia.search", async () => {
        // Selecting the just-filled cell opens the inspector
        // (setCellComponent calls setSelectedCellId).
        await expect(
            window.locator('[data-testid="composer-inspector-cell-1"]')
        ).toBeVisible({ timeout: 3000 });
        // onChange is auto-state and collapsed by default; expand it
        // so the wire picker is visible.
        await window
            .locator('[data-testid="composer-prop-toggle-onChange"]')
            .click();
        await window
            .locator('[data-testid="composer-wire-provider-onChange-algolia"]')
            .first()
            .click();
        await window
            .locator('[data-testid="composer-wire-method-onChange-search"]')
            .click();
        // applyCallbackArgDefaults pre-binds indexName as
        // userConfig.indexName — no further wire setup needed.
        await window.locator('[data-testid="composer-inspector-done"]').click();
    });

    await test.step("type a value into the indexName test input + Apply", async () => {
        const indexInput = window.locator(
            '[data-testid="preview-test-input-indexName"]'
        );
        await expect(indexInput).toBeVisible({ timeout: 5000 });
        await indexInput.fill("regression_value");
        const apply = window.locator(
            '[data-testid="preview-test-inputs-apply"]'
        );
        await expect(apply).toBeEnabled({ timeout: 2000 });
        await apply.click();
        // After Apply the input should still read what we typed —
        // the form re-syncs from parent's `values` map.
        await expect(indexInput).toHaveValue("regression_value", {
            timeout: 2000,
        });
    });

    await test.step("recompile the composition by adding a Heading", async () => {
        // Add a row (the + Row affordance lives at the bottom of the
        // grid), then click its empty cell to open the palette, then
        // pick Heading. This is a structural change that triggers a
        // full recompile of the widget bundle.
        await window
            .locator('[data-testid="composer-grid-grid-root-add-row"]')
            .click();
        // The new row's cell is cell-2 (cell-1 holds the SearchInput).
        // Clicking the "+ Add component" button on an empty cell
        // opens the palette inline.
        await window
            .locator('[data-testid="composer-cell-cell-2-add"]')
            .click();
        await window
            .locator('[data-testid="composer-palette-pick-Heading"]')
            .click();
        // Wait long enough that the compile cycle has fired.
        await window.waitForTimeout(1500);
    });

    await test.step("indexName test input survived the recompile (regression)", async () => {
        const indexInput = window.locator(
            '[data-testid="preview-test-input-indexName"]'
        );
        await expect(indexInput).toBeVisible();
        await expect(indexInput).toHaveValue("regression_value");
    });
});
