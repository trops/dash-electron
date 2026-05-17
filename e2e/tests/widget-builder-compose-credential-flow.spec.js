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

test("composer credential-wire passes providerName + dashboardAppId through to the IPC call", async () => {
    await test.step("app reaches steady state", async () => {
        await window.waitForTimeout(2000);
    });

    await test.step("seed an Algolia credential provider via the saveProvider IPC", async () => {
        const result = await window.evaluate(
            async ({ appId, name }) => {
                const providers = window.mainApi && window.mainApi.providers;
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
    });

    await test.step("open the widget builder + switch to Compose", async () => {
        await window.evaluate(() => {
            window.dispatchEvent(new CustomEvent("dash:open-widget-builder"));
        });
        await expect(
            window.locator('[data-testid="widget-builder-modal"]')
        ).toBeAttached({ timeout: 10000 });
        await window.locator('[data-testid="chat-mode-compose"]').click();
        await expect(
            window.locator('[data-testid="composer-pane"]')
        ).toBeVisible({ timeout: 5000 });
    });

    await test.step("compose: add SearchInput, open inspector, wire onChange → algolia.search", async () => {
        // Add SearchInput from the palette.
        await window
            .locator('[data-testid="composer-add-SearchInput"]')
            .click();
        // Click the newly added node to open the inspector.
        await window
            .locator('[data-testid^="composer-node-node-"]')
            .first()
            .click();
        await expect(
            window.locator('[data-testid^="composer-inspector-node-"]')
        ).toBeVisible({ timeout: 3000 });
        // Click "algolia" credential row in the wire picker.
        // The catalog has both a credential algolia AND an mcp
        // algolia entry — same testid collides — pick the first
        // (credential is listed alphabetically before mcp here).
        await window
            .locator('[data-testid="composer-wire-provider-onChange-algolia"]')
            .first()
            .click();
        // Pick the search method.
        await window
            .locator('[data-testid="composer-wire-method-onChange-search"]')
            .click();
        // For the `query` arg, bind to eventArg.
        await window
            .locator(
                '[data-testid="composer-arg-kind-eventArg-onChange-query"]'
            )
            .click();
        // For `indexName`, type a literal value.
        const indexInput = window.locator(
            '[data-testid="composer-arg-literal-input-onChange-indexName"]'
        );
        await indexInput.fill("test_index");
        // Close the inspector so the picker selection isn't blocking
        // subsequent steps.
        await window
            .locator('[data-testid="composer-inspector-close"]')
            .click();
    });

    await test.step("pick the seeded provider in the preview's test-inputs picker (if it appears)", async () => {
        // The PreviewProviderPicker only renders when the .dash.js
        // config declares providers. Our enriched config emits one
        // for algolia, so the picker should appear. Wait briefly +
        // pick the seeded provider.
        const picker = window
            .locator("select")
            .filter({ hasText: SEED_PROVIDER_NAME });
        await picker
            .first()
            .selectOption(SEED_PROVIDER_NAME, { timeout: 5000 })
            .catch(() => {});
    });

    await test.step("install algolia.search spy inside the preview iframe + type into SearchInput", async () => {
        // Find the preview iframe (rendered by PreviewIframe).
        const frame = window.frameLocator("iframe");
        // Wait for the widget shell to mount.
        await frame
            .locator("body")
            .waitFor({ state: "attached", timeout: 5000 });
        // Install the spy in the iframe's window context.
        // We stash captured calls on window.__algoliaCalls.
        const frameElement = await window.locator("iframe").first();
        const handle = await frameElement.elementHandle();
        const contentFrame = await handle.contentFrame();
        await contentFrame.evaluate(() => {
            window.__algoliaCalls = [];
            if (!window.mainApi) window.mainApi = {};
            if (!window.mainApi.algolia) window.mainApi.algolia = {};
            window.mainApi.algolia.search = async (args) => {
                window.__algoliaCalls.push(args);
                return { hits: [], nbHits: 0 };
            };
        });
        // Give compile + bundle eval time before searching for inputs.
        await contentFrame.waitForTimeout(2500);

        // Capture iframe console for diagnosis. The composer's
        // emitted code includes a console.log of the pc triplet
        // before each IPC call — if that fires the wire's hot,
        // if it doesn't pc resolution is the issue.
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
        await contentFrame.waitForTimeout(1000);

        // Read back what the spy captured.
        const calls = await contentFrame.evaluate(() => window.__algoliaCalls);
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
        // The whole point of this test: providerName, dashboardAppId,
        // providerHash must all be set, and query must equal what the
        // user typed.
        expect(first).toMatchObject({
            providerName: SEED_PROVIDER_NAME,
            query: "phones",
            indexName: "test_index",
        });
        expect(typeof first.providerHash).toBe("string");
        expect(first.providerHash.length).toBeGreaterThan(0);
        expect(first.dashboardAppId).toBe(SEED_APP_ID);
    });
});
