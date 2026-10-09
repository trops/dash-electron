/**
 * widgetConfigType.test.js — AI-built widget configs sometimes leave out
 * `type: "widget"`. The bundle loader only accepts configs whose type is
 * "widget" or "workspace", so the preview failed with "Could not resolve
 * widget component from bundle" (and the installed widget wouldn't load).
 * The main process adds the missing type before compiling.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { ensureWidgetType } = require("./lib/widgetConfigType.cjs");

describe("ensureWidgetType", () => {
    it('adds type: "widget" when the config has no type', () => {
        const src = `export default {\n    name: "Clock",\n    component: "ClockCounter",\n};\n`;
        const out = ensureWidgetType(src);
        assert.equal(out.rewrote, true);
        assert.match(out.source, /export default \{\s*type: "widget",/);
        assert.match(out.source, /component: "ClockCounter"/);
    });

    it("leaves a config that already has a type alone", () => {
        for (const src of [
            `export default { type: "widget", component: "A" };`,
            `export default { component: "A", type: 'workspace' };`,
        ]) {
            const out = ensureWidgetType(src);
            assert.equal(out.rewrote, false);
            assert.equal(out.source, src);
        }
    });

    it("doesn't mistake a nested type (e.g. a provider's) for the widget's", () => {
        const src = `export default {\n    component: "A",\n    providers: [{ type: "algolia", providerClass: "credential" }],\n};`;
        const out = ensureWidgetType(src);
        assert.equal(out.rewrote, true);
        assert.match(out.source, /export default \{\s*type: "widget",/);
    });

    it("handles a config bound to a name first", () => {
        const src = `const config = {\n    component: "A",\n};\nexport default config;`;
        const out = ensureWidgetType(src);
        assert.equal(out.rewrote, true);
        assert.match(out.source, /const config = \{\s*type: "widget",/);
    });

    it("leaves empty or unrecognised sources alone", () => {
        assert.deepEqual(ensureWidgetType(""), { source: "", rewrote: false });
        assert.deepEqual(ensureWidgetType(null), {
            source: null,
            rewrote: false,
        });
        const odd = `module.exports = makeConfig();`;
        assert.deepEqual(ensureWidgetType(odd), {
            source: odd,
            rewrote: false,
        });
    });

    it("is applied in both the preview compile and the install build", () => {
        const main = fs.readFileSync(
            path.join(__dirname, "electron.js"),
            "utf8"
        );
        assert.match(main, /require\("\.\/lib\/widgetConfigType\.cjs"\)/);
        assert.ok((main.match(/ensureWidgetType\(/g) || []).length >= 4);
    });
});
