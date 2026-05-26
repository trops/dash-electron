/**
 * ipcValidators.test.js — unit tests for the algolia IPC payload
 * validator (Phase 5A, P1 #14). Pins the shape contract at the handler
 * edge so a future schema change can't silently weaken the gate.
 */
"use strict";

const assert = require("node:assert");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { validate, SCHEMAS, check } = require("../public/lib/ipcValidators.cjs");

test("validate: null payload rejected", () => {
    const r = validate(SCHEMAS["algolia-list-indices"], null, "test");
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /payload is required/);
});

test("validate: non-object payload rejected", () => {
    const r = validate(SCHEMAS["algolia-list-indices"], "string", "test");
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /payload must be a plain object/);
});

test("validate: array payload rejected", () => {
    const r = validate(SCHEMAS["algolia-list-indices"], [1, 2], "test");
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /plain object/);
});

test("validate: missing required field rejected", () => {
    const r = validate(
        SCHEMAS["algolia-list-indices"],
        { providerName: "algolia" },
        "ipc"
    );
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /dashboardAppId is required/);
});

test("validate: wrong-type field rejected with field name", () => {
    const r = validate(
        SCHEMAS["algolia-list-indices"],
        { dashboardAppId: 42, providerName: "algolia" },
        "ipc"
    );
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /dashboardAppId/);
});

test("validate: empty string rejected for required string", () => {
    const r = validate(
        SCHEMAS["algolia-list-indices"],
        { dashboardAppId: "", providerName: "algolia" },
        "ipc"
    );
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /dashboardAppId/);
});

test("validate: well-formed payload returns value", () => {
    const payload = { dashboardAppId: "app-1", providerName: "algolia" };
    const r = validate(SCHEMAS["algolia-list-indices"], payload, "ipc");
    assert.strictEqual(r.ok, true);
    assert.deepStrictEqual(r.value, payload);
});

test("validate: indexName rejects path-traversal", () => {
    const r = validate(
        SCHEMAS["algolia-search"],
        {
            dashboardAppId: "app-1",
            providerName: "algolia",
            indexName: "../etc/passwd",
        },
        "ipc"
    );
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /indexName must match/);
});

test("validate: indexName accepts legitimate Algolia names", () => {
    for (const name of [
        "products",
        "products_dev",
        "products.v2",
        "products-v2",
    ]) {
        const r = validate(
            SCHEMAS["algolia-search"],
            {
                dashboardAppId: "a",
                providerName: "p",
                indexName: name,
            },
            "ipc"
        );
        assert.strictEqual(r.ok, true, `should accept ${name}`);
    }
});

test("validate: indexName rejects >64 chars", () => {
    const r = validate(
        SCHEMAS["algolia-search"],
        {
            dashboardAppId: "a",
            providerName: "p",
            indexName: "x".repeat(65),
        },
        "ipc"
    );
    assert.strictEqual(r.ok, false);
});

test("check: providerHash requires 64 hex chars", () => {
    assert.strictEqual(check("providerHash", "abc123").ok, false);
    assert.strictEqual(check("providerHash", "g".repeat(64)).ok, false);
    assert.strictEqual(check("providerHash", "a".repeat(64)).ok, true);
});

test("check: absPath rejects null bytes", () => {
    assert.strictEqual(check("absPath", "/tmp/file\0name").ok, false);
});

test("check: absPath rejects relative paths", () => {
    assert.strictEqual(check("absPath", "relative/path").ok, false);
});

test("check: absPath accepts a real absolute path", () => {
    assert.strictEqual(check("absPath", "/tmp/file").ok, true);
});

test("check: existingDir rejects nonexistent path", () => {
    assert.strictEqual(
        check("existingDir", "/nonexistent/dir/that/should/not/exist").ok,
        false
    );
});

test("check: existingDir rejects a file path", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ipc-test-"));
    const filePath = path.join(tmp, "f.txt");
    fs.writeFileSync(filePath, "x");
    assert.strictEqual(check("existingDir", filePath).ok, false);
    fs.rmSync(tmp, { recursive: true, force: true });
});

test("check: existingDir accepts a real directory", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ipc-test-"));
    assert.strictEqual(check("existingDir", tmp).ok, true);
    fs.rmSync(tmp, { recursive: true, force: true });
});

test("validate: optional field missing is OK", () => {
    const r = validate(
        SCHEMAS["algolia-search"],
        {
            dashboardAppId: "a",
            providerName: "p",
            indexName: "products",
            // query and options omitted
        },
        "ipc"
    );
    assert.strictEqual(r.ok, true);
});

test("SCHEMAS: every algolia handler has a schema", () => {
    const expected = [
        "algolia-list-indices",
        "algolia-partial-update-objects",
        "algolia-create-batch",
        "algolia-browse-objects",
        "algolia-search",
        "algolia-get-settings",
        "algolia-set-settings",
        "algolia-search-rules",
        "algolia-save-rule",
        "algolia-delete-rule",
        "algolia-analytics",
    ];
    for (const channel of expected) {
        assert.ok(SCHEMAS[channel], `missing schema for ${channel}`);
    }
});

test("validate: error message includes channel for debuggability", () => {
    const r = validate(SCHEMAS["algolia-list-indices"], {}, "my-channel");
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /\[ipc:my-channel\]/);
});
