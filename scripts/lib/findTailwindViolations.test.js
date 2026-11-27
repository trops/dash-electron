/**
 * findTailwindViolations.test.js
 *
 * Pin for the pure helper that scans a single file's source for
 * Tailwind utility classes that aren't covered by dash-electron's
 * safelist patterns. The safelist accepts:
 *   - bg/text/border/from/via/to-{color}-{shade}     (with hover: variant)
 *   - opacity-{0-100}, grid-cols-*
 * It does NOT accept opacity modifiers (`bg-white/5`), arbitrary
 * values (`text-[10px]`), or divide/ring/outline color variants.
 *
 * Every violation outside the safelist silently fails to render in
 * dash-electron's prebuilt CSS bundle — a class of bug that's
 * invisible at PR time and only surfaces when someone eyeballs the UI.
 *
 * Run: `node --test scripts/lib/findTailwindViolations.test.js`
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert");

const { findTailwindViolations } = require("./findTailwindViolations");

test("flags opacity-modifier class on a color (bg-white/5)", () => {
    const out = findTailwindViolations(
        `<div className="bg-white/5 p-2">x</div>`
    );
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].class, "bg-white/5");
    assert.strictEqual(out[0].kind, "opacity-modifier");
    assert.strictEqual(out[0].line, 1);
});

test("flags hover: variant of opacity-modifier (hover:bg-white/10)", () => {
    const out = findTailwindViolations(
        `<div className="hover:bg-white/10">x</div>`
    );
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].class, "hover:bg-white/10");
});

test("flags arbitrary-value class (text-[10px])", () => {
    const out = findTailwindViolations(
        `<div className="text-[10px] flex">x</div>`
    );
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].class, "text-[10px]");
    assert.strictEqual(out[0].kind, "arbitrary-value");
});

test("flags divide-{color}-{shade} (off-safelist)", () => {
    const out = findTailwindViolations(
        `<div className="divide-y divide-gray-800">x</div>`
    );
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].class, "divide-gray-800");
    assert.strictEqual(out[0].kind, "off-safelist-utility");
});

test("flags ring color variants (ring-blue-500)", () => {
    const out = findTailwindViolations(
        `<div className="ring-2 ring-blue-500">x</div>`
    );
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].class, "ring-blue-500");
});

test("flags outline color variants (outline-red-500)", () => {
    const out = findTailwindViolations(
        `<div className="outline-2 outline-red-500">x</div>`
    );
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].class, "outline-red-500");
});

test("does not flag standard color-shade classes (bg-gray-800)", () => {
    const out = findTailwindViolations(
        `<div className="bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700">x</div>`
    );
    assert.deepStrictEqual(out, []);
});

test("does not flag opacity-{0-100} (different from /N modifier)", () => {
    const out = findTailwindViolations(
        `<div className="opacity-50 opacity-100 hover:opacity-70">x</div>`
    );
    assert.deepStrictEqual(out, []);
});

test("does not flag layout/flex/grid utilities", () => {
    const out = findTailwindViolations(
        `<div className="flex flex-col gap-3 grid grid-cols-3 p-4 m-2 rounded">x</div>`
    );
    assert.deepStrictEqual(out, []);
});

test("tracks correct line numbers for multi-line source", () => {
    const src = [
        `import x from "y";`,
        ``,
        `function C() {`,
        `  return <div className="bg-white/5">x</div>;`,
        `}`,
    ].join("\n");
    const out = findTailwindViolations(src);
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].line, 4);
});

test("scans className with backtick template literals", () => {
    const out = findTailwindViolations(
        "const x = <div className={`bg-white/5 ${other}`}>x</div>;"
    );
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].class, "bg-white/5");
});

test("scans conditional ternaries inside template literals", () => {
    const out = findTailwindViolations(
        'const x = <div className={`${cond ? "bg-white/5" : "bg-gray-800"}`}>x</div>;'
    );
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].class, "bg-white/5");
});

test("multiple violations on multiple lines all reported", () => {
    const src = [
        `<div className="bg-white/5">a</div>`,
        `<div className="text-[10px]">b</div>`,
        `<div className="ring-blue-500">c</div>`,
    ].join("\n");
    const out = findTailwindViolations(src);
    assert.strictEqual(out.length, 3);
    assert.deepStrictEqual(
        out.map((v) => v.line),
        [1, 2, 3]
    );
});

test("ignores non-className strings (just because something looks like a class)", () => {
    // Random URL fragments and prose shouldn't false-positive.
    const out = findTailwindViolations(
        `const url = "https://example.com/path";`
    );
    assert.deepStrictEqual(out, []);
});

test("empty input returns empty array", () => {
    assert.deepStrictEqual(findTailwindViolations(""), []);
    assert.deepStrictEqual(findTailwindViolations(null), []);
    assert.deepStrictEqual(findTailwindViolations(undefined), []);
});
