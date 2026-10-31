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
// The Checker runs check_widget on the draft it reviews; its verdict
// counts only for that draft (Phase 1b).
const checker =
    (verdict, tools, name = "draft:HelloWidget") =>
    async () => {
        if (tools) await tools.check({ name });
        return {
            status: "completed",
            output: `Looks right.\n\nVERDICT: ${verdict}`,
        };
    };
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
        const record = await tools.reviewRun(PROMPT, checker("PASSED", tools));
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
            checker("PASSED", tools)
        );
        assert.equal(record.status, "completed");
    });
});

describe("installAllowed — only the exact checked code is installed", () => {
    async function passed() {
        const s = setup();
        await checkHello(s.tools);
        await s.tools.reviewRun(PROMPT, checker("PASSED", s.tools));
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
        await tools.reviewRun(PROMPT, checker("PASSED", tools));
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
        await tools.reviewRun(PROMPT, checker("FAILED", tools));
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
        await tools.reviewRun(PROMPT, checker("PASSED", tools));
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
        const res = await installGate(dir, { widgetName: "@x/hello" });
        assert.equal(res.ok, true);
        assert.deepEqual(res.problems, []);
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
            warnings: [],
            sourceFiles: 0,
        });
    });
    it("hard-coded colors are warnings, not problems — in widgets and helpers", async () => {
        const dir = pkg({
            "HelloWidget.js": COMPONENT.replace(
                "<Panel>",
                '<Panel className="text-gray-600">'
            ),
            "HelloWidget.dash.js": CONFIG,
            "helpers.js": 'export const tone = "bg-gray-100";\n',
        });
        const res = await installGate(dir, { widgetName: "@x/hello" });
        assert.equal(res.ok, true);
        assert.deepEqual(res.problems, []);
        assert.ok(
            res.warnings.some(
                (w) =>
                    w.startsWith("HelloWidget: ") &&
                    /text-gray-600 is a hard-coded color/.test(w)
            )
        );
        assert.ok(
            res.warnings.some(
                (w) =>
                    w.startsWith("widgets/helpers.js: ") &&
                    /bg-gray-100 is a hard-coded color/.test(w)
            )
        );
    });
    it("colors don't block, but other problems still do", async () => {
        const dir = pkg({
            "HelloWidget.js": COMPONENT.replace(
                "<Panel>",
                '<Modal className="text-gray-600">'
            ).replace("</Panel>", "</Modal>"),
            "HelloWidget.dash.js": CONFIG,
        });
        const res = await installGate(dir, { widgetName: "@x/hello" });
        assert.equal(res.ok, false);
        assert.ok(res.problems.some((p) => /<Modal> isn't allowed/.test(p)));
        assert.ok(!res.problems.some((p) => /hard-coded color/.test(p)));
        assert.equal(res.warnings.length, 1);
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

// Phase 1a-2: every file in the package is checked; helper files in
// subfolders are checked and compared; Update original installs the
// checked helpers; the app builds what it installs; startup checks.
describe("installGate — every widget file, at any depth", () => {
    function pkg(files) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zz-gate-"));
        for (const [rel, content] of Object.entries(files)) {
            const abs = path.join(dir, "widgets", rel);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            fs.writeFileSync(abs, content);
        }
        return dir;
    }
    const MODAL = COMPONENT.replace("<Panel>", "<Modal>").replace(
        "</Panel>",
        "</Modal>"
    );
    it("a widget in a subfolder is checked", async () => {
        const res = await installGate(
            pkg({
                "nested/HelloWidget.js": MODAL,
                "nested/HelloWidget.dash.js": CONFIG,
            })
        );
        assert.equal(res.ok, false);
        assert.ok(res.problems.every((p) => p.startsWith("HelloWidget: ")));
    });
    it("a helper file is checked, named by its path", async () => {
        const res = await installGate(
            pkg({
                "HelloWidget.js": COMPONENT,
                "HelloWidget.dash.js": CONFIG,
                "lib/Popup.js": MODAL,
            })
        );
        assert.equal(res.ok, false);
        assert.ok(res.problems.length >= 1);
        assert.ok(
            res.problems.every((p) => p.startsWith("widgets/lib/Popup.js: "))
        );
    });
    it("tests and stories aren't widget code", async () => {
        const res = await installGate(
            pkg({
                "HelloWidget.js": COMPONENT,
                "HelloWidget.dash.js": CONFIG,
                "HelloWidget.test.js": MODAL,
                "__tests__/x.js": MODAL,
                "HelloWidget.stories.js": MODAL,
            })
        );
        assert.equal(res.ok, true);
        assert.deepEqual(res.problems, []);
    });
});

describe("checkDraft and installAllowed — helper files in subfolders", () => {
    const LIB = {
        path: "widgets/lib/format.js",
        content: "export const f = 1;",
    };
    it("a subfolder helper is written into the package it compiles", async () => {
        const { tools } = setup();
        const res = await checkHello(tools, { files: [HELPER, LIB] });
        assert.equal(res.compile.ok, true);
        assert.deepEqual(res.files, [HELPER, LIB]);
    });
    it("a helper outside widgets/ is written and compared too", async () => {
        const { tools } = setup();
        const UTIL = {
            path: "utils/math.js",
            content: "export const two = 2;",
        };
        const res = await checkHello(tools, { files: [HELPER, UTIL] });
        assert.deepEqual(res.files, [UTIL, HELPER]);
    });
    it("a helper's problems are the draft's problems", async () => {
        const { tools } = setup();
        const res = await checkHello(tools, {
            files: [
                HELPER,
                {
                    path: "widgets/lib/Popup.js",
                    content:
                        'import { Modal } from "@trops/dash-react";\nexport const P = () => <Modal isOpen={true} setIsOpen={() => {}}>x</Modal>;',
                },
            ],
        });
        assert.ok(
            res.problems.some((p) => p.startsWith("widgets/lib/Popup.js: "))
        );
    });
    it("a subfolder helper changed after the check → refused", async () => {
        const { tools } = setup();
        await checkHello(tools, { files: [HELPER, LIB] });
        await tools.reviewRun(PROMPT, checker("PASSED", tools));
        const base = {
            checkName: "HelloWidget",
            installName: "HelloWidget",
            componentCode: COMPONENT,
        };
        assert.equal(
            tools.installAllowed({ ...base, files: [HELPER, LIB] }).ok,
            true
        );
        const res = tools.installAllowed({
            ...base,
            files: [HELPER, { ...LIB, content: "export const f = 2;" }],
        });
        assert.equal(res.ok, false);
        assert.match(res.error, /changed after it was checked/);
    });
});

describe("Update original installs the checked helper files (aiBuild.cjs)", () => {
    const src = fs.readFileSync(
        path.join(__dirname, "lib", "aiBuild.cjs"),
        "utf8"
    );
    const fn = src.slice(
        src.indexOf("async function updateOriginalPackage("),
        src.indexOf("async function aiBuild(")
    );
    it("writes them into the build", () => {
        assert.match(fn, /files,/);
        assert.match(
            fn,
            /writeAiFiles\(\s*buildDir,\s*helperFiles\(files, \[widgetName\], \[componentCode, configCode\]\)/
        );
    });
    it("aiBuild passes files[] to it", () => {
        assert.match(src, /updateOriginalPackage\(\{[\s\S]{0,400}\bfiles,/);
    });
});

describe("the app builds what it installs (aiBuild.cjs)", () => {
    const src = fs.readFileSync(
        path.join(__dirname, "lib", "aiBuild.cjs"),
        "utf8"
    );
    it("its own test build is removed, so the install gate builds the checked code", () => {
        const installs = src.match(
            /fs\.rmSync\(path\.join\(buildDir, "dist"\)[\s\S]{0,1200}?installFromLocalPath\(/g
        );
        assert.equal((installs || []).length, 2);
    });
});

describe("the app checks installed widgets at startup (electron.js)", () => {
    const main = fs.readFileSync(path.join(__dirname, "electron.js"), "utf8");
    it("runs checkInstalled after the gate is set", () => {
        assert.match(
            main,
            /widgetRegistry\.setInstallGate\(installGate\);[\s\S]{0,600}\.checkInstalled\(\)/
        );
    });
    it("an install that skipped the Checker's review says so in the log", () => {
        assert.match(main, /allowed\.reviewSkipped/);
    });
});

// Review fixes (Phase 1a-2): the whole package, not just widgets/.
describe("installGate — the whole package's code", () => {
    function pkgAt(files) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zz-gate-"));
        for (const [rel, content] of Object.entries(files)) {
            const abs = path.join(dir, rel);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            fs.writeFileSync(abs, content);
        }
        return dir;
    }
    const MODAL = COMPONENT.replace("<Panel>", "<Modal>").replace(
        "</Panel>",
        "</Modal>"
    );
    it("shared code beside widgets/ is checked", async () => {
        const res = await installGate(
            pkgAt({
                "widgets/HelloWidget.js": COMPONENT,
                "widgets/HelloWidget.dash.js": CONFIG,
                "utils/Popup.js": MODAL,
            })
        );
        assert.equal(res.ok, false);
        assert.ok(res.problems.every((p) => p.startsWith("utils/Popup.js: ")));
    });
    it("a widget kept under its own folder is checked", async () => {
        const res = await installGate(
            pkgAt({
                "Hello/widgets/HelloWidget.js": MODAL,
                "Hello/widgets/HelloWidget.dash.js": CONFIG,
            })
        );
        assert.equal(res.ok, false);
        assert.ok(res.problems.every((p) => p.startsWith("HelloWidget: ")));
    });
    it("builds, bundles and node_modules aren't source", async () => {
        const res = await installGate(
            pkgAt({
                "widgets/HelloWidget.js": COMPONENT,
                "widgets/HelloWidget.dash.js": CONFIG,
                "dist/index.cjs.js": MODAL,
                "index.js": MODAL,
                "index.cjs.js": MODAL,
                "node_modules/x/index.js": MODAL,
            })
        );
        assert.equal(res.ok, true);
        assert.equal(res.sourceFiles, 1);
    });
    it("a package with only a build has no source to check", async () => {
        const res = await installGate(
            pkgAt({ "dist/index.cjs.js": "module.exports = {};" })
        );
        assert.deepEqual(res, {
            ok: true,
            problems: [],
            warnings: [],
            sourceFiles: 0,
        });
    });
    it("a test or story file a widget imports is checked", async () => {
        const res = await installGate(
            pkgAt({
                "widgets/HelloWidget.js": COMPONENT.replace(
                    'import { label } from "./helpers";',
                    'import { label } from "./helpers";\nimport { Popup } from "./lib/Popup.stories";'
                ),
                "widgets/HelloWidget.dash.js": CONFIG,
                "widgets/lib/Popup.stories.js": MODAL,
                "widgets/lib/Other.test.js": MODAL,
            })
        );
        assert.equal(res.ok, false);
        assert.ok(
            res.problems.every((p) =>
                p.startsWith("widgets/lib/Popup.stories.js: ")
            )
        );
    });
});

describe("packages registered by the startup check reach the screen (electron.js)", () => {
    const main = fs.readFileSync(path.join(__dirname, "electron.js"), "utf8");
    it("each one is announced like an install", () => {
        assert.match(
            main,
            /\.checkInstalled\(\)[\s\S]{0,900}s\.registered[\s\S]{0,400}"widget:installed"/
        );
    });
});
