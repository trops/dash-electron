/**
 * installGate.test.js — nothing is installed unchecked (consolidation
 * Phase 1a):
 *   - the Widget Builder's install is enforced by the main process: only
 *     the exact code that passed the code checks and the Checker (read from
 *     the Checker's own run, not the Builder's word) is installed;
 *   - every package install (registry, file, folder, drafts) runs the code
 *     checks through dash-core's install gate.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createTeamWidgetTools } = require("./lib/teamWidgetTools.cjs");
const { installGate } = require("./lib/installGate.cjs");

const COMPONENT = `import React from "react";
import { Panel, Heading } from "@trops/dash-react";
import { label } from "./helpers";
export default function HelloWidget() {
    return (
        <Panel>
            <Heading title={label} />
        </Panel>
    );
}
`;
const CONFIG = `import HelloWidget from "./HelloWidget";
export default { component: HelloWidget, type: "widget" };
`;
const HELPER = {
    path: "widgets/helpers.js",
    content: 'export const label = "Hi";',
};

function setup() {
    const seen = [];
    const tools = createTeamWidgetTools({
        getRegistry: () => ({ getWidget: () => null }),
        readWidgetSources: async () => ({ success: false }),
        getWindows: () => [],
        skillPath: path.join(os.tmpdir(), "no-skill.md"),
        compileWidget: async (dir) => {
            seen.push(fs.readdirSync(path.join(dir, "widgets")).sort());
            return path.join(dir, "dist", "index.cjs.js");
        },
        getPackagePath: () => null,
    });
    return { tools, seen };
}
const checkHello = (tools, extra = {}) =>
    tools.checkDraft({
        widgetName: "HelloWidget",
        componentCode: COMPONENT,
        configCode: CONFIG,
        files: [HELPER],
        ...extra,
    });
const checker = (verdict) => async () => ({
    status: "completed",
    output: `Looks right.\n\nVERDICT: ${verdict}`,
});
const PROMPT =
    "Check the widget being written in the Widget Builder: run check_widget on draft:HelloWidget …";

describe("checkDraft checks the helper files too", () => {
    it("writes them into the package it compiles, and keeps them", async () => {
        const { tools, seen } = setup();
        const res = await checkHello(tools);
        assert.deepEqual(seen[0], [
            "HelloWidget.dash.js",
            "HelloWidget.js",
            "helpers.js",
        ]);
        assert.deepEqual(res.files, [HELPER]);
    });
    it("a helper path outside widgets/ isn't written", async () => {
        const { tools, seen } = setup();
        await checkHello(tools, {
            files: [{ path: "../../evil.js", content: "x" }],
        });
        assert.deepEqual(seen[0], ["HelloWidget.dash.js", "HelloWidget.js"]);
    });
});

describe("the Checker's verdict comes from its own run", () => {
    it("a PASSED run of the Checker on draft:<Name> is recorded", async () => {
        const { tools } = setup();
        await checkHello(tools);
        const record = await tools.reviewRun(PROMPT, checker("PASSED"));
        assert.equal(record.status, "completed");
        assert.equal(
            tools.check({ name: "draft:HelloWidget" }) instanceof Promise,
            true
        );
        const allowed = tools.installAllowed({
            checkName: "HelloWidget",
            installName: "HelloWidget",
            componentCode: COMPONENT,
            files: [HELPER],
        });
        assert.deepEqual(allowed, { ok: true, reviewSkipped: null });
    });
    it("a review of code that changed during the run doesn't count", async () => {
        const { tools } = setup();
        await checkHello(tools);
        await tools.reviewRun(PROMPT, async () => {
            await checkHello(tools, {
                componentCode: COMPONENT.replace("Hi", "Bye") + "\n// v2",
            });
            return { status: "completed", output: "VERDICT: PASSED" };
        });
        const allowed = tools.installAllowed({
            checkName: "HelloWidget",
            installName: "HelloWidget",
            componentCode: COMPONENT.replace("Hi", "Bye") + "\n// v2",
            files: [HELPER],
        });
        assert.equal(allowed.ok, false);
        assert.match(allowed.error, /The Checker hasn't passed it/);
    });
    it("a run that isn't about a draft isn't recorded, and still returns", async () => {
        const { tools } = setup();
        const record = await tools.reviewRun(
            "Check the dashboard",
            checker("PASSED")
        );
        assert.equal(record.status, "completed");
    });
});

describe("installAllowed — only the exact checked code is installed", () => {
    async function passed() {
        const s = setup();
        await checkHello(s.tools);
        await s.tools.reviewRun(PROMPT, checker("PASSED"));
        return s.tools;
    }
    const ask = (tools, over = {}) =>
        tools.installAllowed({
            checkName: "HelloWidget",
            installName: "HelloWidget",
            componentCode: COMPONENT,
            files: [HELPER],
            ...over,
        });

    it("never checked → refused", () => {
        const { tools } = setup();
        const res = ask(tools);
        assert.equal(res.ok, false);
        assert.match(res.error, /hasn't been checked/);
    });
    it("the code changed after the check → refused", async () => {
        const tools = await passed();
        const res = ask(tools, { componentCode: COMPONENT + "\n// sneaky" });
        assert.equal(res.ok, false);
        assert.match(res.error, /changed after it was checked/);
    });
    it("a helper file changed after the check → refused", async () => {
        const tools = await passed();
        const res = ask(tools, {
            files: [{ ...HELPER, content: "export const label = 1;" }],
        });
        assert.equal(res.ok, false);
        assert.match(res.error, /changed after it was checked/);
    });
    it("a remix's export rename is the only change allowed", async () => {
        const tools = await passed();
        const renamed = COMPONENT.replace(
            "export default function HelloWidget",
            "export default function HelloRemix"
        );
        assert.equal(
            ask(tools, { installName: "HelloRemix", componentCode: renamed })
                .ok,
            true
        );
    });
    it("Update original restoring the real name over ComposedWidget is allowed", async () => {
        const { tools } = setup();
        const composed = COMPONENT.replace(
            "export default function HelloWidget",
            "export default function ComposedWidget"
        );
        await tools.checkDraft({
            widgetName: "HelloWidget",
            componentCode: composed,
            configCode: CONFIG,
            files: [HELPER],
        });
        await tools.reviewRun(PROMPT, checker("PASSED"));
        // The Builder renames the export back to the widget's name.
        assert.equal(ask(tools, { componentCode: COMPONENT }).ok, true);
    });
    it("a review not yet passed says what to do", async () => {
        const { tools } = setup();
        await checkHello(tools);
        assert.match(
            ask(tools).error,
            /wait for its review, or use Check again/
        );
    });
    it("the primary component and config in files[] aren't compared as helpers", async () => {
        const tools = await passed();
        const res = ask(tools, {
            files: [
                HELPER,
                { path: "widgets/HelloWidget.js", content: COMPONENT },
                {
                    path: "widgets/HelloWidget.dash.js",
                    content: "category edited",
                },
            ],
        });
        assert.equal(res.ok, true);
    });
    it("a FAILED verdict → refused", async () => {
        const { tools } = setup();
        await checkHello(tools);
        await tools.reviewRun(PROMPT, checker("FAILED"));
        assert.equal(ask(tools).ok, false);
    });
    it("failing code checks → refused, even with a passing review", async () => {
        const { tools } = setup();
        await tools.checkDraft({
            widgetName: "HelloWidget",
            componentCode: COMPONENT.replace("<Panel>", "<Modal>").replace(
                "</Panel>",
                "</Modal>"
            ),
            configCode: CONFIG,
            files: [HELPER],
        });
        await tools.reviewRun(PROMPT, checker("PASSED"));
        const res = ask(tools, {
            componentCode: COMPONENT.replace("<Panel>", "<Modal>").replace(
                "</Panel>",
                "</Modal>"
            ),
        });
        assert.equal(res.ok, false);
        assert.match(res.error, /didn't pass its checks/);
    });
    it("a paused or missing Checker lets checked code through, saying so", async () => {
        const { tools } = setup();
        await checkHello(tools);
        assert.deepEqual(
            ask(tools, { checkerUnavailable: "the Checker is paused" }),
            {
                ok: true,
                reviewSkipped: "the Checker is paused",
            }
        );
    });
});

describe("installGate — the code checks for every package install", () => {
    function pkg(files) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zz-gate-"));
        fs.mkdirSync(path.join(dir, "widgets"));
        for (const [name, content] of Object.entries(files)) {
            fs.writeFileSync(path.join(dir, "widgets", name), content);
        }
        return dir;
    }
    it("passes a package whose widgets pass", async () => {
        const dir = pkg({
            "HelloWidget.js": COMPONENT,
            "HelloWidget.dash.js": CONFIG,
            "helpers.js": HELPER.content,
        });
        assert.deepEqual(await installGate(dir, { widgetName: "@x/hello" }), {
            ok: true,
            problems: [],
        });
    });
    it("lists each widget's problems by name", async () => {
        const dir = pkg({
            "HelloWidget.js": COMPONENT.replace("<Panel>", "<Modal>").replace(
                "</Panel>",
                "</Modal>"
            ),
            "HelloWidget.dash.js": CONFIG,
        });
        const res = await installGate(dir, { widgetName: "@x/hello" });
        assert.equal(res.ok, false);
        assert.ok(res.problems.length >= 1);
        assert.ok(res.problems.every((p) => p.startsWith("HelloWidget: ")));
    });
    it("a package with no widget sources has nothing to check", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zz-gate-"));
        assert.deepEqual(await installGate(dir, {}), {
            ok: true,
            problems: [],
        });
    });
});

describe("the app wires the gates (electron.js)", () => {
    const main = fs.readFileSync(path.join(__dirname, "electron.js"), "utf8");
    it("registers the install gate with dash-core's registry", () => {
        assert.match(main, /widgetRegistry\.setInstallGate\(installGate\)/);
    });
    it("the Widget Builder's install asks installAllowed first", () => {
        assert.match(
            main,
            /"widget:ai-build"[\s\S]{0,900}teamWidgetTools\(\)\.installAllowed\(/
        );
    });
    it("the Checker's runs are recorded by the main process", () => {
        assert.match(
            main,
            /BOTS_RUN,[\s\S]{0,900}teamWidgetTools\(\)\.reviewRun\(/
        );
    });
    it("drafts can't be installed straight from the drafts list", () => {
        assert.doesNotMatch(main, /"drafts:install"/);
        const preload = fs.readFileSync(
            path.join(__dirname, "preload.js"),
            "utf8"
        );
        assert.doesNotMatch(preload, /drafts:install/);
    });
});

describe("a refused AI-built update keeps the installed widget (aiBuild.cjs)", () => {
    it("doesn't delete the installed folder before the gated install", () => {
        const src = fs.readFileSync(
            path.join(__dirname, "lib", "aiBuild.cjs"),
            "utf8"
        );
        const at = src.indexOf(
            "const scopedName = `@ai-built/${widgetName.toLowerCase()}`;"
        );
        assert.ok(at > -1);
        const install = src.indexOf("registry.installFromLocalPath(", at);
        assert.doesNotMatch(src.slice(at, install), /rmSync/);
    });
});
