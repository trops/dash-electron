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
        const tryRequire = (id) => {
            try {
                return moduleRequire(id);
            } catch (_) {
                return null;
            }
        };

        const sdkClient =
            tryRequire("@modelcontextprotocol/sdk/client/index.js") ||
            tryRequire("@modelcontextprotocol/sdk/dist/cjs/client/index.js");
        const Client = sdkClient && sdkClient.Client;
        if (!Client) return false;

        global.__dashE2ESecurityCalls = global.__dashE2ESecurityCalls || [];

        if (!global.__dashE2ESecurityRecorderInstalled) {
            const previous = Client.prototype.callTool;
            Client.prototype.callTool = async function (args) {
                global.__dashE2ESecurityCalls.push({
                    name: (args && args.name) || null,
                    arguments: (args && args.arguments) || null,
                    ts: Date.now(),
                });
                return previous.call(this, args);
            };
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
