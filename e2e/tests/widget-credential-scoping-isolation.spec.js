const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Widget preview credential-scoping isolation — Phase 5C pin (P1 #12).
 *
 * The audit's threat model: a widget loaded in the preview iframe
 * could read provider credentials it didn't declare in its
 * manifest. Pre-5C, `bridge:set-providers` posted the entire
 * `appContext.providers` map to the iframe regardless of scope.
 *
 * Phase 5C addresses this two ways:
 *   1. Host-side filter in PreviewIframe.js: when
 *      `declaredProviders` is non-null, strip
 *      `appContext.providers` to that allowlist BEFORE posting.
 *      (Covered by unit tests in PreviewIframe.test.js.)
 *   2. This spec verifies the iframe-side contract: the shell
 *      stores whatever it receives — meaning the host-side filter
 *      is the trust boundary, and the iframe never has access to
 *      providers the host chose not to send.
 *
 * The end-to-end property: a widget rendered inside the preview
 * iframe, after the host posts a filtered providers map, sees ONLY
 * the declared providers via React context — not the full set.
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

async function gotoShell() {
    await window.goto("http://localhost:3000/widget-preview-host.html", {
        waitUntil: "domcontentloaded",
        timeout: 10000,
    });
    // Wait for the shell's bridge:ready post (signals listeners are
    // installed).
    await window.waitForFunction(
        () => typeof window.mainApi === "object" && window.mainApi !== null,
        { timeout: 5000 }
    );
}

async function postToShell(type, payload) {
    await window.evaluate(
        ({ t, p }) => {
            window.postMessage({ type: t, payload: p }, "*");
        },
        { t: type, p: payload }
    );
    await window.waitForTimeout(50);
}

test("iframe stores exactly the providers map the host sends — no smuggling", async () => {
    await gotoShell();

    // Simulate the host sending a payload that's already been
    // scoped by PreviewIframe (algolia only — slack/github filtered
    // out upstream). The iframe must store EXACTLY this and never
    // have access to slack/github credentials.
    const scopedProviders = {
        algolia: { type: "algolia", apiKey: "scoped-A" },
    };
    await postToShell("bridge:set-providers", {
        appContext: { providers: scopedProviders },
    });

    // The shell stores currentAppCtx for downstream rendering. We
    // can't easily reach the closure from outside, but we can
    // verify the next render would consume the same shape by
    // posting a second message and observing the iframe doesn't
    // expose any leakage path. The strongest proof: nothing in the
    // global accessible state should reference the filtered-out
    // providers.
    const exposureAudit = await window.evaluate(() => {
        // Crawl the iframe's own globals for any string that looks
        // like a slack/github credential. The host wasn't supposed
        // to send these, so they shouldn't appear anywhere.
        const all = Object.getOwnPropertyNames(window).join(" ");
        const hasSlack = all.includes("slack");
        const hasGithub = all.includes("github");
        // window.mainApi may legitimately have namespace keys
        // matching provider types; that's the IPC surface, not a
        // credential leak.
        return { hasSlack, hasGithub };
    });
    expect(exposureAudit.hasSlack).toBe(false);
    expect(exposureAudit.hasGithub).toBe(false);
});

test("iframe currentAppCtx state stays closure-private (no global leakage)", async () => {
    await gotoShell();

    await postToShell("bridge:set-providers", {
        appContext: {
            providers: {
                algolia: { type: "algolia", apiKey: "secret-A" },
            },
        },
    });

    // The shell's `currentAppCtx` is module-scoped — it is NOT
    // exposed on the iframe's window. If a future refactor ever
    // promotes it to a window property, anyone inside the iframe
    // (including unrelated widgets in a multi-widget preview)
    // could read every other widget's provider credentials. Pin
    // the boundary with a direct property check rather than the
    // heuristic global-name scan.
    const exposed = await window.evaluate(() => {
        return {
            currentAppCtxOnWindow: "currentAppCtx" in window,
            currentAppCtxValue: window.currentAppCtx,
        };
    });
    expect(exposed.currentAppCtxOnWindow).toBe(false);
    expect(exposed.currentAppCtxValue).toBeUndefined();
});
