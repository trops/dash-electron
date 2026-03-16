const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");
const { startTestServer, stopTestServer } = require("../helpers/test-server");

let electronApp;
let window;
let testServerPort;

test.beforeAll(async () => {
    // Start local test server for deterministic results
    testServerPort = await startTestServer();

    ({ electronApp, window } = await launchApp());
});

test.afterAll(async () => {
    await closeApp(electronApp);
    await stopTestServer();
});

/**
 * Navigate to the Theme from URL pane:
 * 1. Click "Themes" in sidebar → opens Settings modal with Themes section
 * 2. Click "New Theme" button
 * 3. Click "From Website" card
 */
async function navigateToThemeFromUrl(win) {
    // Click "Themes" in sidebar
    const sidebar = win.locator("aside");
    await sidebar.getByText("Themes").click();
    await win.waitForTimeout(1000);

    // Click "New Theme" button
    const newThemeBtn = win.getByText("New Theme", { exact: true });
    await expect(newThemeBtn).toBeVisible({ timeout: 5000 });
    await newThemeBtn.click();
    await win.waitForTimeout(500);

    // Click "From Website" card
    const fromWebsiteCard = win.getByText("From Website", { exact: true });
    await expect(fromWebsiteCard).toBeVisible({ timeout: 5000 });
    await fromWebsiteCard.click();
    await win.waitForTimeout(500);

    // Verify we're on the Theme from URL pane
    await expect(
        win.getByText("Generate from Website", { exact: true })
    ).toBeVisible({ timeout: 5000 });
}

test.describe("Theme from URL", () => {
    test.beforeEach(async () => {
        await navigateToThemeFromUrl(window);
    });

    test("happy path — extract colors from a colorful page", async () => {
        const urlInput = window.locator('input[type="url"]');
        await urlInput.fill(`http://127.0.0.1:${testServerPort}/colorful`);

        const extractBtn = window.getByText("Extract", { exact: true });
        await extractBtn.click();

        // Wait for extraction to complete — loading indicator should appear then disappear
        await expect(
            window.getByText("Scanning page for colors...")
        ).toBeVisible({ timeout: 5000 });
        await expect(
            window.getByText("Scanning page for colors...")
        ).toBeHidden({ timeout: 30000 });

        // Verify color swatches appeared (PalettePreviewPane renders role labels)
        await expect(window.getByText("PRIMARY")).toBeVisible({
            timeout: 5000,
        });
        await expect(window.getByText("SECONDARY")).toBeVisible();

        // Verify Generate Theme button appears
        await expect(window.getByText("Generate Theme")).toBeVisible({
            timeout: 5000,
        });
    });

    test("timeout / unreachable URL — shows error within 20s", async () => {
        const urlInput = window.locator('input[type="url"]');
        await urlInput.fill(`http://127.0.0.1:${testServerPort}/slow`);

        const extractBtn = window.getByText("Extract", { exact: true });
        await extractBtn.click();

        // Should show loading state
        await expect(window.getByText("Extracting...")).toBeVisible({
            timeout: 5000,
        });

        // Error should appear within 25s (20s client-side timeout + buffer)
        const errorText = window.locator(".text-red-400");
        await expect(errorText).toBeVisible({ timeout: 25000 });

        // Should show the timeout error message
        await expect(
            window.getByText("The site took too long to load", { exact: false })
        ).toBeVisible();

        // Try Again button should be visible
        await expect(window.getByText("Try Again")).toBeVisible();
    });

    test("invalid URL format — shows validation error", async () => {
        const urlInput = window.locator('input[type="url"]');
        await urlInput.fill("not-a-valid-url");

        // Validation error should appear
        await expect(
            window.getByText("Enter a valid URL starting with http://", {
                exact: false,
            })
        ).toBeVisible({ timeout: 3000 });

        // Extract button should be disabled
        const extractBtn = window.getByText("Extract", { exact: true });
        const button = extractBtn.locator("..");
        await expect(button).toBeDisabled();
    });

    test("no colors found — shows appropriate message", async () => {
        const urlInput = window.locator('input[type="url"]');
        await urlInput.fill(`http://127.0.0.1:${testServerPort}/minimal`);

        const extractBtn = window.getByText("Extract", { exact: true });
        await extractBtn.click();

        // Wait for extraction to complete
        await expect(window.getByText("Extracting...")).toBeVisible({
            timeout: 5000,
        });

        // Should show error (either "no usable colors" or an extraction error)
        const errorText = window.locator(".text-red-400");
        await expect(errorText).toBeVisible({ timeout: 30000 });

        // Should show an error message (no colors or extraction related)
        const errorMessage = await errorText.textContent();
        expect(errorMessage.length).toBeGreaterThan(0);
    });

    test("retry button — clicking Try Again re-runs extraction", async () => {
        // First trigger an error with an unreachable URL
        const urlInput = window.locator('input[type="url"]');
        await urlInput.fill("http://192.0.2.1:1"); // non-routable address

        const extractBtn = window.getByText("Extract", { exact: true });
        await extractBtn.click();

        // Wait for error
        const errorText = window.locator(".text-red-400");
        await expect(errorText).toBeVisible({ timeout: 25000 });

        // Click Try Again
        const tryAgainBtn = window.getByText("Try Again");
        await expect(tryAgainBtn).toBeVisible();

        // Change to a valid URL before retrying
        await urlInput.fill(`http://127.0.0.1:${testServerPort}/colorful`);
        await tryAgainBtn.click();

        // Should show loading state again (re-run extraction)
        await expect(window.getByText("Extracting...")).toBeVisible({
            timeout: 5000,
        });

        // Wait for extraction to complete
        await expect(window.getByText("Extracting...")).toBeHidden({
            timeout: 30000,
        });

        // Should now show palette (successful extraction)
        await expect(window.getByText("PRIMARY")).toBeVisible({
            timeout: 5000,
        });
    });

    test("window cleanup — no lingering hidden BrowserWindows after extraction", async () => {
        const urlInput = window.locator('input[type="url"]');
        await urlInput.fill(`http://127.0.0.1:${testServerPort}/colorful`);

        // Count windows before extraction
        const windowsBefore = await electronApp.windows();
        const countBefore = windowsBefore.length;

        const extractBtn = window.getByText("Extract", { exact: true });
        await extractBtn.click();

        // Wait for extraction to complete
        await expect(
            window.getByText("Scanning page for colors...")
        ).toBeVisible({ timeout: 5000 });
        await expect(
            window.getByText("Scanning page for colors...")
        ).toBeHidden({ timeout: 30000 });

        // Wait a moment for any cleanup to happen
        await window.waitForTimeout(2000);

        // Verify no extra windows are lingering
        const windowsAfter = await electronApp.windows();
        expect(windowsAfter.length).toBeLessThanOrEqual(countBefore);
    });
});
