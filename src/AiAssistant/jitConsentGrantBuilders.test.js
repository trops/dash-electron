/**
 * jitConsentGrantBuilders.test.js
 *
 * Pin the grant blobs the JIT modal sends back to the main process.
 * Slice 4 introduces per-action scoping — every fs/network grant the
 * modal writes must include `domains.<domain>.actions: [<action>]`
 * alongside the existing path/host scope, so future calls to other
 * actions on the same path get a fresh prompt instead of riding on
 * the prior consent.
 *
 * Run via `node --test src/AiAssistant/jitConsentGrantBuilders.test.js`.
 */

const test = require("node:test");
const assert = require("node:assert");

const {
    buildFsFilenameGrant,
    buildFsAnyGrant,
    buildNetHostGrant,
    buildNetSubdomainGrant,
    buildNetAnyGrant,
} = require("./jitConsentGrantBuilders");

// ---- fs builders ----

test("buildFsFilenameGrant: write action lands in writePaths + actions[action]", () => {
    const g = buildFsFilenameGrant({
        action: "saveData",
        filename: "/tmp/x.json",
        isWrite: true,
    });
    assert.strictEqual(g.grantOrigin, "live");
    assert.deepStrictEqual(g.domains.fs.actions, ["saveData"]);
    assert.deepStrictEqual(g.domains.fs.writePaths, ["/tmp/x.json"]);
    assert.deepStrictEqual(g.domains.fs.readPaths, []);
});

test("buildFsFilenameGrant: read action lands in readPaths + actions[action]", () => {
    const g = buildFsFilenameGrant({
        action: "readData",
        filename: "/tmp/x.json",
        isWrite: false,
    });
    assert.deepStrictEqual(g.domains.fs.actions, ["readData"]);
    assert.deepStrictEqual(g.domains.fs.readPaths, ["/tmp/x.json"]);
    assert.deepStrictEqual(g.domains.fs.writePaths, []);
});

test("buildFsAnyGrant: write action with '*' wildcard + actions[action]", () => {
    const g = buildFsAnyGrant({ action: "saveData", isWrite: true });
    assert.deepStrictEqual(g.domains.fs.actions, ["saveData"]);
    assert.deepStrictEqual(g.domains.fs.writePaths, ["*"]);
    assert.deepStrictEqual(g.domains.fs.readPaths, []);
});

test("buildFsAnyGrant: read action with '*' wildcard + actions[action]", () => {
    const g = buildFsAnyGrant({ action: "readData", isWrite: false });
    assert.deepStrictEqual(g.domains.fs.actions, ["readData"]);
    assert.deepStrictEqual(g.domains.fs.readPaths, ["*"]);
    assert.deepStrictEqual(g.domains.fs.writePaths, []);
});

// ---- network builders ----

test("buildNetHostGrant: hosts[host] + actions[action]", () => {
    const g = buildNetHostGrant({
        action: "readDataFromURL",
        host: "api.example.com",
    });
    assert.strictEqual(g.grantOrigin, "live");
    assert.deepStrictEqual(g.domains.network.actions, ["readDataFromURL"]);
    assert.deepStrictEqual(g.domains.network.hosts, ["api.example.com"]);
});

test("buildNetSubdomainGrant: hosts[pattern] + actions[action]", () => {
    const g = buildNetSubdomainGrant({
        action: "readDataFromURL",
        pattern: "*.example.com",
    });
    assert.deepStrictEqual(g.domains.network.actions, ["readDataFromURL"]);
    assert.deepStrictEqual(g.domains.network.hosts, ["*.example.com"]);
});

test("buildNetAnyGrant: hosts['*'] + actions[action]", () => {
    const g = buildNetAnyGrant({ action: "readDataFromURL" });
    assert.deepStrictEqual(g.domains.network.actions, ["readDataFromURL"]);
    assert.deepStrictEqual(g.domains.network.hosts, ["*"]);
});
