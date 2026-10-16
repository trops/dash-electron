/**
 * teamWidgetTools.test.js — the widget hooks the Dash team's Builder and
 * Checker use (create-entry CRE-011, slice 3b-1), and the Widget Builder's
 * IPC handlers delegating to lib/aiBuild.cjs.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
    createTeamWidgetTools,
    codeProblems,
    scorecardSummary,
} = require("./lib/teamWidgetTools.cjs");

const GOOD_COMPONENT = `import React from "react";
import { Panel, Heading } from "@trops/dash-react";
export default function HelloWidget({ title = "Hello" }) {
    return (
        <Panel>
            <Heading title={title} />
        </Panel>
    );
}
`;
const GOOD_CONFIG = `import HelloWidget from "./HelloWidget";
export default {
    component: HelloWidget,
    type: "widget",
    userConfig: { title: { type: "text", defaultValue: "Hello" } },
};
`;

function setup(over = {}) {
    const installed = new Map(Object.entries(over.installed || {}));
    const calls = { build: [], compile: [] };
    const skillPath = path.join(os.tmpdir(), `skill-${process.pid}.md`);
    fs.writeFileSync(skillPath, "# Widget rules\nUse dash-react.");
    const tools = createTeamWidgetTools({
        getRegistry: () => ({ getWidget: (n) => installed.get(n) || null }),
        readWidgetSources: async ({ widgetName }) => {
            const w = installed.get(widgetName);
            return w
                ? {
                      success: true,
                      componentName: w.componentName,
                      componentCode: w.componentCode,
                      configCode: w.configCode,
                  }
                : { success: false, error: `Widget not found: ${widgetName}` };
        },
        getWindows: () => [],
        skillPath,
        aiBuild: async (msg) => {
            calls.build.push(msg);
            return (
                over.buildResult || {
                    success: true,
                    widgetName: `@ai-built/${msg.widgetName.toLowerCase()}`,
                }
            );
        },
        compilePreview: async (msg) => {
            calls.compile.push(msg);
            return over.compileResult || { success: true, bundleSource: "x" };
        },
        // A whole-package compile (the install's): records what the folder held.
        compileWidget: async (dir) => {
            calls.packageCompile = (calls.packageCompile || []).concat({
                files: fs.readdirSync(path.join(dir, "widgets")).sort(),
                hits: fs.existsSync(path.join(dir, "widgets", "Boost.js"))
                    ? fs.readFileSync(
                          path.join(dir, "widgets", "Boost.js"),
                          "utf8"
                      )
                    : null,
            });
            if (over.packageCompileError)
                throw new Error(over.packageCompileError);
            return path.join(dir, "dist", "index.cjs.js");
        },
        getPackagePath: (name) => (over.packagePaths || {})[name] || null,
    });
    return { tools, calls, installed };
}

describe("build", () => {
    it("checks, then compiles and installs a new widget", async () => {
        const { tools, calls } = setup();
        const res = await tools.build({
            name: "HelloWidget",
            componentCode: GOOD_COMPONENT,
            configCode: GOOD_CONFIG,
        });
        assert.deepEqual(res, {
            success: true,
            widgetName: "@ai-built/hellowidget",
        });
        assert.equal(calls.build.length, 1);
        assert.equal(calls.build[0].selectedProvider, null);
    });

    it("refuses bad names and missing code", async () => {
        const { tools, calls } = setup();
        let res = await tools.build({
            name: "hello widget",
            componentCode: "x",
            configCode: "y",
        });
        assert.match(res.error, /PascalCase/);
        res = await tools.build({
            name: "HelloWidget",
            componentCode: GOOD_COMPONENT,
        });
        assert.match(res.error, /Both the component code/);
        assert.equal(calls.build.length, 0);
    });

    it("never installs code that fails the Widget Builder's checks", async () => {
        const { tools, calls } = setup();
        const res = await tools.build({
            name: "BadWidget",
            componentCode: GOOD_COMPONENT.replace("<Panel>", "<Modal>").replace(
                "</Panel>",
                "</Modal>"
            ),
            configCode: GOOD_CONFIG,
        });
        assert.equal(res.success, false);
        assert.ok(res.problems.length > 0);
        assert.equal(calls.build.length, 0);
    });

    it("an existing name needs update: true; update needs an @ai-built widget", async () => {
        const existing = {
            "@ai-built/hellowidget": {
                componentName: "HelloWidget",
                componentCode: GOOD_COMPONENT,
                configCode: GOOD_CONFIG,
            },
        };
        let { tools } = setup({ installed: existing });
        let res = await tools.build({
            name: "HelloWidget",
            componentCode: GOOD_COMPONENT,
            configCode: GOOD_CONFIG,
        });
        assert.match(res.error, /already exists/);
        ({ tools } = setup());
        res = await tools.build({
            name: "HelloWidget",
            componentCode: GOOD_COMPONENT,
            configCode: GOOD_CONFIG,
            update: true,
        });
        assert.match(res.error, /only widgets the AI built can be updated/);
    });

    it("passes a full provider pick through, ignores anything else", async () => {
        const { tools, calls } = setup();
        await tools.build({
            name: "HelloWidget",
            componentCode: GOOD_COMPONENT,
            configCode: GOOD_CONFIG,
            provider: { type: "gmail", providerClass: "mcp" },
        });
        await tools.build({
            name: "OtherWidget",
            componentCode: GOOD_COMPONENT,
            configCode: GOOD_CONFIG,
            provider: "gmail",
        });
        assert.deepEqual(calls.build[0].selectedProvider, {
            type: "gmail",
            providerClass: "mcp",
        });
        assert.equal(calls.build[1].selectedProvider, null);
    });
});

describe("check", () => {
    it("compiles, runs the code checks and the scorecard; keeps the config from before an update", async () => {
        const existing = {
            "@ai-built/hellowidget": {
                componentName: "HelloWidget",
                componentCode: GOOD_COMPONENT,
                configCode: GOOD_CONFIG,
            },
        };
        const { tools, installed } = setup({ installed: existing });
        let res = await tools.check({ name: "@ai-built/hellowidget" });
        assert.equal(res.success, true);
        assert.deepEqual(res.compile, { ok: true });
        assert.deepEqual(res.problems, []);
        assert.ok(res.scorecard.passed >= 0);
        assert.equal(res.previousConfigCode, null);

        const newConfig = GOOD_CONFIG.replace(
            'userConfig: { title: { type: "text", defaultValue: "Hello" } },',
            "userConfig: {},"
        );
        await tools.build({
            name: "HelloWidget",
            componentCode: GOOD_COMPONENT,
            configCode: newConfig,
            update: true,
        });
        installed.get("@ai-built/hellowidget").configCode = newConfig;
        res = await tools.check({ name: "@ai-built/hellowidget" });
        assert.equal(res.previousConfigCode, GOOD_CONFIG);
        assert.equal(res.configCode, newConfig);
    });

    it("reports a compile failure and a missing widget", async () => {
        const existing = {
            "@ai-built/x": {
                componentName: "X",
                componentCode: GOOD_COMPONENT,
                configCode: GOOD_CONFIG,
            },
        };
        const { tools } = setup({
            installed: existing,
            compileResult: { success: false, error: "Unexpected token" },
        });
        const res = await tools.check({ name: "@ai-built/x" });
        assert.deepEqual(res.compile, { ok: false, error: "Unexpected token" });
        const missing = await tools.check({ name: "@ai-built/nope" });
        assert.equal(missing.success, false);
    });
});

describe("guide", () => {
    it("tries each path in order", () => {
        const skill = path.join(os.tmpdir(), `skill2-${process.pid}.md`);
        fs.writeFileSync(skill, "# Found");
        const t = createTeamWidgetTools({
            getRegistry: () => ({ getWidget: () => null }),
            readWidgetSources: async () => ({ success: false }),
            getWindows: () => [],
            skillPath: ["/nope/SKILL.md", skill],
        });
        assert.match(t.guide({}).rules, /# Found/);
    });

    it("returns the rules and known tool names per provider type", () => {
        const { tools } = setup();
        const g = tools.guide({ providers: ["gmail", "made-up"] });
        assert.match(g.rules, /Widget rules/);
        assert.ok(g.tools.gmail.some((t) => t.name === "search_messages"));
        assert.deepEqual(g.tools["made-up"], []);
    });
});

describe("codeProblems", () => {
    it("is empty for good code", () => {
        assert.deepEqual(codeProblems(GOOD_COMPONENT), []);
    });
    it("refuses a widget that starts a bot (TD-005)", () => {
        const code = GOOD_COMPONENT.replace(
            "    return (",
            "    window.mainApi.bots.run('b');\n    return ("
        );
        const p = codeProblems(code);
        assert.ok(p.some((x) => /widgets may not start bots/.test(x)));
    });

    it("refuses api.publishEvent — bots can't hear it (4d-2)", () => {
        const code = GOOD_COMPONENT.replace(
            "    return (",
            "    props.api.publishEvent('askClicked', {});\n    return ("
        );
        const p = codeProblems(code);
        assert.ok(
            p.some((x) =>
                /api\.publishEvent sends the bare event name.*useWidgetEvents/.test(
                    x
                )
            )
        );
        assert.ok(
            !codeProblems(GOOD_COMPONENT).some((x) => /publishEvent/.test(x))
        );
    });
});

describe("the Widget Builder's IPC handlers use lib/aiBuild.cjs", () => {
    const main = fs.readFileSync(path.join(__dirname, "electron.js"), "utf8");
    it("both handlers delegate", () => {
        assert.match(
            main,
            /loggedHandle\("widget:ai-compile-preview", async \(e, message\) =>\s*compilePreview\(message\)/
        );
        assert.match(
            main,
            // After installAllowed (consolidation Phase 1a).
            /loggedHandle\("widget:ai-build", async \(e, message\) => \{[\s\S]{0,900}return aiBuild\(msg, \{ windows \}\);/
        );
    });
    it("botController and the Widget Builder's checks share the team's widget tools", () => {
        assert.match(
            main,
            /teamWidgetToolsInstance = createTeamWidgetTools\(\{/
        );
        assert.match(main, /widgetTools: teamWidgetTools\(\),/);
        assert.match(
            main,
            /"widget:check-draft"[\s\S]{0,120}teamWidgetTools\(\)\.checkDraft\(/
        );
    });
});

// Create build fixes 3: a widget with a connection never asks for keys, and
// a data widget must show loading and errors.
const KEYS_CONFIG = `export default {
    component: "Boost",
    type: "widget",
    providers: [{ type: "algolia", providerClass: "mcp", required: true }],
    userConfig: { adminApiKey: { type: "text", defaultValue: "" } },
};
`;
const KEYS_COMPONENT = `import React from "react";
import { Panel } from "@trops/dash-react";
export default function Boost({ adminApiKey }) {
    const save = () => fetch("https://x.algolia.net/1/rules", { headers: { "X-Algolia-API-Key": adminApiKey } });
    return <Panel />;
}
`;

describe("connection credentials (Create build fixes 3)", () => {
    it("codeProblems names the key setting and the direct call", () => {
        const p = codeProblems(KEYS_COMPONENT, KEYS_CONFIG);
        assert.ok(
            p.some((x) =>
                /setting "adminApiKey" asks for a key the algolia connection already provides/.test(
                    x
                )
            ),
            p.join("\n")
        );
        assert.ok(
            p.some((x) => /line 4: calls algolia directly with fetch/.test(x)),
            p.join("\n")
        );
        assert.deepEqual(codeProblems(GOOD_COMPONENT, GOOD_CONFIG), []);
    });

    it("build refuses it before installing", async () => {
        const { tools, calls } = setup();
        const res = await tools.build({
            name: "Boost",
            componentCode: KEYS_COMPONENT,
            configCode: KEYS_CONFIG,
        });
        assert.equal(res.success, false);
        assert.ok(res.problems.some((x) => /adminApiKey/.test(x)));
        assert.equal(calls.build.length, 0);
    });

    it("check reports it", async () => {
        const { tools } = setup({
            installed: {
                "@ai-built/boost": {
                    componentName: "Boost",
                    componentCode: KEYS_COMPONENT,
                    configCode: KEYS_CONFIG,
                },
            },
        });
        const res = await tools.check({ name: "@ai-built/boost" });
        assert.ok(res.problems.some((x) => /directly with fetch/.test(x)));
    });
});

describe("scorecardSummary must-fix items (Create build fixes 3)", () => {
    it("a data widget missing loading and error states must fix them; style misses are notes", () => {
        const code = `export default function W() { window.mainApi.algolia.search({}); return <div>x</div>; }`;
        const sc = scorecardSummary(code);
        const must = sc.failed.filter((f) => f.mustFix).map((f) => f.item);
        assert.ok(
            must.some((i) => /^Loading state/.test(i)),
            must.join("\n")
        );
        assert.ok(
            must.some((i) => /^Error state/.test(i)),
            must.join("\n")
        );
        assert.equal(must.length, 2);
        assert.ok(
            sc.failed.some((f) => !f.mustFix && /^Title uses/.test(f.item))
        );
    });
});

describe("checkDraft — the Widget Builder's unsaved code, checked before it's saved", () => {
    function packageDir() {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zz-pkg-"));
        fs.mkdirSync(path.join(dir, "widgets"));
        fs.writeFileSync(path.join(dir, "widgets", "Boost.js"), "old");
        fs.writeFileSync(path.join(dir, "widgets", "Boost.dash.js"), "old cfg");
        fs.writeFileSync(
            path.join(dir, "widgets", "sharedConfig.js"),
            "shared"
        );
        fs.writeFileSync(
            path.join(dir, "dash.json"),
            JSON.stringify({ name: "x", version: "1.0.0" })
        );
        return dir;
    }

    it("compiles the unsaved code inside a copy of its package, runs the checks, keeps the result for the Checker", async () => {
        const pkg = packageDir();
        try {
            const { tools, calls } = setup({
                packagePaths: { "@trops/boost": pkg },
            });
            const res = await tools.checkDraft({
                widgetName: "Boost",
                componentCode: KEYS_COMPONENT,
                configCode: KEYS_CONFIG,
                sourcePackage: "@trops/boost",
            });
            assert.equal(res.success, true);
            assert.equal(res.widgetName, "draft:Boost");
            assert.deepEqual(res.compile, { ok: true });
            // The package's shared file was there; the unsaved code was written.
            assert.deepEqual(calls.packageCompile[0].files, [
                "Boost.dash.js",
                "Boost.js",
                "sharedConfig.js",
            ]);
            assert.equal(calls.packageCompile[0].hits, KEYS_COMPONENT);
            assert.ok(res.problems.some((p) => /adminApiKey/.test(p)));
            // The installed package itself is untouched.
            assert.equal(
                fs.readFileSync(path.join(pkg, "widgets", "Boost.js"), "utf8"),
                "old"
            );
            // The Checker's check_widget reads it by the draft name.
            const again = await tools.check({ name: "draft:Boost" });
            assert.equal(again.widgetName, "draft:Boost");
            assert.deepEqual(again.problems, res.problems);
            assert.equal(again.componentCode, KEYS_COMPONENT);
        } finally {
            fs.rmSync(pkg, { recursive: true, force: true });
        }
    });

    it("a compile failure is the result, not a throw; a new widget has no package to copy", async () => {
        const { tools, calls } = setup({
            packageCompileError:
                "The widget didn't build:\n- Boost.js: Unexpected token",
        });
        const res = await tools.checkDraft({
            widgetName: "Boost",
            componentCode: GOOD_COMPONENT,
            configCode: GOOD_CONFIG,
        });
        assert.equal(res.success, true);
        assert.equal(res.compile.ok, false);
        assert.match(res.compile.error, /Unexpected token/);
        assert.deepEqual(calls.packageCompile[0].files, [
            "Boost.dash.js",
            "Boost.js",
        ]);
    });

    it("checking a draft that was never staged says so", async () => {
        const { tools } = setup();
        const res = await tools.check({ name: "draft:Nope" });
        assert.equal(res.success, false);
        assert.match(res.error, /check it again from the Widget Builder/);
    });
});
