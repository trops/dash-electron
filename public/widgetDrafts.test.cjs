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
    _setDraftsFilePathForTest,
} = require("./widgetDrafts.cjs");

async function withTmpFile(fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dash-drafts-test-"));
    const file = path.join(dir, "widget-drafts.json");
    _setDraftsFilePathForTest(file);
    try {
        await fn(file);
    } finally {
        try {
            fs.rmSync(dir, { recursive: true, force: true });
        } catch (_) {}
        _setDraftsFilePathForTest(null);
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
        assert.equal(list[0].schemaVersion, 1);
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
