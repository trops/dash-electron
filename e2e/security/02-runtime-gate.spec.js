/**
 * 02-runtime-gate.spec.js
 *
 * Pins the runtime gate's deny path: when enforcement is on and there
 * is no grant, an MCP tool call MUST be denied AND the fake server
 * MUST never be invoked. With a grant, the call reaches the server.
 *
 * Tests the synchronous gate (JIT off). The JIT escalation path is
 * tested separately in 03-jit-consent.spec.js.
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
    seedGrant,
    startServer,
    triggerToolCall,
} = require("./helpers");

let electronApp;
let window;
let tempUserData;

test.describe("runtime gate (JIT off)", () => {
    test.beforeEach(async () => {
        ({ electronApp, window, tempUserData } = await launchApp({
            hermetic: true,
        }));
        // Enforcement on, JIT off — we want hard denials, not prompts.
        await setSecurityFlags(electronApp, { enforce: true, jit: false });
        await stubMcpServer(electronApp, {
            match: { commandIncludes: "test-server" },
            tools: [
                {
                    name: "read_file",
                    inputSchema: { type: "object" },
                },
            ],
            callResults: {
                read_file: {
                    content: [{ type: "text", text: "stubbed content" }],
                },
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

    test("call without grant is denied, fake server never invoked", async () => {
        const result = await triggerToolCall(window, {
            widgetId: "@e2e/no-grant-widget",
            serverName: "test-server",
            toolName: "read_file",
            args: { path: "/tmp/x" },
        });
        expect(result?.error).toBe(true);
        expect(result.message).toMatch(/no MCP permissions granted/i);

        const calls = await getRecordedCalls(electronApp);
        expect(calls).toHaveLength(0);
    });

    test("call with matching grant reaches the fake server", async () => {
        await seedGrant(electronApp, "@e2e/granted-widget", {
            grantOrigin: "manual",
            servers: {
                "test-server": {
                    tools: ["read_file"],
                    readPaths: ["/tmp"],
                    writePaths: [],
                },
            },
        });
        const result = await triggerToolCall(window, {
            widgetId: "@e2e/granted-widget",
            serverName: "test-server",
            toolName: "read_file",
            args: { path: "/tmp/x" },
        });
        expect(result?.error).toBeFalsy();

        const calls = await getRecordedCalls(electronApp);
        expect(calls).toHaveLength(1);
        expect(calls[0].name).toBe("read_file");
    });

    test("call with grant but tool not in allowlist is denied", async () => {
        await seedGrant(electronApp, "@e2e/limited-widget", {
            grantOrigin: "manual",
            servers: {
                "test-server": {
                    tools: ["read_file"], // does NOT include write_file
                    readPaths: [],
                    writePaths: ["/tmp"],
                },
            },
        });
        const result = await triggerToolCall(window, {
            widgetId: "@e2e/limited-widget",
            serverName: "test-server",
            toolName: "write_file",
            args: { path: "/tmp/y" },
        });
        expect(result?.error).toBe(true);
        expect(result.message).toMatch(/not in the allowlist/i);

        const calls = await getRecordedCalls(electronApp);
        expect(calls).toHaveLength(0);
    });

    test("path traversal attempt is denied even with tool allowed", async () => {
        await seedGrant(electronApp, "@e2e/path-bound-widget", {
            grantOrigin: "manual",
            servers: {
                "test-server": {
                    tools: ["read_file"],
                    readPaths: ["/tmp/safe"],
                    writePaths: [],
                },
            },
        });
        const result = await triggerToolCall(window, {
            widgetId: "@e2e/path-bound-widget",
            serverName: "test-server",
            toolName: "read_file",
            args: { path: "/etc/passwd" },
        });
        expect(result?.error).toBe(true);
        expect(result.message).toMatch(
            /path argument.*rejected|outside allowed/i
        );

        const calls = await getRecordedCalls(electronApp);
        expect(calls).toHaveLength(0);
    });
});
