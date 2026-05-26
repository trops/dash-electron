const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");

/**
 * Widget preview iframe mainApi gate — Phase 5C pin (P1 #13).
 *
 * The iframe runs widget code in a same-origin sandbox and exposes
 * `window.parent.mainApi` directly so widgets can hit IPC. Pre-5C
 * gave any preview-mode widget the full mainApi surface regardless
 * of what the widget declared in its manifest.
 *
 * Phase 5C wraps `window.mainApi` inside the iframe with a Proxy
 * that consults `currentDeclaredProviders` (pushed via
 * `bridge:set-mainapi-scope`). Credentialed namespaces (`algolia`,
 * `mcp`) only pass through when their type is in the allowlist.
 * Other namespaces (notifications, scheduler, …) and the
 * passthrough default (declaredProviders === null) preserve the
 * builder UX.
 *
 * Harness: a same-origin parent page injects an iframe pointing at
 * /widget-preview-host.html. The iframe's own window doesn't have
 * preload-installed mainApi (preload only runs in the top-level
 * renderer), so the shell's `window.mainApi = wrapHostMainApi(...)`
 * assignment succeeds. The wrapped target is the REAL preload
 * mainApi reached via `window.parent.mainApi`.
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

const PREVIEW_FRAME_ID = "phase5c-preview";

async function mountPreviewIframe() {
    // Build a synthetic parent page hosted inside the renderer
    // (same origin as the iframe so window.parent.mainApi is
    // reachable from inside). We can't `goto` a data: URL — that
    // would be cross-origin to localhost:3000. Instead we inject
    // an iframe into the already-loaded app document and address
    // it via frameLocator.
    await window.evaluate(
        ({ id, src }) => {
            // Remove any previous instance from a prior test.
            const prev = document.getElementById(id);
            if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
            // Track bridge:ready from this specific iframe.
            window.__phase5c = { ready: false };
            window.addEventListener("message", (e) => {
                if (e && e.data && e.data.type === "bridge:ready") {
                    window.__phase5c.ready = true;
                }
            });
            const f = document.createElement("iframe");
            f.id = id;
            f.src = src;
            f.style.width = "100px";
            f.style.height = "100px";
            document.body.appendChild(f);
        },
        { id: PREVIEW_FRAME_ID, src: "/widget-preview-host.html" }
    );

    await window.waitForFunction(() => window.__phase5c?.ready === true, {
        timeout: 10000,
    });
}

async function postScopeToIframe(declaredProviders) {
    await window.evaluate(
        ({ id, dp }) => {
            const f = document.getElementById(id);
            f.contentWindow.postMessage(
                {
                    type: "bridge:set-mainapi-scope",
                    payload: { declaredProviders: dp },
                },
                "*"
            );
        },
        { id: PREVIEW_FRAME_ID, dp: declaredProviders }
    );
    // Allow the iframe message loop to deliver before subsequent reads.
    await window.waitForTimeout(100);
}

/**
 * Evaluate code inside the iframe's window context. We grab the
 * iframe element, reach into contentWindow (same origin → allowed),
 * and use a Function-via-Function trick to execute code captured
 * from the test side.
 */
async function evalInIframe(fnBody, arg) {
    return window.evaluate(
        ({ id, body, a }) => {
            const f = document.getElementById(id);
            const cw = f.contentWindow;
            // Evaluate in the iframe's global by attaching a runner
            // and invoking it there. `with` would be cleaner but
            // strict mode forbids it.
            cw.__phase5cRunner = new cw.Function("arg", body);
            return Promise.resolve(cw.__phase5cRunner(a));
        },
        { id: PREVIEW_FRAME_ID, body: fnBody, a: arg }
    );
}

test("mainApi passthrough when declaredProviders is null (builder default)", async () => {
    await mountPreviewIframe();
    await postScopeToIframe(null);

    const shape = await evalInIframe(
        `return {
            mcpIsObject: !!window.mainApi.mcp && typeof window.mainApi.mcp === 'object',
            mcpHasCallTool: !!window.mainApi.mcp && typeof window.mainApi.mcp.callTool === 'function',
        };`
    );
    expect(shape.mcpIsObject).toBe(true);
    expect(shape.mcpHasCallTool).toBe(true);
});

test("undeclared credentialed namespace throws structured 'preview-gate' error", async () => {
    await mountPreviewIframe();
    await postScopeToIframe(["algolia"]); // mcp is NOT declared

    const result = await evalInIframe(
        `try {
            window.mainApi.mcp.callTool('filesystem', 'read_file', { path: '/tmp/x' });
            return { threw: false };
        } catch (err) {
            return { threw: true, message: err && err.message ? err.message : String(err) };
        }`
    );
    expect(result.threw).toBe(true);
    expect(result.message).toMatch(/preview-gate/);
    expect(result.message).toMatch(/mcp/);
    expect(result.message).toMatch(/not declared/);
});

test("declared credentialed namespace passes the proxy gate", async () => {
    await mountPreviewIframe();
    await postScopeToIframe(["algolia"]);

    const shape = await evalInIframe(
        `var algolia = window.mainApi && window.mainApi.algolia;
        return {
            isObject: !!algolia && typeof algolia === 'object',
            hasListIndices: !!algolia && typeof algolia.listIndices === 'function',
        };`
    );
    expect(shape.isObject).toBe(true);
    expect(shape.hasListIndices).toBe(true);
});

test("non-credentialed namespaces pass regardless of declared list", async () => {
    await mountPreviewIframe();
    await postScopeToIframe(["algolia"]);

    const shape = await evalInIframe(
        `return {
            notificationsExists: !!window.mainApi.notifications && typeof window.mainApi.notifications === 'object',
            schedulerExists: !!window.mainApi.scheduler && typeof window.mainApi.scheduler === 'object',
        };`
    );
    expect(shape.notificationsExists).toBe(true);
    expect(shape.schedulerExists).toBe(true);
});

test("scope change at runtime takes effect on next access", async () => {
    await mountPreviewIframe();
    await postScopeToIframe(null);

    const before = await evalInIframe(
        `return typeof window.mainApi.mcp.callTool === 'function';`
    );
    expect(before).toBe(true);

    await postScopeToIframe(["algolia"]);

    const after = await evalInIframe(
        `try {
            window.mainApi.mcp.callTool('x', 'y', {});
            return { threw: false };
        } catch (err) {
            return { threw: true, message: err && err.message ? err.message : String(err) };
        }`
    );
    expect(after.threw).toBe(true);
    expect(after.message).toMatch(/preview-gate/);
});
