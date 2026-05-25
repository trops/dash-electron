const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Theme Studio → Channel Editor — E2E.
 *
 * Pins two contracts on the per-channel hex picker that lives
 * inside the Theme Studio:
 *
 *   1. On open, exactly one swatch in the visible grid shows the
 *      "selected" indicator (yellow border + check icon, surfaced
 *      via `aria-pressed=true` + an "(selected)" suffix on the
 *      accessible name).
 *   2. After picking a different swatch and re-opening the
 *      editor, that newly-picked swatch is the one highlighted
 *      (exact-match round trip — guards against the read/write
 *      mismatch bug fixed in dash-core 0.1.591 where the modal
 *      read theme[variant][channel] but the picker wrote to
 *      rawTheme[channel]).
 *
 * Navigation:
 *   Sidebar Account → Settings → Themes → first theme → Edit
 *     (Settings closes, ThemeManagerModal opens on the picker)
 *   → Edit in the modal footer (Studio renders)
 *   → BaseColorRail "Edit Primary color" rail button
 *     (ChannelEditorModal mounts)
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

async function openChannelEditor(win) {
    // From Settings → Themes → click first theme → Edit → modal Edit → rail
    const rail = win.getByRole("button", { name: "Edit Primary color" });
    await expect(rail).toBeVisible({ timeout: 5000 });
    await rail.click();
    await expect(win.getByText("Edit Theme Colors")).toBeVisible({
        timeout: 5000,
    });
}

async function closeChannelEditor(win) {
    // ChannelEditorModal footer has a single "Done" button.
    const done = win.getByRole("button", { name: /^Done$/ });
    await done.first().click();
    await expect(win.getByText("Edit Theme Colors")).toBeHidden({
        timeout: 5000,
    });
}

test("Theme Studio → Channel Editor — selected indicator + exact-match round trip", async () => {
    // ---- Step 1: navigate to the Studio --------------------------------
    await window.locator("aside").getByText("Account", { exact: true }).click();
    await window.waitForTimeout(500);
    await window
        .getByRole("button", { name: "Settings", exact: true })
        .first()
        .click();
    await window.waitForTimeout(1000);
    await window
        .getByRole("dialog")
        .getByRole("button", { name: "Themes", exact: true })
        .first()
        .click();
    await window.waitForTimeout(500);

    // ThemesSection auto-selects the active theme; the ThemeDetail
    // pane shows an Edit button at the bottom. Click it — Settings
    // closes, ThemeManagerModal opens.
    await window
        .getByRole("button", { name: /^Edit$/ })
        .first()
        .click();
    await window.waitForTimeout(800);

    // Modal opens on the picker. Click Edit in the modal footer
    // to enter PanelThemeStudio.
    await window
        .getByRole("button", { name: /^Edit$/ })
        .first()
        .click();
    await window.waitForTimeout(500);

    // Wait for the Studio's BaseColorRail to render.
    await expect(window.getByText("Base Colors")).toBeVisible({
        timeout: 5000,
    });

    // ---- Step 2: open channel editor, assert single highlight ----------
    await openChannelEditor(window);

    // Exactly one swatch carries the "(selected)" marker that
    // ChannelEditorModal stamps onto the active swatch's aria-label.
    const selectedSwatch = window.getByLabel(/\(selected\)$/);
    await expect(selectedSwatch).toHaveCount(1, { timeout: 5000 });

    // ---- Step 3: pick a different swatch + close -----------------------
    // Find any non-selected swatch and click it. Capture its hex
    // for the round-trip check below.
    const unselectedSwatches = window.getByLabel(/^Pick #[0-9a-fA-F]{6}$/);
    const targetCount = await unselectedSwatches.count();
    expect(targetCount).toBeGreaterThan(1);

    const target = unselectedSwatches.first();
    const targetLabel = await target.getAttribute("aria-label");
    const hexMatch = targetLabel && targetLabel.match(/#([0-9a-fA-F]{6})/);
    expect(hexMatch).not.toBeNull();
    const pickedHex = `#${hexMatch[1].toLowerCase()}`;

    await target.click();
    // Give React + the parent's onUpdate cycle a tick to commit
    // before we close the modal.
    await window.waitForTimeout(300);
    await closeChannelEditor(window);

    // ---- Step 4: reopen, assert pickedHex is the highlight -------------
    await openChannelEditor(window);

    // The previously-picked swatch should now carry the
    // "(selected)" marker. Exact-match — no nearest-neighbor drift.
    const newSelected = window.getByLabel(
        new RegExp(`Pick ${pickedHex} \\(selected\\)`, "i")
    );
    await expect(newSelected).toHaveCount(1, { timeout: 5000 });
});
