/**
 * Mock MCP transport for E2E tests.
 *
 * The dash app spawns one local child process per MCP server (filesystem,
 * github, gmail, gcal, gdrive, slack, gong, notion, algolia, …) via
 * `@modelcontextprotocol/sdk`'s `StdioClientTransport`. That blocks tests:
 * we don't want network or auth in CI, and we don't want to maintain
 * working credentials for a dozen third-party services.
 *
 * This helper overrides the `Client` and `StdioClientTransport`
 * prototypes inside the main process so that:
 *
 *   - `client.connect()` becomes a no-op (no subprocess spawn).
 *   - `client.listTools()` returns canned tools per server name.
 *   - `client.callTool()` returns canned results per (server, tool).
 *   - `client.listResources()` returns an empty list (or canned).
 *   - `client.close()` is a no-op.
 *
 * The stub is keyed by the *next* server name passed to the constructor —
 * which the SDK's Client takes as `{ name, version }` — but mcpController
 * sets that to "dash" for every server, so we instead key by the
 * StdioClientTransport's `command + args` signature: a server's identity
 * is "what it would have spawned." Tests configure servers by friendly
 * name → command-args matcher.
 *
 * Usage:
 *
 *   await stubMcpServer(electronApp, {
 *     match: { commandIncludes: "filesystem" },
 *     tools: [{ name: "read_file", description: "..." }],
 *     callResults: { read_file: { content: [{ type: "text", text: "ok" }] } },
 *   });
 *
 *   // ...exercise the app...
 *
 *   await restoreMcpClient(electronApp);
 */

/**
 * Install (or extend) the MCP stub. Each call appends a new matcher to
 * an in-process registry. Safe to call multiple times — the patch only
 * lands once.
 *
 * @param {import('@playwright/test').ElectronApplication} electronApp
 * @param {Object} stub
 * @param {Object} [stub.match]
 * @param {string} [stub.match.commandIncludes]
 *   Match if `transport.command + transport.args.join(" ")` contains this.
 * @param {string} [stub.match.serverName]
 *   Match if Client was constructed with `{ name }` equal to this. Most
 *   callers won't use this since dash-core hardcodes name="dash".
 * @param {Array<Object>} [stub.tools=[]]
 * @param {Object<string, any>} [stub.callResults={}]
 * @param {Array<Object>} [stub.resources=[]]
 */
