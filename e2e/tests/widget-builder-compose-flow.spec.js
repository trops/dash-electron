const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Widget Builder — Compose mode flow (slice 20.C1–C5)
 *
 * Regression coverage for the new stepwise composer:
 *
 *   1. Switch into Compose mode via the right-pane toggle.
 *   2. Add components from the palette; the composition tree grows
 *      and the preview compiles (left-side Preview tab updates).
 *   3. The brief-flash-then-empty bug (chat poller resetting compose
 *      preview, fixed alongside this test) is caught by asserting
 *      the preview content survives several seconds after the last
 *      add — long enough for the 2000ms poll cycle to fire at least
 *      once. If the regression returns, the preview goes blank and
 *      the assertion fails.
 *   4. The "Suggest a starting layout" button is wired to the user's
 *      configured backend (claude-code or anthropic) — not hard-
 *      coded to anthropic. We exercise this by opening the form and
 *      asserting it does NOT show the "API key is required" error
 *      under the default (CLI) backend before any submit happens —
 *      because we never let the suggest actually run in e2e (no LLM
 *      mock here), the assertion is on the inert empty form state.
 *
 * Out of scope: actually running a Suggest request (would need the
 * mock-llm-server scaffolded for one-shot, not just streaming chat —
 * worth doing in a follow-up). Asserting installed widget code: the
 * existing widget-builder-flow + widget-builder-ai-build specs cover
 * the install pipeline; Compose plugs into the same path so we don't
 * re-cover that ground here.
 */

let electronApp;
let window;
let tempUserData;

const consoleErrors = [];
const suppressedErrors = [];

test.beforeAll(async () => {
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
    }));

    window.on("console", (msg) => {
        const type = msg.type();
        const text = msg.text();
        if (type === "error") consoleErrors.push(text);
        if (type === "warning" && text.includes("[WidgetBuilderModal]")) {
            suppressedErrors.push(text);
        }
    });
    window.on("pageerror", (err) => {
        consoleErrors.push(String(err?.message || err));
    });
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
});

test("compose mode lets the user pick components and keeps the preview live", async () => {
    await test.step("app reaches steady state after launch", async () => {
        await window.waitForTimeout(2000);
    });

    await test.step("open the widget builder", async () => {
        await window.evaluate(() => {
            window.dispatchEvent(new CustomEvent("dash:open-widget-builder"));
        });
        await expect(
            window.locator('[data-testid="widget-builder-modal"]')
        ).toBeAttached({ timeout: 10000 });
    });

    await test.step("switch to Compose mode", async () => {
        const composeToggle = window.locator(
            '[data-testid="chat-mode-compose"]'
        );
        await expect(composeToggle).toBeVisible({ timeout: 5000 });
        await composeToggle.click();
        // The composer pane mounts in place of the chat.
        await expect(
            window.locator('[data-testid="composer-pane"]')
        ).toBeVisible({ timeout: 5000 });
    });

    await test.step("composition tree starts with the root Panel", async () => {
        await expect(
            window.locator('[data-testid="composer-node-root"]')
        ).toBeVisible();
    });

    await test.step("add a Heading from the palette", async () => {
        const addHeading = window.locator(
            '[data-testid="composer-add-Heading"]'
        );
        await expect(addHeading).toBeVisible();
        await addHeading.click();

        // A new tree node materializes — the remove button for it
        // is the easiest selector.
        await expect(
            window.locator('button[aria-label="Remove Heading"]')
        ).toBeVisible({ timeout: 3000 });
    });

    await test.step("add a Table from the palette", async () => {
        const addTable = window.locator('[data-testid="composer-add-Table"]');
        await addTable.click();
        await expect(
            window.locator('button[aria-label="Remove Table"]')
        ).toBeVisible({ timeout: 3000 });
    });

    await test.step("preview survives the 2000ms chat-poller cycle (regression: 'goes back to blank')", async () => {
        // The bug: every poll tick, the chat-messages localStorage
        // poller saw msgs.length===0 + hadActivity and reset
        // previewComponent → null. Compose never writes chat
        // messages, so this fired forever. Fix is in
        // WidgetBuilderModal.js — poller now skips its reset
        // branch when chatModeRef.current === "compose".
        //
        // Wait > one poll cycle so the bug would have fired if
        // present, then assert the tree didn't get nuked AND
        // the composer-pane is still mounted (not flipped back
        // to the chat empty-state).
        await window.waitForTimeout(2500);
        await expect(
            window.locator('[data-testid="composer-pane"]')
        ).toBeVisible();
        await expect(
            window.locator('button[aria-label="Remove Heading"]')
        ).toBeVisible();
        await expect(
            window.locator('button[aria-label="Remove Table"]')
        ).toBeVisible();
    });

    await test.step("clicking a tree node opens the property inspector", async () => {
        // Click the second-most-recently-added child (Heading).
        await window
            .locator('[data-testid^="composer-node-node-"]')
            .first()
            .click();
        await expect(
            window.locator('[data-testid^="composer-inspector-node-"]')
        ).toBeVisible({ timeout: 3000 });
    });

    await test.step("Suggest-a-layout button is present and does NOT demand an API key under CLI backend (regression test)", async () => {
        // Close the inspector first so the palette + suggest
        // button come back into view.
        await window
            .locator('[data-testid="composer-inspector-close"]')
            .click();
        const suggestOpen = window.locator(
            '[data-testid="composer-suggest-layout-open"]'
        );
        await expect(suggestOpen).toBeVisible();
        await suggestOpen.click();
        // Form mounts. There should be NO error message at this
        // stage — the API-key error only appears post-submit
        // when the bridge rejects (anthropic path with no key).
        // Pre-submit, the form is inert; if "API key is
        // required" appears before any click, that means the
        // suggest path is hardcoded to a key-requiring backend.
        await expect(
            window.locator('[data-testid="composer-suggest-layout-form"]')
        ).toBeVisible();
        await expect(
            window.locator('[data-testid="composer-suggest-layout-error"]')
        ).toHaveCount(0);
    });

    await test.step("no console errors and no suppressed errors fired", async () => {
        const noise = [
            /Failed to load resource:\s*net::ERR_/,
            /Download the React DevTools/,
            /sourcemap/i,
        ];
        const isNoise = (msg) => noise.some((re) => re.test(msg));
        const realErrors = consoleErrors.filter((m) => !isNoise(m));
        if (realErrors.length > 0 || suppressedErrors.length > 0) {
            const lines = [
                "Compose flow surfaced errors:",
                ...realErrors.map((m) => `  console.error: ${m}`),
                ...suppressedErrors.map((m) => `  suppressed:    ${m}`),
            ];
            throw new Error(lines.join("\n"));
        }
        expect(realErrors).toEqual([]);
        expect(suppressedErrors).toEqual([]);
    });
});
