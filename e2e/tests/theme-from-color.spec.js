const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Theme from Colors — wizard smoke test (via ThemeManagerModal).
 *
 * After dash-core 0.1.586, theme creation lives in
 * ThemeManagerModal. Navigate Settings → Themes → New Theme →
 * From Colors, verify the harmony-based Generated Palette
 * renders, then fill name and confirm Create Theme enables.
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

test("Theme from Colors — palette renders + Create Theme enables", async () => {
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
    await window.getByText("New Theme", { exact: true }).click();
    await window.waitForTimeout(800);
    await window.getByText("From Colors", { exact: true }).click();
    await window.waitForTimeout(500);

    // Harmony picker mounts with a default base color, so the
    // Generated Palette label is present immediately.
    await expect(
        window.getByText("Generated Palette", { exact: true })
    ).toBeVisible({ timeout: 5000 });

    // Palette swatch labels render.
    for (const label of ["Primary", "Secondary", "Tertiary", "Neutral"]) {
        await expect(
            window.getByText(label, { exact: true }).first()
        ).toBeVisible({ timeout: 3000 });
    }

    // Fill the Theme name; Create Theme is gated on it. The
    // harmony preview already auto-committed a theme via
    // setWizardTheme on mount.
    await window.getByPlaceholder("Theme name...").first().fill("Test Colors");

    const createBtn = window.getByRole("button", { name: /^Create Theme$/ });
    await expect(createBtn).toBeEnabled({ timeout: 5000 });
});