async function stubMcpServer(electronApp, stub) {
    await electronApp.evaluate(async (stubArg) => {
        const installPatch = () => {
            // Resolve the SDK modules. They may not be loaded yet — try,
            // and if not, install a require cache hook to patch on first
            // require.
            let sdkClient;
            let sdkStdio;
            try {
                sdkClient = require("@modelcontextprotocol/sdk/client/index.js");
            } catch (_) {
                /* module path varies across SDK versions; try fallback */
                try {
                    sdkClient = require("@modelcontextprotocol/sdk/dist/cjs/client/index.js");
                } catch (_e2) {
                    /* leave undefined */
                }
            }
            try {
                sdkStdio = require("@modelcontextprotocol/sdk/client/stdio.js");
            } catch (_) {
                try {
                    sdkStdio = require("@modelcontextprotocol/sdk/dist/cjs/client/stdio.js");
                } catch (_e2) {
                    /* leave undefined */
                }
            }

            if (!sdkClient || !sdkClient.Client) return false;

            const Client = sdkClient.Client;
            const Stdio = sdkStdio && sdkStdio.StdioClientTransport;

            global.__dashE2EMcpStubs = global.__dashE2EMcpStubs || [];

            if (!global.__dashE2EMcpPatched) {
                global.__dashE2EMcpOriginalClient = {
                    connect: Client.prototype.connect,
                    listTools: Client.prototype.listTools,
                    callTool: Client.prototype.callTool,
                    listResources: Client.prototype.listResources,
                    close: Client.prototype.close,
                };

                const matchTransport = (transport) => {
                    if (!transport) return null;
                    const sig = `${
                        transport._command || transport.command || ""
                    } ${
                        Array.isArray(transport._args || transport.args)
                            ? (transport._args || transport.args).join(" ")
                            : ""
                    }`;
                    for (const entry of global.__dashE2EMcpStubs) {
                        if (
                            entry.match &&
                            entry.match.commandIncludes &&
                            sig.includes(entry.match.commandIncludes)
                        ) {
                            return entry;
                        }
                    }
                    return null;
                };

                Client.prototype.connect = async function (transport) {
                    this.__e2eStub = matchTransport(transport) || {
                        tools: [],
                        callResults: {},
                        resources: [],
                    };
                };
                Client.prototype.listTools = async function () {
                    return { tools: (this.__e2eStub || {}).tools || [] };
                };
                Client.prototype.callTool = async function (args) {
                    const name = (args && args.name) || "";
                    const map = (this.__e2eStub || {}).callResults || {};
                    return (
                        map[name] || {
                            content: [
                                {
                                    type: "text",
                                    text: `[mock-mcp] no canned result for ${name}`,
                                },
                            ],
                        }
                    );
                };
                Client.prototype.listResources = async function () {
                    return {
                        resources: (this.__e2eStub || {}).resources || [],
                    };
                };
                Client.prototype.close = async function () {
                    /* no-op */
                };

                if (Stdio && Stdio.prototype) {
                    global.__dashE2EMcpOriginalStdio = {
                        start: Stdio.prototype.start,
                        close: Stdio.prototype.close,
                    };
                    Stdio.prototype.start = async function () {
                        /* no-op: do not spawn */
                    };
                    Stdio.prototype.close = async function () {
                        /* no-op */
                    };
                }

                global.__dashE2EMcpPatched = true;
            }

            global.__dashE2EMcpStubs.push(stubArg);
            return true;
        };

        if (!installPatch()) {
            // SDK not yet loaded. Install a one-shot require hook so we
            // patch as soon as it is.
            global.__dashE2EMcpStubsPending =
                global.__dashE2EMcpStubsPending || [];
            global.__dashE2EMcpStubsPending.push(stubArg);
            if (!global.__dashE2EMcpRequireHook) {
                const Module = require("module");
                const orig = Module.prototype.require;
                Module.prototype.require = function patched(id) {
                    const result = orig.apply(this, arguments);
                    if (
                        typeof id === "string" &&
                        id.includes("@modelcontextprotocol/sdk")
                    ) {
                        // Re-attempt patch installation; flush any
                        // pending stubs.
                        const pending = global.__dashE2EMcpStubsPending || [];
                        global.__dashE2EMcpStubsPending = [];
                        for (const p of pending) {
                            global.__dashE2EMcpStubs =
                                global.__dashE2EMcpStubs || [];
                            global.__dashE2EMcpStubs.push(p);
                        }
                        installPatch();
                    }
                    return result;
                };
                global.__dashE2EMcpRequireHook = true;
            }
        }
    }, stub);
}

/**
 * Restore the original Client + StdioClientTransport prototypes.
 *
 * @param {import('@playwright/test').ElectronApplication} electronApp
 */
async function restoreMcpClient(electronApp) {
    if (!electronApp) return;
    await electronApp
        .evaluate(async () => {
            if (!global.__dashE2EMcpPatched) return;
            try {
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

                const Client = sdkClient && sdkClient.Client;
                const orig = global.__dashE2EMcpOriginalClient;
                if (Client && orig) {
                    Client.prototype.connect = orig.connect;
                    Client.prototype.listTools = orig.listTools;
                    Client.prototype.callTool = orig.callTool;
                    Client.prototype.listResources = orig.listResources;
                    Client.prototype.close = orig.close;
                }
                const Stdio = sdkStdio && sdkStdio.StdioClientTransport;
                const origStdio = global.__dashE2EMcpOriginalStdio;
                if (Stdio && origStdio) {
                    Stdio.prototype.start = origStdio.start;
                    Stdio.prototype.close = origStdio.close;
                }
            } finally {
                global.__dashE2EMcpStubs = [];
                global.__dashE2EMcpStubsPending = [];
                global.__dashE2EMcpPatched = false;
                delete global.__dashE2EMcpOriginalClient;
                delete global.__dashE2EMcpOriginalStdio;
            }
        })
        .catch(() => {});
}

module.exports = { stubMcpServer, restoreMcpClient };
