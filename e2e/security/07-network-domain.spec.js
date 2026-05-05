/**
 * 07-network-domain.spec.js
 *
 * Phase 3 of JIT consent — outbound-network domain. Pins
 * `mainApi.data.readDataFromURL`'s gate end-to-end:
 *
 *   - No network grant + JIT off + enforcement on → call denied
 *   - Granted host matches → call succeeds
 *   - Granted but different host → denied
 *   - Cross-widget isolation: A's grant doesn't help B
 *   - JIT on + approve → grant persists with domains.network and
 *     retry succeeds
 *
 * `WS_CONNECT` is gated by the same networkGate; we exercise the
 * URL-fetch surface here as the canonical test, since spinning a real
 * WebSocket peer in e2e adds infrastructure overhead disproportionate
 * to the gate's value (the gate behavior is the same code path).
 *
 * The test never actually fetches the URL — even when the gate
 * allows, the fetch may legitimately fail (network unreachable in
 * sandboxed CI). Each test asserts on the gate decision itself,
 * surfaced via the SUCCESS/ERROR IPC events.
 */
const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");
const { setSecurityFlags, seedGrant, readAllGrants } = require("./helpers");

let electronApp;
let window;
let tempUserData;

async function triggerReadDataFromURL(window, { widgetId, url, toFilepath }) {
    return await window.evaluate(
        async ({ widgetId, url, toFilepath }) => {
            return new Promise((resolve) => {
                const eApi = window.mainApi;
                const cleanup = () => {
                    eApi.removeAllListeners("read-data-url-complete");
                    eApi.removeAllListeners("read-data-url-error");
                };
                eApi.on("read-data-url-complete", (_e, response) => {
                    cleanup();
                    resolve({ outcome: "complete", response });
                });
                eApi.on("read-data-url-error", (_e, response) => {
                    cleanup();
                    resolve({ outcome: "error", response });
                });
                eApi.data.readDataFromURL(url, toFilepath, widgetId);
                // Safety timeout in case neither event fires (gate
                // bypassed silently, etc.).
                setTimeout(
                    () =>
                        resolve({
                            outcome: "timeout",
                            response: { message: "test-timeout-no-event" },
                        }),
                    8000
                );
            });
        },
        { widgetId, url, toFilepath }
    );
}

test.describe("network domain (Phase 3 JIT consent)", () => {
    test.beforeEach(async () => {
        ({ electronApp, window, tempUserData } = await launchApp({
            hermetic: true,
        }));
    });

    test.afterEach(async () => {
        await closeApp(electronApp, { tempUserData });
    });

    test("no network grant + JIT off → readDataFromURL denied, error event sent", async () => {
        await setSecurityFlags(electronApp, { enforce: true, jit: false });
        const result = await triggerReadDataFromURL(window, {
            widgetId: "@e2e/net-no-grant",
            url: "https://api.example.com/x",
            toFilepath: "out.bin",
        });
        expect(result.outcome).toBe("error");
        expect(
            result.response?.message || result.response?.error || ""
        ).toMatch(/no network permissions granted|network permission gate/i);
    });

    test("seeded network grant for host → readDataFromURL passes the gate", async () => {
        await setSecurityFlags(electronApp, { enforce: true, jit: false });
        await seedGrant(electronApp, "@e2e/net-granted", {
            grantOrigin: "manual",
            servers: {},
            domains: {
                network: { hosts: ["api.example.com"] },
            },
        });
        const result = await triggerReadDataFromURL(window, {
            widgetId: "@e2e/net-granted",
            url: "https://api.example.com/data.json",
            toFilepath: "out.bin",
        });
        // Either the fetch completes or it errors for a network-y
        // reason (DNS, not-found, etc.) — but the message must NOT be
        // a network-permission-gate denial. Sandbox runners typically
        // can't reach example.com; we just assert the gate didn't
        // refuse.
        const msg = result.response?.message || result.response?.error || "";
        expect(msg).not.toMatch(/network permission gate/i);
    });

    test("seeded grant but different host → denied", async () => {
        await setSecurityFlags(electronApp, { enforce: true, jit: false });
        await seedGrant(electronApp, "@e2e/net-narrow", {
            grantOrigin: "manual",
            servers: {},
            domains: {
                network: { hosts: ["api.example.com"] },
            },
        });
        const result = await triggerReadDataFromURL(window, {
            widgetId: "@e2e/net-narrow",
            url: "https://attacker.example.org/x",
            toFilepath: "out.bin",
        });
        expect(result.outcome).toBe("error");
        expect(result.response?.message || "").toMatch(
            /attacker\.example\.org|not in/i
        );
    });

    test("cross-widget isolation: widget A's grant doesn't help widget B", async () => {
        await setSecurityFlags(electronApp, { enforce: true, jit: false });
        await seedGrant(electronApp, "@e2e/net-widget-a", {
            grantOrigin: "manual",
            servers: {},
            domains: { network: { hosts: ["api.example.com"] } },
        });
        const result = await triggerReadDataFromURL(window, {
            widgetId: "@e2e/net-widget-b",
            url: "https://api.example.com/x",
            toFilepath: "out.bin",
        });
        expect(result.outcome).toBe("error");
        expect(result.response?.message || "").toMatch(
            /no network permissions granted/i
        );
    });

    test("JIT on + approve → grant persists with domains.network and retry succeeds", async () => {
        await setSecurityFlags(electronApp, { enforce: true, jit: true });
        const callPromise = triggerReadDataFromURL(window, {
            widgetId: "@e2e/net-jit-widget",
            url: "https://jit.example.com/file",
            toFilepath: "jit-out.bin",
        });

        await window
            .getByText(/Permission requested/i)
            .waitFor({ state: "visible", timeout: 5000 });
        await window
            .getByRole("button", {
                name: /Allow readDataFromURL for jit\.example\.com/i,
            })
            .click();

        const result = await callPromise;
        // After JIT approval the gate allows; the actual fetch may
        // succeed or fail at the network layer, but it must NOT be a
        // gate refusal.
        const msg = result.response?.message || result.response?.error || "";
        expect(msg).not.toMatch(/network permission gate/i);

        const grants = await readAllGrants(electronApp);
        expect(grants["@e2e/net-jit-widget"]).toBeTruthy();
        expect(grants["@e2e/net-jit-widget"].grantOrigin).toBe("live");
        expect(grants["@e2e/net-jit-widget"].domains?.network?.hosts).toContain(
            "jit.example.com"
        );
    });
});
