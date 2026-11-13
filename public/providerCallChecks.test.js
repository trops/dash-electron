/**
 * The Checker holds a widget's provider calls to the user's live tools —
 * the tool must exist, required inputs given, no inputs it doesn't take,
 * and no file path or web address written into the code (it belongs in a
 * setting).
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
    findToolCalls,
    providerCallProblems,
    declaredTypes,
} = require("./lib/providerCallChecks.cjs");

const files = {
    provider: "My Files",
    tools: [
        {
            name: "read_text_file",
            inputSchema: {
                type: "object",
                properties: {
                    path: { type: "string" },
                    head: { type: "number" },
                },
                required: ["path"],
                additionalProperties: false,
            },
        },
        { name: "list_allowed_directories", inputSchema: { properties: {} } },
    ],
};
const live = { filesystem: files };
const config = `export default { providers: [{ type: "filesystem", providerClass: "mcp" }] };`;

describe("findToolCalls", () => {
    it("finds each callTool with a written tool name and its inputs", () => {
        const code = `
            const { callTool } = useMcpProvider("filesystem");
            callTool("read_text_file", { path: filePath, head: 20, ...extra });
            await mcp.callTool('list_allowed_directories', {});
            callTool(name, {});
        `;
        const calls = findToolCalls(code);
        assert.equal(calls.length, 2);
        assert.equal(calls[0].tool, "read_text_file");
        assert.deepEqual(
            calls[0].entries.map((e) => e.key),
            ["path", "head"]
        );
        assert.equal(calls[0].spread, true);
        assert.equal(calls[0].entries[0].literal, undefined);
        assert.equal(calls[1].tool, "list_allowed_directories");
    });
});

describe("declaredTypes", () => {
    it("each provider's own type — a nested list or type doesn't cut it short", () => {
        assert.deepEqual(
            declaredTypes(`export default {
  providers: [
    { type: "filesystem", allowedTools: ["read"], credentialSchema: { key: { type: "password" } } },
    { type: "search-api", providerClass: "mcp" },
  ],
};`),
            ["filesystem", "search-api"]
        );
    });
});

describe("providerCallProblems", () => {
    it("a call that fits the live tool passes", () => {
        const code = `callTool("read_text_file", { path: filePath, head: 20 });`;
        assert.deepEqual(providerCallProblems(code, config, live), []);
    });

    it("a tool the provider doesn't have", () => {
        const code = `callTool("read_file", { path: filePath });`;
        const [p] = providerCallProblems(code, config, live);
        assert.match(
            p,
            /line 1: callTool\("read_file"\) — My Files has no tool read_file\. Its tools: read_text_file, list_allowed_directories/
        );
    });

    it("a required input left out, or one the tool says it doesn't take", () => {
        const code = `callTool("read_text_file", { file: filePath });`;
        const said = providerCallProblems(code, config, live).join("\n");
        assert.match(said, /read_text_file needs path/);
        assert.match(said, /doesn't take file — it takes path, head/);
    });

    it("a file path or web address written into the code must be a setting", () => {
        const one = (v) =>
            providerCallProblems(
                `callTool("read_text_file", { path: ${JSON.stringify(v)} });`,
                config,
                live
            );
        assert.match(
            one("From /Users/me/notes/list.md")[0],
            /read_text_file's path is written into the code \("From \/Users\/me\/notes\/list\.md"\) — make it a userConfig setting/
        );
        assert.equal(one("~/notes/list.md").length, 1);
        assert.equal(one("https://example.com/feed").length, 1);
        // Part of how a call works, not the user's data: no problem.
        for (const v of [
            "v1.2",
            "sort.asc",
            "user.name",
            "README.md",
            "/repos",
            "e.g. milk",
        ]) {
            assert.deepEqual(one(v), [], v);
        }
    });

    it("a second provider that isn't running: its calls aren't called missing", () => {
        const two = `export default { providers: [{ type: "filesystem" }, { type: "search-api" }] };`;
        const code = `callTool("search_index", { query: q });`;
        assert.deepEqual(providerCallProblems(code, two, live), []);
    });

    it("no live tools known: nothing to say about the call", () => {
        const code = `callTool("anything", { a: 1 });`;
        assert.deepEqual(providerCallProblems(code, config, {}), []);
    });
});
