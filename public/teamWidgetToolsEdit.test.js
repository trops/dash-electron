/**
 * teamWidgetToolsEdit.test.js — a change to one widget the user has
 * (consolidation Phase 3): while dash-core's change runs, build_widget is
 * held to that widget — in place it keeps its name and is built inside a
 * copy of its own package, then installed with Update original; as a new
 * widget it gets a new name and is installed as a remix of it. A change's
 * draft installs only from its own preview, and nothing else installs it.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createTeamWidgetTools } = require("./lib/teamWidgetTools.cjs");

const COMPONENT = `import React from "react";
import { Panel, Heading } from "@trops/dash-react";
import { fmt } from "./lib/format";
export default function Inbox({ title = "Inbox" }) {
    return (
        <Panel>
            <Heading title={fmt(title)} />
        </Panel>
    );
}
`;
const CONFIG = `import Inbox from "./Inbox";
export default {
    component: Inbox,
    type: "widget",
    userConfig: { title: { type: "text", defaultValue: "Inbox" } },
};
`;
const OLD_CONFIG = "export default { type: 'widget', userConfig: {} };";

// The user's own package, on disk: the widget and a helper it imports.
function ownPackage() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zz-own-inbox-"));
    fs.mkdirSync(path.join(dir, "widgets", "lib"), { recursive: true });
    fs.writeFileSync(path.join(dir, "widgets", "Inbox.js"), "old");
    fs.writeFileSync(path.join(dir, "widgets", "Inbox.dash.js"), OLD_CONFIG);
    fs.writeFileSync(
        path.join(dir, "widgets", "lib", "format.js"),
        "export const fmt = (s) => s;"
    );
    return dir;
}

function setup() {
    const pkgDir = ownPackage();
    const installed = new Map([
        ["inbox", { name: "inbox", path: pkgDir }],
        ["@ai-built/notes", { name: "@ai-built/notes", path: pkgDir }],
    ]);
    const calls = { build: [], compiled: [] };
    const skillPath = path.join(os.tmpdir(), `skill-edit-${process.pid}.md`);
    fs.writeFileSync(skillPath, "# Widget rules");
    const tools = createTeamWidgetTools({
        getRegistry: () => ({ getWidget: (n) => installed.get(n) || null }),
        readWidgetSources: async ({ widgetName }) =>
            installed.has(widgetName)
                ? {
                      success: true,
                      componentName: "Inbox",
                      componentCode: "old",
                      configCode: OLD_CONFIG,
                      manifest: { author: "jg", version: "1.2.0" },
                  }
                : { success: false, error: "not found" },
        getWindows: () => [],
        skillPath,
        aiBuild: async (msg) => {
            calls.build.push(msg);
            return {
                success: true,
                widgetName:
                    msg.updateOriginal ||
                    `@ai-built/${msg.widgetName.toLowerCase()}`,
            };
        },
        compileWidget: async (dir) => {
            calls.compiled.push(
                fs.existsSync(path.join(dir, "widgets", "lib", "format.js"))
            );
            fs.mkdirSync(path.join(dir, "dist"), { recursive: true });
            fs.writeFileSync(path.join(dir, "dist", "index.cjs.js"), "x");
        },
        getPackagePath: (name) => (installed.get(name) || {}).path || null,
    });
    return { tools, calls };
}

const IN_PLACE = {
    package: "inbox",
    componentName: "Inbox",
    mode: "update",
    aiBuilt: false,
};
const AS_NEW = { ...IN_PLACE, mode: "new" };

async function pass(tools, draft) {
    await tools.reviewRun(`Check ${draft}.`, async () => {
        await tools.check({ name: draft });
        return { status: "completed", output: "VERDICT: PASSED" };
    });
}

describe("a change in place", () => {
    it("keeps the name, builds in a copy of its package, and remembers the old config", async () => {
        const { tools, calls } = setup();
        const res = await tools.build({
            name: "Inbox",
            componentCode: COMPONENT,
            configCode: CONFIG,
            update: true,
            edit: IN_PLACE,
        });
        assert.deepEqual(res, {
            success: true,
            widgetName: "draft:Inbox",
            package: "inbox",
        });
        // The helper it imports was there when it compiled.
        assert.deepEqual(calls.compiled, [true]);
        const checked = await tools.check({ name: "draft:Inbox" });
        assert.equal(checked.previousConfigCode, OLD_CONFIG);
    });

    it("another name is refused — it's this widget or nothing", async () => {
        const { tools } = setup();
        const res = await tools.build({
            name: "SomethingElse",
            componentCode: COMPONENT,
            configCode: CONFIG,
            update: true,
            edit: IN_PLACE,
        });
        assert.equal(res.success, false);
        assert.match(res.error, /goes into Inbox itself/);
    });

    it("installs with Update original on the user's own package", async () => {
        const { tools, calls } = setup();
        await tools.build({
            name: "Inbox",
            componentCode: COMPONENT,
            configCode: CONFIG,
            update: true,
            edit: IN_PLACE,
        });
        await pass(tools, "draft:Inbox");
        const res = await tools.installDraft({
            name: "draft:Inbox",
            edit: IN_PLACE,
        });
        assert.deepEqual(res, { success: true, widgetName: "inbox" });
        assert.equal(calls.build[0].updateOriginal, "inbox");
        assert.equal(calls.build[0].componentCode, COMPONENT);
        assert.equal(calls.build[0].remixMeta, undefined);
    });

    it("an AI-built widget is replaced under its own name (no Update original)", async () => {
        const { tools, calls } = setup();
        const edit = {
            package: "@ai-built/notes",
            componentName: "Notes",
            mode: "update",
            aiBuilt: true,
        };
        await tools.build({
            name: "Notes",
            componentCode: COMPONENT.replace(/Inbox/g, "Notes"),
            configCode: CONFIG.replace(/Inbox/g, "Notes"),
            update: true,
            edit,
        });
        await pass(tools, "draft:Notes");
        const res = await tools.installDraft({ name: "draft:Notes", edit });
        assert.equal(res.success, true);
        assert.equal(calls.build[0].updateOriginal, undefined);
    });
});

describe("a change saved as a new widget", () => {
    it("a new name, built in a copy of the package, installed as its remix", async () => {
        const { tools, calls } = setup();
        const res = await tools.build({
            name: "InboxDates",
            componentCode: COMPONENT.replace(/Inbox\(/, "InboxDates("),
            configCode: CONFIG,
            edit: AS_NEW,
        });
        assert.equal(res.package, "@ai-built/inboxdates");
        assert.deepEqual(calls.compiled, [true]);
        await pass(tools, "draft:InboxDates");
        await tools.installDraft({ name: "draft:InboxDates", edit: AS_NEW });
        assert.deepEqual(calls.build[0].remixMeta, {
            remixedFrom: {
                package: "inbox",
                component: "Inbox",
                author: "jg",
                version: "1.2.0",
            },
        });
        assert.equal(calls.build[0].updateOriginal, undefined);
    });

    it("update: true is refused — the widget itself doesn't change", async () => {
        const { tools } = setup();
        const res = await tools.build({
            name: "InboxDates",
            componentCode: COMPONENT,
            configCode: CONFIG,
            update: true,
            edit: AS_NEW,
        });
        assert.equal(res.success, false);
        assert.match(res.error, /saved as a new widget/);
    });
});

describe("only the change's own preview installs its draft", () => {
    async function changed() {
        const t = setup();
        await t.tools.build({
            name: "Inbox",
            componentCode: COMPONENT,
            configCode: CONFIG,
            update: true,
            edit: IN_PLACE,
        });
        await pass(t.tools, "draft:Inbox");
        return t;
    }

    it("the team's place_widget (no edit) can't install it", async () => {
        const { tools, calls } = await changed();
        const res = await tools.installDraft({ name: "draft:Inbox" });
        assert.equal(res.success, false);
        assert.match(
            res.error,
            /is a change to inbox — it's installed from its preview/
        );
        assert.equal(calls.build.length, 0);
    });

    it("another change — or another mode — can't install it", async () => {
        const { tools, calls } = await changed();
        for (const edit of [AS_NEW, { ...IN_PLACE, package: "other" }]) {
            const res = await tools.installDraft({ name: "draft:Inbox", edit });
            assert.equal(res.success, false);
        }
        assert.equal(calls.build.length, 0);
    });

    it("a change can't install a draft that wasn't built as it", async () => {
        const { tools, calls } = setup();
        await tools.build({
            name: "Hello",
            componentCode: COMPONENT.replace(/Inbox/g, "Hello"),
            configCode: CONFIG.replace(/Inbox/g, "Hello"),
        });
        await pass(tools, "draft:Hello");
        const res = await tools.installDraft({
            name: "draft:Hello",
            edit: IN_PLACE,
        });
        assert.equal(res.success, false);
        assert.match(res.error, /wasn't built as this change/);
        assert.equal(calls.build.length, 0);
    });
});

describe("previewDraft", () => {
    it("hands out the draft's code for the preview's Code tab", async () => {
        const { tools } = setup();
        await tools.build({
            name: "Inbox",
            componentCode: COMPONENT,
            configCode: CONFIG,
            update: true,
            edit: IN_PLACE,
        });
        const res = tools.previewDraft({ name: "draft:Inbox" });
        assert.equal(res.success, true);
        assert.equal(res.componentCode, COMPONENT);
        assert.equal(res.configCode, CONFIG);
    });
});
