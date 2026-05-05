/**
 * recordMcpCalls.js
 *
 * Layered on top of `helpers/mock-mcp-transport.js`. After
 * `stubMcpServer` has installed its prototype patches, this helper
 * patches `Client.prototype.callTool` ONE more time to push every
 * invocation into a global array (`global.__dashE2ESecurityCalls`).
 *
 * The call-record is what lets the security suite assert "the gate let
 * exactly these calls through to the server" — which is the precise
 * security property we care about.
 *
 * Each recorded entry: `{ name, arguments, ts }`.
 *
 * Usage:
 *
 *   await stubMcpServer(electronApp, {
 *     match: { commandIncludes: "test-server" },
 *     tools: [...],
 *     callResults: { read_file: { content: [...] } },
 *   });
 *   await installCallRecorder(electronApp);
 *
 *   // ... run the test ...
 *
 *   const calls = await getRecordedCalls(electronApp);
 *   expect(calls).toHaveLength(1);
 *   expect(calls[0].name).toBe("read_file");
 *
 *   await clearRecordedCalls(electronApp);
 */
"use strict";

async function installCallRecorder(electronApp) {
    await electronApp.evaluate(async () => {
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

        // Same dual-resolve as mock-mcp-transport.js — patch every
        // Client class reachable in the launched main process. Without
        // this, dash-core's nested @mcp/sdk copy goes un-recorded.
        const collectClients = () => {
            const out = [];
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
                if (!c || !c.Client) return;
                if (seen.has(c.Client)) return;
                seen.add(c.Client);
                out.push(c.Client);
            };
            addFromReq(moduleRequire);
            try {
                const Module = moduleRequire("module");
                const dashCoreMain =
                    moduleRequire.resolve &&
                    moduleRequire.resolve("@trops/dash-core");
                if (dashCoreMain && Module && Module.createRequire) {
                    addFromReq(Module.createRequire(dashCoreMain));
                }
            } catch (_) {
                /* dash-core not linked or no nested copy */
            }
            return out;
        };

        const Clients = collectClients();
        if (Clients.length === 0) return false;

        global.__dashE2ESecurityCalls = global.__dashE2ESecurityCalls || [];

        if (!global.__dashE2ESecurityRecorderInstalled) {
            for (const Client of Clients) {
                const previous = Client.prototype.callTool;
                Client.prototype.callTool = async function (args) {
                    global.__dashE2ESecurityCalls.push({
                        name: (args && args.name) || null,
                        arguments: (args && args.arguments) || null,
                        ts: Date.now(),
                    });
                    return previous.call(this, args);
                };
            }
            global.__dashE2ESecurityRecorderInstalled = true;
        }
        return true;
    });
}

async function getRecordedCalls(electronApp) {
    return await electronApp.evaluate(async () => {
        return (global.__dashE2ESecurityCalls || []).slice();
    });
}

async function clearRecordedCalls(electronApp) {
    await electronApp.evaluate(async () => {
        global.__dashE2ESecurityCalls = [];
    });
}

module.exports = {
    installCallRecorder,
    getRecordedCalls,
    clearRecordedCalls,
};
