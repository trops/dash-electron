/**
 * Storage contract for widget-drafts.json.
 *
 * The drafts module is pure I/O — no electron, no IPC. Tests run
 * via node:test against a tmpdir so they don't touch the user's
 * real Application Support directory.
 *
 * Contracts pinned here:
 *   - listDrafts() on a missing file returns [] (no throw)
 *   - listDrafts() on a corrupt file returns [] (no throw, file is
 *     left in place — caller decides what to do)
 *   - saveDraft() with a new id appends; with an existing id updates
 *     in-place and bumps updatedAt
 *   - deleteDraft() removes by id; deleting a missing id is a no-op
 *   - Atomicity: writes go through a tmp-file + rename so a crash
 *     mid-write can't leave a half-truncated drafts.json
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
    listDrafts,
    saveDraft,
    deleteDraft,
    getDraft,
    materializePackageDir,
    readPackageDirCode,
    promoteDraftPackage,
    getDraftPackageDir,
    _setDraftsFilePathForTest,
    _setWidgetsCacheDirForTest,
} = require("./widgetDrafts.cjs");

async function withTmpFile(fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dash-drafts-test-"));
    const file = path.join(dir, "widget-drafts.json");
    const widgetsDir = path.join(dir, "widgets");
    fs.mkdirSync(widgetsDir, { recursive: true });
    _setDraftsFilePathForTest(file);
    _setWidgetsCacheDirForTest(widgetsDir);
    try {
        await fn(file, widgetsDir);
    } finally {
        try {
            fs.rmSync(dir, { recursive: true, force: true });
        } catch (_) {}
        _setDraftsFilePathForTest(null);
        _setWidgetsCacheDirForTest(null);
    }
}

test("listDrafts returns [] when the file doesn't exist", async () => {
    await withTmpFile(() => {
        assert.deepEqual(listDrafts(), []);
    });
});

test("listDrafts returns [] when the file is corrupt JSON", async () => {
    await withTmpFile((file) => {
        fs.writeFileSync(file, "{ not valid json", "utf8");
        assert.deepEqual(listDrafts(), []);
    });
});

test("saveDraft creates the file and lists the new draft", async () => {
    await withTmpFile((file) => {
        const draft = {
            id: "draft-1",
            name: "My Widget",
            componentCode: "// jsx",
            configCode: "// dash",
            chatHistory: [],
            pickedProvider: null,
            editMode: null,
        };
        saveDraft(draft);
        assert.ok(fs.existsSync(file));
        const list = listDrafts();
        assert.equal(list.length, 1);
        assert.equal(list[0].id, "draft-1");
        assert.equal(list[0].name, "My Widget");
        assert.equal(typeof list[0].createdAt, "number");
        assert.equal(typeof list[0].updatedAt, "number");
        assert.equal(list[0].schemaVersion, 2);
    });
});

test("saveDraft with existing id updates in-place and bumps updatedAt", async () => {
    await withTmpFile(async () => {
        saveDraft({
            id: "draft-1",
            name: "Original",
            componentCode: "v1",
            configCode: "",
            chatHistory: [],
        });
        const before = listDrafts()[0];
        // Wait long enough that Date.now() ticks (1ms granularity).
        await new Promise((r) => setTimeout(r, 5));
        saveDraft({
            id: "draft-1",
            name: "Renamed",
            componentCode: "v2",
            configCode: "",
            chatHistory: [],
        });
        const list = listDrafts();
        assert.equal(list.length, 1, "no duplicate row created");
        assert.equal(list[0].id, "draft-1");
        assert.equal(list[0].name, "Renamed");
        assert.equal(list[0].componentCode, "v2");
        assert.equal(
            list[0].createdAt,
            before.createdAt,
            "createdAt preserved"
        );
        assert.ok(list[0].updatedAt > before.updatedAt, "updatedAt bumped");
    });
});

test("getDraft returns the row by id, null when missing", async () => {
    await withTmpFile(() => {
        saveDraft({
            id: "draft-1",
            name: "A",
            componentCode: "",
            configCode: "",
            chatHistory: [],
        });
        const got = getDraft("draft-1");
        assert.equal(got.id, "draft-1");
        assert.equal(getDraft("nope"), null);
    });
});

test("deleteDraft removes the row by id", async () => {
    await withTmpFile(() => {
        saveDraft({
            id: "a",
            name: "A",
            componentCode: "",
            configCode: "",
            chatHistory: [],
        });
        saveDraft({
            id: "b",
            name: "B",
            componentCode: "",
            configCode: "",
            chatHistory: [],
        });
        deleteDraft("a");
        const list = listDrafts();
        assert.equal(list.length, 1);
        assert.equal(list[0].id, "b");
    });
});

test("deleteDraft is a no-op for a missing id", async () => {
    await withTmpFile(() => {
        saveDraft({
            id: "a",
            name: "A",
            componentCode: "",
            configCode: "",
            chatHistory: [],
        });
        deleteDraft("not-here"); // must not throw
        assert.equal(listDrafts().length, 1);
    });
});

test("save uses tmp-file + rename so partial writes don't corrupt the file", async () => {
    await withTmpFile((file) => {
        saveDraft({
            id: "a",
            name: "A",
            componentCode: "",
            configCode: "",
            chatHistory: [],
        });
        // After the save, the only files in the dir should be the
        // canonical drafts.json — no leftover .tmp file means the
        // rename completed (or cleanup ran).
        const dir = path.dirname(file);
        const stragglers = fs
            .readdirSync(dir)
            .filter((f) => f.endsWith(".tmp"));
        assert.equal(stragglers.length, 0);
    });
});

test("listDrafts sorts by updatedAt descending (newest first)", async () => {
    await withTmpFile(async () => {
        saveDraft({
            id: "old",
            name: "Old",
            componentCode: "",
            configCode: "",
            chatHistory: [],
        });
        await new Promise((r) => setTimeout(r, 5));
        saveDraft({
            id: "new",
            name: "New",
            componentCode: "",
            configCode: "",
            chatHistory: [],
        });
        const list = listDrafts();
        assert.equal(list[0].id, "new");
        assert.equal(list[1].id, "old");
    });
});

test("getDraftPackageDir builds <name>-draft-<short-id> under @ai-built/", async () => {
    await withTmpFile(() => {
        const dir = getDraftPackageDir("draft-abc12345xyz", "MyWidget");
        assert.match(dir, /@ai-built\/mywidget-draft-abc12345$/);
    });
});

test("materializePackageDir writes files under the draft package dir", async () => {
    await withTmpFile((_, widgetsDir) => {
        const pkg = materializePackageDir("draft-abc12345", "MyWidget", [
            {
                path: "widgets/MyWidget.js",
                content: "export default () => null",
            },
            {
                path: "widgets/MyWidget.dash.js",
                content: 'export default { name: "MyWidget" }',
            },
        ]);
        assert.ok(pkg.startsWith(widgetsDir));
        assert.ok(fs.existsSync(path.join(pkg, "widgets/MyWidget.js")));
        assert.ok(fs.existsSync(path.join(pkg, "widgets/MyWidget.dash.js")));
    });
});

test("materializePackageDir rejects path traversal (.. segments)", async () => {
    await withTmpFile((_, widgetsDir) => {
        const pkg = materializePackageDir("draft-bad12345", "EvilWidget", [
            { path: "../escape.js", content: "should not write" },
            { path: "widgets/EvilWidget.js", content: "ok" },
        ]);
        assert.ok(!fs.existsSync(path.join(widgetsDir, "escape.js")));
        assert.ok(fs.existsSync(path.join(pkg, "widgets/EvilWidget.js")));
    });
});

test("readPackageDirCode reads componentCode + configCode + files back", async () => {
    await withTmpFile(() => {
        const pkg = materializePackageDir("draft-r1", "ReadMe", [
            { path: "widgets/ReadMe.js", content: "comp" },
            { path: "widgets/ReadMe.dash.js", content: "cfg" },
            { path: "widgets/utils/helper.js", content: "util" },
        ]);
        const code = readPackageDirCode(pkg, "ReadMe");
        assert.equal(code.componentCode, "comp");
        assert.equal(code.configCode, "cfg");
        assert.equal(code.files.length, 3);
        const helperFile = code.files.find(
            (f) => f.path === "widgets/utils/helper.js"
        );
        assert.equal(helperFile.content, "util");
    });
});

test("readPackageDirCode returns nulls for a missing dir", async () => {
    await withTmpFile(() => {
        const code = readPackageDirCode("/no/such/dir", "X");
        assert.equal(code.componentCode, null);
        assert.equal(code.configCode, null);
        assert.deepEqual(code.files, []);
    });
});

test("promoteDraftPackage renames <name>-draft-<id> to <name>", async () => {
    await withTmpFile((_, widgetsDir) => {
        const pkg = materializePackageDir("draft-promote1", "Promoted", [
            { path: "widgets/Promoted.js", content: "ok" },
        ]);
        const installed = promoteDraftPackage(pkg, "Promoted");
        assert.equal(installed, path.join(widgetsDir, "@ai-built", "promoted"));
        assert.ok(fs.existsSync(path.join(installed, "widgets/Promoted.js")));
        // Source dir gone after the rename.
        assert.ok(!fs.existsSync(pkg));
    });
});

test("promoteDraftPackage overwrites an existing installed dir", async () => {
    await withTmpFile((_, widgetsDir) => {
        // Pre-existing installed widget at the canonical path.
        const installedDir = path.join(widgetsDir, "@ai-built", "twin");
        fs.mkdirSync(installedDir, { recursive: true });
        fs.writeFileSync(path.join(installedDir, "stale.txt"), "old");

        const pkg = materializePackageDir("draft-promote2", "Twin", [
            { path: "widgets/Twin.js", content: "fresh" },
        ]);
        const finalDir = promoteDraftPackage(pkg, "Twin");
        assert.equal(finalDir, installedDir);
        assert.ok(!fs.existsSync(path.join(installedDir, "stale.txt")));
        assert.ok(fs.existsSync(path.join(installedDir, "widgets/Twin.js")));
    });
});

test("deleteDraft removes the package dir along with the metadata", async () => {
    await withTmpFile((_, widgetsDir) => {
        const pkg = materializePackageDir("draft-del1", "ToDelete", [
            { path: "widgets/ToDelete.js", content: "x" },
        ]);
        saveDraft({
            id: "draft-del1",
            name: "ToDelete",
            packageDir: pkg,
            componentName: "ToDelete",
            mode: "ai",
            chatHistory: [],
        });
        assert.ok(fs.existsSync(pkg));
        deleteDraft("draft-del1");
        assert.equal(listDrafts().length, 0);
        assert.ok(!fs.existsSync(pkg));
        // The @ai-built parent dir may or may not exist; we only care
        // that this draft's specific dir is gone.
        void widgetsDir;
    });
});
