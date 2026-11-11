/**
 * The Debug Console marks a handler that answered with an error as an error
 * (issues PRD) — e.g. a widget's MCP call that came back `{ error: true }`
 * or with an `isError` tool result was logged as a success before.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { resultFailed, failureText } = require("./lib/ipcResult.cjs");

describe("resultFailed", () => {
    it("an error answer or a tool error result is a failure", () => {
        assert.equal(
            resultFailed({ error: true, message: "connect ECONNREFUSED" }),
            true
        );
        assert.equal(
            resultFailed({
                success: true,
                result: { isError: true, content: [{ text: "Not found" }] },
            }),
            true
        );
    });
    it("anything else isn't", () => {
        assert.equal(
            resultFailed({ success: true, result: { content: [] } }),
            false
        );
        // Some handlers answer success: false for normal outcomes.
        assert.equal(resultFailed({ success: false, reason: "muted" }), false);
        assert.equal(resultFailed(null), false);
        assert.equal(resultFailed("ok"), false);
        assert.equal(resultFailed([1, 2]), false);
    });
});

describe("failureText", () => {
    it("says why, from the message or the tool's text", () => {
        assert.equal(failureText({ error: true, message: "boom" }), "boom");
        assert.equal(
            failureText({
                result: { isError: true, content: [{ text: "Not found" }] },
            }),
            "Not found"
        );
    });
});
