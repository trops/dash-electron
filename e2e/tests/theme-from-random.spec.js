const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Theme from Random — wizard smoke test (via ThemeManagerModal).
 *
 * After dash-core 0.1.586, theme creation lives in
 * ThemeManagerModal. Navigate Settings → Themes → New Theme →
 * From Random, verify the random palette renders, click
 * Regenerate to confirm a fresh palette appears, then fill name
 * and confirm Create Theme enables.
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

test("Theme from Random — palette renders + Regenerate produces fresh palette", async () => {
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
    await window.getByText("From Random", { exact: true }).click();
    await window.waitForTimeout(500);

    await expect(
        window.getByText("Generated Palette", { exact: true })
    ).toBeVisible({ timeout: 5000 });

    // Capture the inline backgroundColor styles on the palette
    // tiles before + after Regenerate; assert at least one
    // channel changes. PaletteSwatch renders `style="backgroundColor: <hex>"`
    // on the colored block, which is more reliable than scraping
    // hex text (RandomPreview doesn't render hex labels).
    async function captureSwatchColors() {
        return await window.evaluate(() => {
            const nodes = Array.from(
                document.querySelectorAll('[style*="background-color"]')
            );
            return nodes
                .map((n) => n.style.backgroundColor)
                .filter((c) => c && c.startsWith("rgb"));
        });
    }
    const before = await captureSwatchColors();
    expect(before.length).toBeGreaterThanOrEqual(4);

    await window
        .getByRole("button", { name: /Regenerate/i })
        .first()
        .click();
    await window.waitForTimeout(300);

    const after = await captureSwatchColors();
    expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));

    // Palette still renders all 4 channel labels after Regenerate.
    for (const label of ["Primary", "Secondary", "Tertiary", "Neutral"]) {
        await expect(
            window.getByText(label, { exact: true }).first()
        ).toBeVisible();
    }

    // Fill Theme name; Create Theme gated on non-empty name.
    await window.getByPlaceholder("Theme name...").first().fill("Test Random");

    const createBtn = window.getByRole("button", { name: /^Create Theme$/ });
    await expect(createBtn).toBeEnabled({ timeout: 5000 });
});
