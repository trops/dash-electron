/**
 * scanWidgetMcpUsage.test.js
 *
 * Pin for the static scanner that reads AI-generated widget code and
 * emits a `dash.permissions.mcp` block describing which MCP tools the
 * widget will call. The result is injected into the widget's
 * package.json + dash.json by the AI build IPC handler so the runtime
 * sees declared permissions instead of cold-starting at the first tool
 * call (and dripping JIT prompts forever).
 *
 * Run via `node --test scripts/scanWidgetMcpUsage.test.js`.
 */

const test = require("node:test");
const assert = require("node:assert");

const { scanWidgetMcpUsage } = require("./scanWidgetMcpUsage");

test("detects single useMcpProvider + callTool", () => {
    const code = `
        import { useMcpProvider } from "@trops/dash-core";
        export default function W() {
            const { callTool } = useMcpProvider("google-drive");
            return <button onClick={() => callTool("search", { q: "x" })} />;
        }
    `;
    const out = scanWidgetMcpUsage(code);
    assert.deepStrictEqual(out, {
        "google-drive": { tools: ["search"] },
    });
});

test("detects multiple distinct tools under one provider", () => {
    const code = `
        const { callTool } = useMcpProvider("google-drive");
        callTool("search", {});
        callTool("list_folder", {});
        callTool("read_file", {});
    `;
    const out = scanWidgetMcpUsage(code);
    assert.deepStrictEqual(out["google-drive"].tools.sort(), [
        "list_folder",
        "read_file",
        "search",
    ]);
});

test("dedupes repeated tool names", () => {
    const code = `
        const { callTool } = useMcpProvider("slack");
        callTool("send_message", {});
        callTool("send_message", { text: "hi" });
    `;
    const out = scanWidgetMcpUsage(code);
    assert.deepStrictEqual(out, {
        slack: { tools: ["send_message"] },
    });
});

test("accepts single + double + backtick quotes", () => {
    const code = `
        useMcpProvider('github');
        callTool("search_repositories", {});
        callTool('list_issues', {});
        callTool(\`create_issue\`, {});
    `;
    const out = scanWidgetMcpUsage(code);
    assert.deepStrictEqual(out.github.tools.sort(), [
        "create_issue",
        "list_issues",
        "search_repositories",
    ]);
});

test("returns empty object when no MCP usage", () => {
    const code = `
        export default function W() {
            return <div>hello</div>;
        }
    `;
    assert.deepStrictEqual(scanWidgetMcpUsage(code), {});
});

test("defensive on null/undefined/empty/non-string input", () => {
    assert.deepStrictEqual(scanWidgetMcpUsage(null), {});
    assert.deepStrictEqual(scanWidgetMcpUsage(undefined), {});
    assert.deepStrictEqual(scanWidgetMcpUsage(""), {});
    assert.deepStrictEqual(scanWidgetMcpUsage(42), {});
});

test("ignores callTool with non-literal first arg", () => {
    // Variable indirection means we can't statically know the tool;
    // skip rather than emitting bogus declarations.
    const code = `
        useMcpProvider("github");
        const tool = chooseTool();
        callTool(tool, {});
        callTool("search_repositories", {});
    `;
    const out = scanWidgetMcpUsage(code);
    assert.deepStrictEqual(out, {
        github: { tools: ["search_repositories"] },
    });
});

test("ignores callTool inside line comments", () => {
    // Static scan should skip commented-out code so dead examples
    // don't pollute the declared permissions.
    const code = `
        useMcpProvider("github");
        // callTool("dead_code", {});
        callTool("alive", {});
    `;
    const out = scanWidgetMcpUsage(code);
    assert.deepStrictEqual(out, {
        github: { tools: ["alive"] },
    });
});

test("multiple providers in one widget — tools under each (conservative)", () => {
    // Edge case: a widget that declares multiple useMcpProvider() hooks.
    // Without scope-tracking we can't know which tool came from which
    // provider — declare them under all providers for over-grant safety.
    // The runtime gate denies missing tools regardless, so this just
    // means the user is asked about a tool that may never be called.
    const code = `
        useMcpProvider("github");
        useMcpProvider("slack");
        callTool("search_repositories", {});
        callTool("send_message", {});
    `;
    const out = scanWidgetMcpUsage(code);
    assert.deepStrictEqual(out.github.tools.sort(), [
        "search_repositories",
        "send_message",
    ]);
    assert.deepStrictEqual(out.slack.tools.sort(), [
        "search_repositories",
        "send_message",
    ]);
});

test("callTool found without any useMcpProvider yields no declarations", () => {
    // A callTool reference with no provider hook nearby probably means
    // someone destructured it from props or another helper — we have no
    // server to attribute it to, so skip.
    const code = `
        const { callTool } = props;
        callTool("orphan", {});
    `;
    assert.deepStrictEqual(scanWidgetMcpUsage(code), {});
});
