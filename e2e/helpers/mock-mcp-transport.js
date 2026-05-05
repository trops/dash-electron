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
        const moduleRequire =
            globalThis.__e2eRequire ||
            (process.mainModule && process.mainModule.require);

        const tryRequireFrom = (req, id) => {
            try {
                return req(id);
            } catch (_) {
                return null;
            }
        };

        // Linked package layout: dash-electron has its own copy of
        // @modelcontextprotocol/sdk, and dash-core (when symlinked into
        // node_modules) has its own nested copy. The two require()
        // resolutions return *different* module instances, so patching
        // one Client prototype leaves dash-core's path untouched and
        // mcpController.startServer ends up calling the real, unpatched
        // connect/start (which spawns a real subprocess that fails).
        // Collect every reachable {Client, Stdio} pair so we patch all
        // of them.
        const collectSdkPairs = () => {
            const pairs = [];
            const seen = new Set();
            const addFromReq = (req) => {
                const c =
                    tryRequireFrom(
                        req,
                        "@modelcontextprotocol/sdk/client/index.js"
                    ) ||
                    tryRequireFrom(
                        req,
                        "@modelcontextprotocol/sdk/dist/cjs/client/index.js"
                    );
                const s =
                    tryRequireFrom(
                        req,
                        "@modelcontextprotocol/sdk/client/stdio.js"
                    ) ||
                    tryRequireFrom(
                        req,
                        "@modelcontextprotocol/sdk/dist/cjs/client/stdio.js"
                    );
                if (!c || !c.Client) return;
                if (seen.has(c.Client)) return;
                seen.add(c.Client);
                pairs.push({
                    Client: c.Client,
                    Stdio: s && s.StdioClientTransport,
                });
            };

            // 1. dash-electron's main-process require
            addFromReq(moduleRequire);

            // 2. dash-core's nested copy when linked. Resolve the
            //    dash-core package main, then build a require() rooted
            //    there so module resolution walks dash-core's
            //    node_modules first.
            try {
                const Module = moduleRequire("module");
                const dashCoreMain =
                    moduleRequire.resolve &&
                    moduleRequire.resolve("@trops/dash-core");
                if (dashCoreMain && Module && Module.createRequire) {
                    addFromReq(Module.createRequire(dashCoreMain));
                }
            } catch (_) {
                /* dash-core not installed or no nested copy — single pair is fine */
            }
            return pairs;
        };

        const installPatch = () => {
            const pairs = collectSdkPairs();
            if (pairs.length === 0) return false;

            global.__dashE2EMcpStubs = global.__dashE2EMcpStubs || [];

            if (!global.__dashE2EMcpPatched) {
                global.__dashE2EMcpOriginalPairs = [];

                const matchTransport = (transport) => {
                    if (!transport) return null;
                    // The SDK stores constructor params as
                    // `transport._serverParams = { command, args, env, ... }`.
                    // Older paths also tried `_command`/`command` directly;
                    // support both for forward/backward compatibility.
                    const params =
                        transport._serverParams || transport.serverParams || {};
                    const cmd =
                        params.command ||
                        transport._command ||
                        transport.command ||
                        "";
                    const argList =
                        params.args || transport._args || transport.args || [];
                    const sig = `${cmd} ${
                        Array.isArray(argList) ? argList.join(" ") : ""
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

                for (const { Client, Stdio } of pairs) {
                    const orig = {
                        Client,
                        Stdio,
                        client: {
                            connect: Client.prototype.connect,
                            listTools: Client.prototype.listTools,
                            callTool: Client.prototype.callTool,
                            listResources: Client.prototype.listResources,
                            close: Client.prototype.close,
                        },
                        stdio:
                            Stdio && Stdio.prototype
                                ? {
                                      start: Stdio.prototype.start,
                                      close: Stdio.prototype.close,
                                  }
                                : null,
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
                        Stdio.prototype.start = async function () {
                            /* no-op: do not spawn */
                        };
                        Stdio.prototype.close = async function () {
                            /* no-op */
                        };
                    }

                    global.__dashE2EMcpOriginalPairs.push(orig);
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
            try {
                const pairs = global.__dashE2EMcpOriginalPairs || [];
                for (const orig of pairs) {
                    const { Client, Stdio, client, stdio } = orig;
                    if (Client && client) {
                        Client.prototype.connect = client.connect;
                        Client.prototype.listTools = client.listTools;
                        Client.prototype.callTool = client.callTool;
                        Client.prototype.listResources = client.listResources;
                        Client.prototype.close = client.close;
                    }
                    if (Stdio && Stdio.prototype && stdio) {
                        Stdio.prototype.start = stdio.start;
                        Stdio.prototype.close = stdio.close;
                    }
                }
            } finally {
                global.__dashE2EMcpStubs = [];
                global.__dashE2EMcpPatched = false;
                delete global.__dashE2EMcpOriginalPairs;
            }
        })
        .catch(() => {});
}

module.exports = { stubMcpServer, restoreMcpClient };
