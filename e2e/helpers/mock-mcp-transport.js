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
 * prototypes inside the main process so:
 *
 *   - `client.connect()` is a no-op (no subprocess spawn).
 *   - `client.listTools()` returns canned tools per server name.
 *   - `client.callTool()` returns canned results per (server, tool).
 *   - `client.listResources()` returns an empty list (or canned).
 *   - `client.close()` is a no-op.
 *
 * Implementation note: `require()` is not lexically in scope inside
 * `electronApp.evaluate()` — Playwright wraps the body in a fresh
 * Function. We use `process.mainModule.require()` instead, since
 * `process` is a true Node global.
 */

async function stubMcpServer(electronApp, stub) {
    await electronApp.evaluate(async (_electron, stubArg) => {
        const moduleRequire = process.mainModule && process.mainModule.require;

        const tryRequire = (id) => {
            try {
                return moduleRequire(id);
            } catch (_) {
                return null;
            }
        };

        const installPatch = () => {
            const sdkClient =
                tryRequire("@modelcontextprotocol/sdk/client/index.js") ||
                tryRequire(
                    "@modelcontextprotocol/sdk/dist/cjs/client/index.js"
                );
            const sdkStdio =
                tryRequire("@modelcontextprotocol/sdk/client/stdio.js") ||
                tryRequire(
                    "@modelcontextprotocol/sdk/dist/cjs/client/stdio.js"
                );

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

        installPatch();
    }, stub);
}

async function restoreMcpClient(electronApp) {
    if (!electronApp) return;
    await electronApp
        .evaluate(async () => {
            if (!global.__dashE2EMcpPatched) return;
            const moduleRequire =
                process.mainModule && process.mainModule.require;
            const tryRequire = (id) => {
                try {
                    return moduleRequire(id);
                } catch (_) {
                    return null;
                }
            };
            try {
                const sdkClient =
                    tryRequire("@modelcontextprotocol/sdk/client/index.js") ||
                    tryRequire(
                        "@modelcontextprotocol/sdk/dist/cjs/client/index.js"
                    );
                const sdkStdio =
                    tryRequire("@modelcontextprotocol/sdk/client/stdio.js") ||
                    tryRequire(
                        "@modelcontextprotocol/sdk/dist/cjs/client/stdio.js"
                    );

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
                global.__dashE2EMcpPatched = false;
                delete global.__dashE2EMcpOriginalClient;
                delete global.__dashE2EMcpOriginalStdio;
            }
        })
        .catch(() => {});
}

module.exports = { stubMcpServer, restoreMcpClient };
