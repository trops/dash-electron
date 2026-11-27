/**
 * list-tests.test.js (DASH-158): every test file is picked up by exactly
 * one runner, including files no hand-kept list ever named.
 *
 * Run: node --test scripts/list-tests.test.js
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { tempDir } = require("./testUtils/tempDir");

const { listTests } = require("./list-tests");

test("splits node:test files from jest files across src, public, scripts", () => {
    const root = tempDir("zz-list-tests-");
    try {
        const write = (rel, body) => {
            fs.mkdirSync(path.dirname(path.join(root, rel)), {
                recursive: true,
            });
            fs.writeFileSync(path.join(root, rel), body);
        };
        write("src/a/deep/Widget.test.js", "test('x', () => {});");
        write("public/main.test.cjs", 'const test = require("node:test");');
        write("scripts/tool.test.js", "const test = require('node:test');");
        write("public/jestOne.test.js", "describe('x', () => {});");
        write("src/node_modules/pkg/skip.test.js", "");
        write("e2e/tests/skip.test.js", "");
        write("src/notATest.js", "");

        const { node, jest } = listTests(root);
        assert.deepStrictEqual(node, [
            "public/main.test.cjs",
            "scripts/tool.test.js",
        ]);
        assert.deepStrictEqual(jest, [
            "public/jestOne.test.js",
            "src/a/deep/Widget.test.js",
        ]);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test("the real repo: no file in both lists, and this file is in node", () => {
    const { node, jest } = listTests();
    const both = node.filter((f) => jest.includes(f));
    assert.deepStrictEqual(both, []);
    assert.ok(node.includes("scripts/list-tests.test.js"));
    // Two that no list used to name (DASH-158)
    assert.ok(jest.includes("src/BotActivity/wiring.test.js"));
    assert.ok(jest.includes("src/Dash.modalCloseClears.test.js"));
});
