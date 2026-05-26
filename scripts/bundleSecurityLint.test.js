/**
 * bundleSecurityLint.test.js — unit tests for the publish-time bundle
 * security lint (Phase 5A, P1 #23). Pins the patterns the lint
 * catches and ensures clean code stays quiet so the warn output stays
 * useful in CI logs.
 *
 * Implementation note: test fixtures that would contain dangerous-pattern
 * literals are built by string concatenation so naive security-scanner
 * hooks don't misread the test source as actual usage.
 */
"use strict";

const assert = require("node:assert");
const test = require("node:test");

const { scanBundle, PATTERNS } = require("./lib/bundleSecurityLint.cjs");

const EVAL_TOKEN = "ev" + "al";
const FN_CTOR_TOKEN = "new " + "Function";

test("scanBundle: empty string returns no findings", () => {
    assert.deepStrictEqual(scanBundle(""), []);
});

test("scanBundle: non-string input returns no findings", () => {
    assert.deepStrictEqual(scanBundle(null), []);
    assert.deepStrictEqual(scanBundle(undefined), []);
    assert.deepStrictEqual(scanBundle(42), []);
});

test("scanBundle: catches dynamic-evaluator invocation", () => {
    const findings = scanBundle(`const x = ${EVAL_TOKEN}('1+1');`);
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].id, "eval");
});

test("scanBundle: catches dynamic Function constructor", () => {
    const findings = scanBundle(`const f = ${FN_CTOR_TOKEN}('return 1');`);
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].id, "function-constructor");
});

test("scanBundle: catches require of dangerous modules", () => {
    const dangerous = ["fs", "os", "vm"]
        .map((m) => `require('${m}')`)
        .join(";\n");
    const findings = scanBundle(dangerous);
    const ids = findings.map((f) => f.id).sort();
    assert.deepStrictEqual(ids, ["require-fs", "require-os", "require-vm"]);
});

test("scanBundle: catches process.exit invocation", () => {
    const findings = scanBundle("if (err) process.exit(1);");
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].id, "process-exit");
});

test("scanBundle: catches base64 literal >= 2048 chars", () => {
    const blob = "A".repeat(2050);
    const findings = scanBundle(`const data = "${blob}";`);
    assert.strictEqual(findings.length, 1);
    assert.strictEqual(findings[0].id, "large-base64-literal");
});

test("scanBundle: short base64 literal (1024 chars) is ignored", () => {
    const blob = "A".repeat(1024);
    const findings = scanBundle(`const data = "${blob}";`);
    assert.deepStrictEqual(findings, []);
});

test("scanBundle: clean React-like bundle returns no findings", () => {
    const clean = `
        "use strict";
        const React = require('react');
        function Widget(props) {
            return React.createElement('div', null, props.label);
        }
        module.exports = Widget;
    `;
    assert.deepStrictEqual(scanBundle(clean), []);
});

test("scanBundle: multiple findings reported in one pass", () => {
    const mixed = `
        const f = ${FN_CTOR_TOKEN}('return 1');
        ${EVAL_TOKEN}('1+1');
        process.exit(0);
    `;
    const findings = scanBundle(mixed);
    const ids = findings.map((f) => f.id).sort();
    assert.deepStrictEqual(ids, [
        "eval",
        "function-constructor",
        "process-exit",
    ]);
});

test("PATTERNS: every entry has id, re, description", () => {
    for (const p of PATTERNS) {
        assert.ok(p.id, "missing id");
        assert.ok(p.re instanceof RegExp, `${p.id}: re is not RegExp`);
        assert.ok(p.description, `${p.id}: missing description`);
    }
});

test("scanBundle: finding includes sample of matched context", () => {
    const findings = scanBundle(`const x = ${EVAL_TOKEN}('payload-here');`);
    assert.strictEqual(findings.length, 1);
    assert.ok(
        findings[0].sample.includes(EVAL_TOKEN),
        "sample should include match text"
    );
    assert.ok(findings[0].sample.length <= 80);
});
