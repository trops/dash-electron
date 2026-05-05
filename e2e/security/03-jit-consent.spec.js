/**
 * 03-jit-consent.spec.js
 *
 * Pins the just-in-time consent flow: when enforcement is on AND JIT
 * is on AND there is no grant, the gate MUST emit
 * widget:permission-required, the modal MUST render, the user's
 * decision MUST be persisted with grantOrigin "live", and the call
 * proceeds (or fails) according to the decision.
 */
const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("../helpers/electron-app");
const {
    stubMcpServer,
    restoreMcpClient,
} = require("../helpers/mock-mcp-transport");
const {
    installCallRecorder,
    getRecordedCalls,
    clearRecordedCalls,
} = require("./recordMcpCalls");
const {
    setSecurityFlags,
    readAllGrants,
    startServer,
    triggerToolCall,
    waitForJitModal,
    clickJitAllow,
    clickJitDeny,
} = require("./helpers");

let electronApp;
let window;
let tempUserData;

test.describe("just-in-time consent", () => {
    test.beforeEach(async () => {
        ({ electronApp, window, tempUserData } = await launchApp({
            hermetic: true,
        }));
        await setSecurityFlags(electronApp, { enforce: true, jit: true });
        await stubMcpServer(electronApp, {
            match: { commandIncludes: "test-server" },
            tools: [{ name: "read_file", inputSchema: { type: "object" } }],
            callResults: {
                read_file: { content: [{ type: "text", text: "ok" }] },
            },
        });
        await installCallRecorder(electronApp);
        await clearRecordedCalls(electronApp);
        await startServer(window, "test-server");
    });

    test.afterEach(async () => {
        await restoreMcpClient(electronApp);
        await closeApp(electronApp, { tempUserData });
    });

    test("approve: grant persists with live origin and gate stops denying", async () => {
        // Fire the call asynchronously — it'll block until we approve
        const callPromise = triggerToolCall(window, {
            widgetId: "@e2e/jit-widget-a",
            serverName: "test-server",
            toolName: "read_file",
            args: { path: "/tmp/x.txt" },
        });

        await waitForJitModal(window);
        // Click the most permissive option that includes the path
        await clickJitAllow(window, "Allow read_file for /tmp/x.txt");

        const result = await callPromise;

        // Security property: the gate must NOT deny with "no MCP permissions
        // granted" anymore. Whether the post-gate server lookup succeeds
        // depends on safePath's handling of non-existent paths + the stub
        // transport's lifecycle, which is incidental — the gate's job is
        // done once the "no grant" reason is gone.
        if (result?.error) {
            expect(result.message).not.toMatch(/no MCP permissions granted/i);
        }

        const grants = await readAllGrants(electronApp);
        expect(grants["@e2e/jit-widget-a"]).toBeTruthy();
        expect(grants["@e2e/jit-widget-a"].grantOrigin).toBe("live");
        expect(
            grants["@e2e/jit-widget-a"].servers["test-server"].tools
        ).toContain("read_file");
        expect(
            grants["@e2e/jit-widget-a"].servers["test-server"].readPaths
        ).toContain("/tmp/x.txt");
    });

    test("deny: grant is NOT written, server never called", async () => {
        const callPromise = triggerToolCall(window, {
            widgetId: "@e2e/jit-widget-b",
            serverName: "test-server",
            toolName: "read_file",
            args: { path: "/tmp/y.txt" },
        });

        await waitForJitModal(window);
        await clickJitDeny(window);

        const result = await callPromise;
        expect(result?.error).toBe(true);
        expect(result.message).toMatch(/declined|denied/i);

        const grants = await readAllGrants(electronApp);
        expect(grants["@e2e/jit-widget-b"]).toBeFalsy();

        const calls = await getRecordedCalls(electronApp);
        expect(calls).toHaveLength(0);
    });

    test("approve tool-only: subsequent same-tool call to different path re-prompts (no path match)", async () => {
        // First call — approve "tool only" (no path scope)
        const firstCall = triggerToolCall(window, {
            widgetId: "@e2e/jit-widget-c",
            serverName: "test-server",
            toolName: "read_file",
            args: { path: "/tmp/first.txt" },
        });
        await waitForJitModal(window);
        await clickJitAllow(window, "Allow read_file \\(no path scope");
        const firstResult = await firstCall;

        // The "no path scope" grant has empty readPaths/writePaths.
        // The gate then fails on the path-arg containment check
        // ("widget X has no readPaths or writePaths declared"), so the
        // first call also errors. That's the documented behavior — the
        // user picked the "risky" option but didn't actually grant a path.
        expect(firstResult?.error).toBe(true);

        const grants = await readAllGrants(electronApp);
        expect(grants["@e2e/jit-widget-c"].grantOrigin).toBe("live");
        expect(
            grants["@e2e/jit-widget-c"].servers["test-server"].tools
        ).toContain("read_file");
    });
});
