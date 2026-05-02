/**
 * Smoke spec: every E2E helper composes correctly inside a launched
 * Electron process.
 *
 * This is the canonical reference test. New specs that need any of the
 * five mock layers should follow this beforeAll shape:
 *
 *   1. Start mock-registry + mock-llm (HTTP servers).
 *   2. Pre-seed packages in the registry.
 *   3. Configure canned LLM responses.
 *   4. Launch the app with `DASH_REGISTRY_API_URL` + `ANTHROPIC_BASE_URL`
 *      pointing at the mocks.
 *   5. Seed the auth token so registry-gated flows work.
 *   6. Override file dialogs to fixture paths.
 *   7. Stub MCP servers by command-arg signature.
 *
 * Each individual `test()` here verifies one helper is observably
 * working from inside the main process.
 */

const { test, expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const os = require("os");

const { launchApp, closeApp } = require("../helpers/electron-app");
const {
    startMockRegistry,
    stopMockRegistry,
    registerPackage,
    getPublishHistory,
    getDeleteHistory,
} = require("../helpers/mock-registry");
const {
    seedAuthToken,
    clearAuthToken,
} = require("../helpers/auth-token-injector");
const {
    overrideOpenDialog,
    overrideSaveDialog,
    restoreFileDialogs,
} = require("../helpers/file-dialog-override");
const {
    stubMcpServer,
    restoreMcpClient,
} = require("../helpers/mock-mcp-transport");
const {
    startMockLlm,
    stopMockLlm,
    getRequestHistory: getLlmRequestHistory,
} = require("../helpers/mock-llm-server");

let electronApp;
let window;
let registryPort;
let llmPort;

const FIXTURE_OPEN_PATH = path.resolve(
    __dirname,
    "../../test/fixtures/folder-install-test/current-weather"
);
const FIXTURE_SAVE_PATH = path.join(
    os.tmpdir(),
    `dash-e2e-save-${Date.now()}.zip`
);

test.beforeAll(async () => {
    // 1. Start mock servers
    registryPort = await startMockRegistry();
    llmPort = await startMockLlm({
        responses: [
            {
                match: { lastUserContains: "ping" },
                blocks: [{ type: "text", text: "pong from mock-llm" }],
            },
            {
                match: { default: true },
                blocks: [{ type: "text", text: "default mock response" }],
            },
        ],
    });

    // 2. Seed a custom widget package so we can prove it surfaces
    registerPackage({
        type: "widget",
        scope: "trops",
        name: "smoke-test-widget",
        version: "1.0.0",
        zipBuffer: Buffer.from("not-a-real-zip"),
        metadata: {
            displayName: "Smoke Test Widget",
            description: "registered by helpers-integration.spec.js",
            author: "trops",
        },
    });

    // 3. Launch the app pointed at the mocks
    ({ electronApp, window } = await launchApp({
        env: {
            DASH_REGISTRY_API_URL: `http://127.0.0.1:${registryPort}`,
            ANTHROPIC_BASE_URL: `http://127.0.0.1:${llmPort}`,
        },
    }));

    // 4. Pre-seed the auth token (no Cognito flow)
    await seedAuthToken(electronApp);

    // 5. Override file dialogs so any open/save call returns a fixture
    await overrideOpenDialog(electronApp, {
        filePaths: [FIXTURE_OPEN_PATH],
    });
    await overrideSaveDialog(electronApp, {
        filePath: FIXTURE_SAVE_PATH,
    });

    // 6. Stub a fake MCP server keyed by command signature
    await stubMcpServer(electronApp, {
        match: { commandIncludes: "filesystem" },
        tools: [
            {
                name: "read_file",
                description: "Read a file (mocked)",
                inputSchema: { type: "object" },
            },
        ],
        callResults: {
            read_file: {
                content: [{ type: "text", text: "mocked file contents" }],
            },
        },
    });
});

test.afterAll(async () => {
    await restoreFileDialogs(electronApp);
    await restoreMcpClient(electronApp);
    await clearAuthToken(electronApp);
    await closeApp(electronApp);
    await stopMockRegistry();
    await stopMockLlm();
    // Clean up any save fixture that got written
    try {
        if (fs.existsSync(FIXTURE_SAVE_PATH)) {
            fs.unlinkSync(FIXTURE_SAVE_PATH);
        }
    } catch (_) {
        /* ignore */
    }
});

test.describe("E2E helpers — integration smoke", () => {
    test("env vars reach the main process", async () => {
        const env = await electronApp.evaluate(async () => ({
            registry: process.env.DASH_REGISTRY_API_URL || null,
            anthropic: process.env.ANTHROPIC_BASE_URL || null,
        }));
        expect(env.registry).toBe(`http://127.0.0.1:${registryPort}`);
        expect(env.anthropic).toBe(`http://127.0.0.1:${llmPort}`);
    });

    test("auth-token-injector seeded the registry token", async () => {
        const stored = await electronApp.evaluate(async () => {
            const Store = require("electron-store");
            const s = new Store({
                name: "dash-registry-auth",
                encryptionKey: "dash-registry-v1",
            });
            return {
                accessToken: s.get("accessToken") || null,
                userId: s.get("userId") || null,
                tokenType: s.get("tokenType") || null,
            };
        });
        expect(stored.accessToken).toBe("test-e2e-token");
        expect(stored.userId).toBe("test-user");
        expect(stored.tokenType).toBe("bearer");
    });

    test("mock-registry index endpoint reachable from main process", async () => {
        const result = await electronApp.evaluate(async (url) => {
            const res = await fetch(`${url}/api/packages`);
            const json = await res.json();
            return {
                status: res.status,
                count: Array.isArray(json.packages) ? json.packages.length : 0,
                hasSmokeWidget: !!json.packages?.find(
                    (p) => p.name === "smoke-test-widget"
                ),
            };
        }, `http://127.0.0.1:${registryPort}`);
        expect(result.status).toBe(200);
        // 10 stock themes auto-seeded + 1 widget we registered = 11
        expect(result.count).toBeGreaterThanOrEqual(11);
        expect(result.hasSmokeWidget).toBe(true);
    });

    test("mock-registry publish history captures a POST", async () => {
        // Hit /api/publish from inside the main process
        await electronApp.evaluate(async (url) => {
            await fetch(`${url}/api/publish`, {
                method: "POST",
                headers: { "content-type": "multipart/form-data" },
                body: "fake-payload",
            });
        }, `http://127.0.0.1:${registryPort}`);

        const history = getPublishHistory();
        expect(history.length).toBeGreaterThanOrEqual(1);
        expect(history[history.length - 1].bodyBytes).toBeGreaterThan(0);
    });

    test("mock-registry delete history captures a DELETE", async () => {
        const before = getDeleteHistory().length;
        await electronApp.evaluate(async (url) => {
            await fetch(`${url}/api/packages/%40trops/smoke-test-widget`, {
                method: "DELETE",
            });
        }, `http://127.0.0.1:${registryPort}`);

        const history = getDeleteHistory();
        expect(history.length).toBe(before + 1);
        expect(history[history.length - 1].name).toBe("smoke-test-widget");
    });

    test("mock-llm responds with canned SSE for matched prompt", async () => {
        const result = await electronApp.evaluate(async (url) => {
            const res = await fetch(`${url}/v1/messages`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    stream: true,
                    messages: [{ role: "user", content: "ping please" }],
                }),
            });
            const text = await res.text();
            return {
                status: res.status,
                contentType: res.headers.get("content-type"),
                hasMessageStart: text.includes("event: message_start"),
                hasMessageStop: text.includes("event: message_stop"),
                hasPongDelta: text.includes("pong from mock-llm"),
            };
        }, `http://127.0.0.1:${llmPort}`);

        expect(result.status).toBe(200);
        expect(result.contentType).toContain("text/event-stream");
        expect(result.hasMessageStart).toBe(true);
        expect(result.hasMessageStop).toBe(true);
        expect(result.hasPongDelta).toBe(true);

        const history = getLlmRequestHistory();
        expect(history.length).toBeGreaterThanOrEqual(1);
        expect(history[history.length - 1].lastUserText).toContain("ping");
    });

    test("file-dialog-override returns canned open path", async () => {
        const result = await electronApp.evaluate(async (expected) => {
            const { dialog } = require("electron");
            const r = await dialog.showOpenDialog({});
            return {
                canceled: r.canceled,
                filePathsLen: r.filePaths.length,
                first: r.filePaths[0] || null,
                expected,
            };
        }, FIXTURE_OPEN_PATH);
        expect(result.canceled).toBe(false);
        expect(result.filePathsLen).toBe(1);
        expect(result.first).toBe(result.expected);
    });

    test("file-dialog-override returns canned save path", async () => {
        const result = await electronApp.evaluate(async (expected) => {
            const { dialog } = require("electron");
            const r = await dialog.showSaveDialog({});
            return {
                canceled: r.canceled,
                filePath: r.filePath,
                expected,
            };
        }, FIXTURE_SAVE_PATH);
        expect(result.canceled).toBe(false);
        expect(result.filePath).toBe(result.expected);
    });

    test("mock-mcp-transport serves canned tools and call results", async () => {
        // Drive the SDK's Client + StdioClientTransport directly so we
        // don't depend on the controller having been triggered yet.
        const result = await electronApp.evaluate(async () => {
            let sdkClient;
            let sdkStdio;
            try {
                sdkClient = require("@modelcontextprotocol/sdk/client/index.js");
            } catch (_) {
                sdkClient = require("@modelcontextprotocol/sdk/dist/cjs/client/index.js");
            }
            try {
                sdkStdio = require("@modelcontextprotocol/sdk/client/stdio.js");
            } catch (_) {
                sdkStdio = require("@modelcontextprotocol/sdk/dist/cjs/client/stdio.js");
            }
            const { Client } = sdkClient;
            const { StdioClientTransport } = sdkStdio;

            const transport = new StdioClientTransport({
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
            });
            const client = new Client({ name: "dash", version: "1.0.0" });
            await client.connect(transport);
            const tools = await client.listTools();
            const callResult = await client.callTool({
                name: "read_file",
                arguments: { path: "/etc/hosts" },
            });
            await client.close();
            return {
                toolCount: tools.tools.length,
                firstToolName: tools.tools[0]?.name || null,
                callContent: callResult.content?.[0]?.text || null,
            };
        });
        expect(result.toolCount).toBe(1);
        expect(result.firstToolName).toBe("read_file");
        expect(result.callContent).toBe("mocked file contents");
    });
});
