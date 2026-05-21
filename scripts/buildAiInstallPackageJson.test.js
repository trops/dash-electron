/**
 * buildAiInstallPackageJson — manifest shape pinning for AI-built
 * widget installs.
 *
 * The helper is called from `widget:ai-build` (public/electron.js) at
 * Install time to produce the canonical `package.json` written into
 * the build dir before compile. dash-core's `applyScanToPackageJson`
 * runs AFTER copy and merges in the per-component breakdown — this
 * helper is responsible only for the baseline + package-level MCP
 * declarations.
 *
 * Why these tests matter: prior behavior only wrote a package.json
 * when MCP usage was detected, leaving pure-UI widgets (Counter,
 * Notepad, etc.) without any manifest on disk. That broke
 * widgetPermissions identity pinning and forced the gate's
 * JIT-consent path to fall through weaker heuristics.
 *
 * Run: `node --test scripts/buildAiInstallPackageJson.test.js`
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert");

const { buildAiInstallPackageJson } = require("./buildAiInstallPackageJson");

test("baseline manifest is always written, even without MCP usage", () => {
    // Pre-fix behavior: no package.json at all for non-MCP widgets.
    // After fix: name/version/description/main/private always land,
    // and the dash block is omitted (not present as an empty stub).
    const out = buildAiInstallPackageJson({
        widgetName: "Counter",
        description: "A counter with + and - buttons",
        existingPkg: {},
        mcpPermissions: null,
    });
    assert.strictEqual(out.name, "@ai-built/counter");
    assert.strictEqual(out.version, "1.0.0");
    assert.strictEqual(out.description, "A counter with + and - buttons");
    assert.strictEqual(out.main, "dist/index.cjs.js");
    assert.strictEqual(out.private, true);
    assert.strictEqual(out.dash, undefined);
});

test("empty mcpPermissions object is treated as 'no MCP' — no dash block emitted", () => {
    // Distinguishes the "scanner ran and found nothing" case from
    // "MCP usage detected" — an empty object is the former. Writing
    // an empty dash.permissions.mcp would let the gate think the
    // widget *had* declared something and got revoked, which is the
    // wrong UX.
    const out = buildAiInstallPackageJson({
        widgetName: "Counter",
        mcpPermissions: {},
    });
    assert.strictEqual(out.dash, undefined);
});

test("MCP permissions block lands under dash.permissions.mcp when scanner found usage", () => {
    const out = buildAiInstallPackageJson({
        widgetName: "SlackChannelBrowser",
        mcpPermissions: {
            slack: { tools: ["slack_search_channels"] },
        },
    });
    assert.deepStrictEqual(out.dash.permissions.mcp, {
        slack: { tools: ["slack_search_channels"] },
    });
});

test("existing package.json fields shipped by the AI are preserved (except dash, which the scanner owns)", () => {
    // If the AI itself emitted a package.json in the files[] payload
    // (carrying e.g. a future `dependencies` block or a comment),
    // those fields must survive the merge. Only the dash block is
    // re-derived from the live scan.
    const out = buildAiInstallPackageJson({
        widgetName: "MyWidget",
        existingPkg: {
            // The AI's own author note — must NOT be clobbered.
            authorNote: "I generated this in one shot",
            // The AI's own field — also preserved.
            license: "MIT",
        },
        mcpPermissions: { slack: { tools: ["t"] } },
    });
    assert.strictEqual(out.authorNote, "I generated this in one shot");
    assert.strictEqual(out.license, "MIT");
    // And the dash block reflects the scanner.
    assert.deepStrictEqual(out.dash.permissions.mcp, {
        slack: { tools: ["t"] },
    });
});

test("existing dash.permissions fields outside mcp are preserved (e.g. future scheduledTasks)", () => {
    // Hand-authored extensions to `dash.permissions` shouldn't be
    // wiped when we re-write the mcp block. Only `mcp` is owned by
    // the scanner; everything else under `dash.permissions` belongs
    // to whoever wrote it.
    const out = buildAiInstallPackageJson({
        widgetName: "MyWidget",
        existingPkg: {
            dash: {
                permissions: {
                    scheduledTasks: { allowed: true },
                },
                someOtherDashField: "preserved",
            },
        },
        mcpPermissions: { slack: { tools: ["t"] } },
    });
    assert.deepStrictEqual(out.dash.permissions.scheduledTasks, {
        allowed: true,
    });
    assert.strictEqual(out.dash.someOtherDashField, "preserved");
    assert.deepStrictEqual(out.dash.permissions.mcp, {
        slack: { tools: ["t"] },
    });
});

test("description falls back to a synthesized default when caller omits it", () => {
    const out = buildAiInstallPackageJson({ widgetName: "MyWidget" });
    assert.strictEqual(out.description, "AI-generated widget: MyWidget");
});

test("description from caller wins over a description in existingPkg", () => {
    // Subtle but important: the modal's description prop is the
    // user-edited value (Install footer shows it). It must override
    // whatever the AI initially put in its own package.json.
    const out = buildAiInstallPackageJson({
        widgetName: "MyWidget",
        description: "Caller-supplied description",
        existingPkg: {
            description: "AI's stale description",
        },
    });
    assert.strictEqual(out.description, "Caller-supplied description");
});

test("widgetName lowercased into the npm scope, untouched in fallback description", () => {
    // The npm name is conventionally lowercase. The fallback
    // description references the original casing for readability.
    const out = buildAiInstallPackageJson({ widgetName: "PascalCased" });
    assert.strictEqual(out.name, "@ai-built/pascalcased");
    assert.strictEqual(out.description, "AI-generated widget: PascalCased");
});

test("defensive: bad input doesn't throw, produces a sane manifest", () => {
    // The handler runs in the main process; an exception here would
    // surface to the user as "Compilation produced no output" with
    // no useful context. Defensive defaults keep the install path
    // moving even if a caller passes garbage.
    const out = buildAiInstallPackageJson({});
    assert.strictEqual(out.name, "@ai-built/widget");
    assert.strictEqual(out.version, "1.0.0");
    assert.strictEqual(out.description, "AI-generated widget: Widget");
    assert.strictEqual(out.main, "dist/index.cjs.js");
    assert.strictEqual(out.dash, undefined);
});

test("non-object mcpPermissions is treated as 'no MCP' (defensive)", () => {
    const cases = [null, undefined, "", 0, false, "slack"];
    for (const bad of cases) {
        const out = buildAiInstallPackageJson({
            widgetName: "W",
            mcpPermissions: bad,
        });
        assert.strictEqual(
            out.dash,
            undefined,
            `mcpPermissions=${JSON.stringify(
                bad
            )} should not produce a dash block`
        );
    }
});

test("non-object existingPkg is treated as empty (defensive)", () => {
    const out = buildAiInstallPackageJson({
        widgetName: "W",
        existingPkg: "not an object",
    });
    assert.strictEqual(out.name, "@ai-built/w");
    assert.strictEqual(out.version, "1.0.0");
});
