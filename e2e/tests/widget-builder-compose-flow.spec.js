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

    await test.step("Suggest-a-layout end-to-end with a stubbed LLM bridge", async () => {
        // Close the inspector first so the palette + suggest
        // button come back into view.
        await window
            .locator('[data-testid="composer-inspector-close"]')
            .click();

        // Install the test-only override hook. llmOneShot checks
        // window.__DASH_LLM_ONE_SHOT_OVERRIDE before falling
        // through to the real bridge — this lets us exercise the
        // full SuggestLayoutButton pipeline without depending on
        // the real CLI or a mock-LLM server (contextBridge freezes
        // window.mainApi so direct stubbing isn't possible).
        //
        // The canned response covers:
        //   - a top-level prose preamble (the model often greets
        //     before emitting JSON — extractJsonBlock should peel
        //     past it via the fenced-block fallback walk)
        //   - a fenced ```json block with a valid 2-suggestion
        //     payload that exercises both the sanitizer
        //     (every component name is in the curated schema) and
        //     the rule that the root must be Panel.
        await window.evaluate(() => {
            const cannedResponse =
                "I'll help you build that. Here are some layout ideas:\n\n" +
                "```json\n" +
                JSON.stringify({
                    suggestions: [
                        {
                            label: "Inbox with detail",
                            root: {
                                type: "Panel",
                                children: [
                                    {
                                        type: "Heading",
                                        props: { title: "Inbox" },
                                    },
                                    { type: "Table" },
                                ],
                            },
                        },
                        {
                            label: "Search-and-read",
                            root: {
                                type: "Panel",
                                children: [
                                    { type: "SearchInput" },
                                    { type: "DataList" },
                                ],
                            },
                        },
                    ],
                }) +
                "\n```";
            window.__DASH_LLM_ONE_SHOT_OVERRIDE = async () => cannedResponse;
        });

        // Open the form and submit a description.
        await window
            .locator('[data-testid="composer-suggest-layout-open"]')
            .click();
        await window
            .locator('[data-testid="composer-suggest-layout-input"]')
            .fill("a gmail inbox reader");
        await window
            .locator('[data-testid="composer-suggest-layout-submit"]')
            .click();

        // With the override the call resolves immediately. If
        // extractJsonBlock or the sanitizer change in a breaking
        // way, one of these locators disappears and the test fails.
        await expect(
            window.locator('[data-testid="composer-suggest-layout-results"]')
        ).toBeVisible({ timeout: 5000 });
        await expect(
            window.locator('[data-testid="composer-suggest-layout-pick-0"]')
        ).toBeVisible();
        await expect(
            window.locator('[data-testid="composer-suggest-layout-pick-1"]')
        ).toBeVisible();

        // Pick the first suggestion — the tree should rebuild to
        // include the Inbox heading and a Table.
        await window
            .locator('[data-testid="composer-suggest-layout-pick-0"]')
            .click();

        // Form auto-closes on apply.
        await expect(
            window.locator('[data-testid="composer-suggest-layout-form"]')
        ).toHaveCount(0);
        // Tree contains Heading + Table.
        await expect(
            window.locator('button[aria-label="Remove Heading"]')
        ).toBeVisible({ timeout: 3000 });
        // The existing Table (from the earlier add step) and the new
        // Table from the suggestion both have aria-label "Remove
        // Table" — assert at least one is present rather than count.
        await expect(
            window.locator('button[aria-label="Remove Table"]').first()
        ).toBeVisible();
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
