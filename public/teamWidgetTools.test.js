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
            /loggedHandle\("widget:ai-build", async \(e, message\) =>\s*aiBuild\(message, \{ windows \}\)/
        );
    });
    it("botController gets the team's widget tools", () => {
        assert.match(main, /widgetTools: createTeamWidgetTools\(\{/);
    });
});
