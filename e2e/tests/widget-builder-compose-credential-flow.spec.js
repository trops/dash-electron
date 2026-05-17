const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Widget Builder — Compose mode credential-wire flow
 *
 * Reproduces the user-reported bug: SearchInput.onChange wired to
 * algolia.search fires the IPC but the main-process handler returns
 * "Provider not found: <name>" even though the renderer's
 * app.providers map has the entry.
 *
 * Strategy:
 *
 *   1. Boot the app with a fresh hermetic userData dir.
 *   2. Seed an Algolia credential provider via the saveProvider IPC
 *      (which encrypts properly + writes to
 *      userData/Dash/<appId>/providers.json). The renderer's
 *      AppContext then loads it via listProviders on next refresh.
 *   3. Open the widget builder modal and switch to Compose mode.
 *   4. Inject a tree via the composer's React state by simulating
 *      the user clicks (Add SearchInput → click node → wire onChange
 *      to algolia.search via the picker → bind query to eventArg).
 *   5. Pick the seeded Algolia provider in the preview's test-inputs
 *      picker.
 *   6. In the preview iframe, replace window.mainApi.algolia.search
 *      with a spy that records its first arg.
 *   7. Type into the SearchInput in the iframe.
 *   8. Assert: the spy was called with (providerHash, dashboardAppId,
 *      providerName, indexName, query) and providerName matches the
 *      seeded provider's name.
 *
 * If the assertion fails because providerName / dashboardAppId is
 * missing or wrong, we've reproduced the runtime bug at the e2e
 * level. If everything's right, the bug is environmental and we
 * have a regression spec that proves the composer flow works.
 *
 * NOTE: this spec exercises the COMPOSER → PREVIEW → IFRAME → IPC
 * call shape. It does NOT exercise the main-process getProvider
 * file lookup (that's a separate slice of code in dash-core).
 */

let electronApp;
let window;
let tempUserData;

const SEED_PROVIDER_NAME = "Algolia John G Demos";
const SEED_APP_ID = "test-app-1";

test.beforeAll(async () => {
    ({ electronApp, window, tempUserData } = await launchApp({
        hermetic: true,
        env: {
            REACT_APP_APP_ID: SEED_APP_ID,
        },
    }));
});

test.afterAll(async () => {
    await closeApp(electronApp, { tempUserData });
});

// FIXME(e2e): the hermetic seed path doesn't surface the saved
// provider to the renderer's AppContext — `loadProviders` in
// dash-core/Context/App/AppWrapper.js gates on `credentials` being
// set (signed-in app boot), which the hermetic launcher doesn't
// provide. The provider is persisted to disk but never loaded into
// the renderer's appProviders map, so PreviewProviderPicker shows
// "+ Add new Algolia provider" instead of the dropdown and the
// preview wire's pc handle never resolves.
//
// Two paths to fix (follow-up):
//   1. Inject a stub `credentials` value (appId, …) via window.evaluate
//      before the modal opens, then call loadProviders().
//   2. Extend launchApp helpers with a `seedSignedIn` option that
//      writes credentials to disk pre-boot so AppContext loads them
//      naturally on first mount.
//
// The rest of the spec (composer V2 selectors, palette testid forwarding,
// main-process IPC stub, auto-bind args asserting indexName/query) is
// up-to-date and ready to flip back to `test(...)` once seeding works.
test.fixme(
    "composer credential-wire passes providerName + dashboardAppId through to the IPC call",
    async () => {
        await test.step("app reaches steady state", async () => {
            await window.waitForTimeout(2000);
        });

        await test.step("seed an Algolia credential provider via the saveProvider IPC", async () => {
            const result = await window.evaluate(
                async ({ appId, name }) => {
                    const providers =
                        window.mainApi && window.mainApi.providers;
                    if (!providers) {
                        return { ok: false, why: "no providers namespace" };
                    }
                    const fn = providers.save || providers.saveProvider;
                    if (typeof fn !== "function") {
                        return {
                            ok: false,
                            why: "no save fn",
                            providersKeys: Object.keys(providers),
                        };
                    }
                    try {
                        const r = await fn(
                            appId,
                            name,
                            "algolia",
                            {
                                appId: "ALG_TEST_APP_ID",
                                apiKey: "ALG_TEST_API_KEY",
                            },
                            "credential"
                        );
                        return { ok: true, r };
                    } catch (err) {
                        return { ok: false, why: err.message || String(err) };
                    }
                },
                { appId: SEED_APP_ID, name: SEED_PROVIDER_NAME }
            );
            if (!result.ok) {
                throw new Error(
                    `seedProvider failed: ${result.why}${
                        result.keys
                            ? ` (mainApi keys: ${result.keys.join(", ")})`
                            : ""
                    }`
                );
            }
            // Reload the renderer so AppContext re-runs listProviders
            // and picks up the freshly-seeded credential. Without this
            // the renderer's app.providers map stays at its boot-time
            // snapshot (empty for a hermetic run) and the preview's
            // PreviewProviderPicker has nothing to offer.
            await window.reload();
            await window.waitForTimeout(1500);
        });

        await test.step("open the widget builder (Compose is the default tab)", async () => {
            await window.evaluate(() => {
                window.dispatchEvent(
                    new CustomEvent("dash:open-widget-builder")
                );
            });
            await expect(
                window.locator('[data-testid="widget-builder-modal"]')
            ).toBeAttached({ timeout: 10000 });
            // V2 composer renders composer-pane-v2 (the V1 composer-pane
            // testid is gone). Modal defaults to Compose since v0.0.718.
            await expect(
                window.locator('[data-testid="composer-pane-v2"]')
            ).toBeVisible({ timeout: 5000 });
        });

        await test.step("QuickStartPane: skip the intent wizard via 'Start blank'", async () => {
            // V2 opens with the intent picker. We don't need a sample
            // layout — the SearchInput we're about to drop is the only
            // thing we test. Clicking "Start blank" opens the palette
            // on the seed cell.
            await window
                .locator('[data-testid="composer-quick-start-scratch"]')
                .click();
            // PaletteView appears full-pane; pick SearchInput.
            await window
                .locator('[data-testid="composer-palette-pick-SearchInput"]')
                .click();
        });

        await test.step("compose: select the SearchInput cell + wire onChange → algolia.search", async () => {
            // Selecting the just-filled cell opens the inspector
            // automatically (setCellComponent calls setSelectedCellId).
            // The inspector container is composer-inspector-<cellId>.
            await expect(
                window.locator('[data-testid="composer-inspector-cell-1"]')
            ).toBeVisible({ timeout: 3000 });
            // SearchInput.onChange is auto-state (collapsed by default).
            // Expand it so the wire picker is visible, then pick algolia.
            await window
                .locator('[data-testid="composer-prop-toggle-onChange"]')
                .click();
            await window
                .locator(
                    '[data-testid="composer-wire-provider-onChange-algolia"]'
                )
                .first()
                .click();
            // Pick the search method.
            await window
                .locator('[data-testid="composer-wire-method-onChange-search"]')
                .click();
            // applyCallbackArgDefaults now pre-binds `query` to eventArg
            // and `indexName` to userConfig.indexName, so nothing else
            // to click. Override indexName to a literal "test_index" so
            // we have a stable assertion value (no need to set userConfig
            // in the test-inputs form below).
            await window
                .locator(
                    '[data-testid="composer-arg-kind-literal-onChange-indexName"]'
                )
                .click();
            const indexInput = window.locator(
                '[data-testid="composer-arg-literal-input-onChange-indexName"]'
            );
            await indexInput.fill("test_index");
            // Close the inspector so the picker selection isn't blocking
            // subsequent steps.
            await window
                .locator('[data-testid="composer-inspector-done"]')
                .click();
        });

        await test.step("pick the seeded provider in the preview's provider picker", async () => {
            // The PreviewProviderPicker is gated on the .dash.js config
            // declaring a provider. The enriched config we emit
            // includes one for algolia, so the picker MUST appear. If
            // it doesn't, the wire's pc handle won't resolve and the
            // IPC will never fire (silent guard in the emitted code).
            const select = window.locator(
                '[data-testid="preview-provider-select-algolia"]'
            );
            await expect(select).toBeVisible({ timeout: 5000 });
            await select.selectOption(SEED_PROVIDER_NAME);
        });

        await test.step("install algolia.search spy at MAIN PROCESS + type into SearchInput", async () => {
            // Stubbing window.mainApi.algolia.search inside the iframe
            // doesn't work — contextBridge freezes the exposed surface,
            // so reassigning a property silently no-ops. We override
            // the underlying IPC handler in the main process instead.
            // Calls captured into globalThis.__algoliaSearchCalls;
            // readback via a second electronApp.evaluate.
            await electronApp.evaluate(async ({ ipcMain }) => {
                globalThis.__algoliaSearchCalls = [];
                // ipcMain.removeHandler is a no-op if no handler is
                // registered for the channel (returns false). Wrap in a
                // try anyway — older Electron versions throw.
                try {
                    ipcMain.removeHandler("algolia-search");
                } catch (_) {
                    /* ignore */
                }
                ipcMain.handle("algolia-search", async (_e, args) => {
                    globalThis.__algoliaSearchCalls.push(args);
                    return { hits: [], nbHits: 0 };
                });
            });

            // Find the preview iframe (rendered by PreviewIframe).
            const frame = window.frameLocator("iframe");
            await frame
                .locator("body")
                .waitFor({ state: "attached", timeout: 5000 });
            const frameElement = await window.locator("iframe").first();
            const handle = await frameElement.elementHandle();
            const contentFrame = await handle.contentFrame();
            // Give compile + bundle eval time before searching for inputs.
            await contentFrame.waitForTimeout(2500);

            // Capture iframe console for diagnosis. The emitter logs a
            // "[composer] algolia.search call" before each IPC fire —
            // surfacing those tells us whether the wire's even hot.
            const consoleLogs = [];
            contentFrame.page().on("console", (msg) => {
                consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
            });

            const inputs = await contentFrame.$$("input");
            if (inputs.length === 0) {
                const bodyHtml = await contentFrame.evaluate(() =>
                    document.body.innerHTML.slice(0, 2000)
                );
                throw new Error(
                    `no inputs found in preview iframe. body HTML:\n${bodyHtml}`
                );
            }
            await inputs[0].fill("phones");
            await contentFrame.waitForTimeout(1500);

            // Read back what the main-process spy captured.
            const calls = await electronApp.evaluate(
                () => globalThis.__algoliaSearchCalls || []
            );
            if (!calls || calls.length === 0) {
                const bodyHtml = await contentFrame.evaluate(() =>
                    document.body.innerHTML.slice(0, 1000)
                );
                throw new Error(
                    "expected at least one algolia.search call after typing — none captured\n" +
                        `body: ${bodyHtml}\n` +
                        `iframe logs:\n${consoleLogs.join("\n").slice(0, 2000)}`
                );
            }
            const first = calls[0];
            expect(first).toMatchObject({
                providerName: SEED_PROVIDER_NAME,
                query: "phones",
                indexName: "test_index",
            });
            expect(typeof first.providerHash).toBe("string");
            expect(first.providerHash.length).toBeGreaterThan(0);
            expect(first.dashboardAppId).toBe(SEED_APP_ID);
        });
    }
);
