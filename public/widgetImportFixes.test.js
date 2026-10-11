/**
 * widgetImportFixes.test.js — the build slips AI-built widgets made in real
 * runs (create-entry phase 2d), fixed before compiling so the user never
 * sees them: a config that never exports its object, and a config that
 * imports its component the wrong way for how the component exports it.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
    prepareWidgetConfig,
    ensureConfigDefaultExport,
    fixComponentImport,
    componentExports,
} = require("./lib/widgetImportFixes.cjs");

// The component the AI wrote in the 2026-10-11 runs.
const DEFAULT_COMPONENT = `import React from "react";
export default function TokyoClock({ label = "Tokyo" }) {
    return null;
}
`;
const NAMED_COMPONENT = `import React from "react";
export function TokyoClock() { return null; }
`;

describe("ensureConfigDefaultExport", () => {
    it("exports a config object nobody exported (run 4's error)", () => {
        const src = `import TokyoClock from "./TokyoClock";\n\nconst TokyoClockConfig = {\n    component: TokyoClock,\n    type: "widget",\n};\n`;
        const out = ensureConfigDefaultExport(src);
        assert.equal(out.rewrote, true);
        assert.match(out.source, /export default TokyoClockConfig;\n$/);
    });

    it("handles `export const X = {…}` with no default", () => {
        const out = ensureConfigDefaultExport(
            `export const config = { type: "widget" };\n`
        );
        assert.equal(out.rewrote, true);
        assert.match(out.source, /export default config;/);
    });

    it("leaves a config that already has a default export", () => {
        const src = `export default { type: "widget" };\n`;
        assert.equal(ensureConfigDefaultExport(src).rewrote, false);
    });

    it("leaves it alone when there are two candidate objects", () => {
        const src = `const a = { x: 1 };\nconst b = { y: 2 };\n`;
        assert.equal(ensureConfigDefaultExport(src).rewrote, false);
    });

    it("leaves CommonJS alone", () => {
        const src = `const c = { type: "widget" };\nmodule.exports = c;\n`;
        assert.equal(ensureConfigDefaultExport(src).rewrote, false);
    });
});

describe("componentExports", () => {
    it("reads default and named exports", () => {
        assert.deepEqual(
            {
                ...componentExports(DEFAULT_COMPONENT),
                named: [...componentExports(DEFAULT_COMPONENT).named],
            },
            { hasDefault: true, named: [] }
        );
        assert.deepEqual(
            [...componentExports(NAMED_COMPONENT).named],
            ["TokyoClock"]
        );
        const list = componentExports(
            `function A(){}\nexport { A, A as default };\n`
        );
        assert.equal(list.hasDefault, true);
        assert.ok(list.named.has("A"));
    });
});

describe("fixComponentImport", () => {
    it("named import of a default-exported component → default import (run 3's error)", () => {
        const src = `import { TokyoClock } from "./TokyoClock";\n\nexport default {\n    component: TokyoClock,\n};\n`;
        const out = fixComponentImport(src, DEFAULT_COMPONENT, "TokyoClock");
        assert.equal(out.rewrote, true);
        assert.match(out.source, /^import TokyoClock from "\.\/TokyoClock";/);
    });

    it("default import of a named-only component → named import", () => {
        const src = `import TokyoClock from "./TokyoClock.js";\nexport default { component: TokyoClock };\n`;
        const out = fixComponentImport(src, NAMED_COMPONENT, "TokyoClock");
        assert.equal(out.rewrote, true);
        assert.match(
            out.source,
            /^import \{ TokyoClock \} from "\.\/TokyoClock\.js";/
        );
    });

    it("leaves a matching import alone", () => {
        const src = `import TokyoClock from "./TokyoClock";\nexport default { component: TokyoClock };\n`;
        assert.equal(
            fixComponentImport(src, DEFAULT_COMPONENT, "TokyoClock").rewrote,
            false
        );
    });

    it("only touches imports of the widget's own component file", () => {
        const src = `import { Helper } from "./Helper";\nexport default {};\n`;
        assert.equal(
            fixComponentImport(src, DEFAULT_COMPONENT, "TokyoClock").rewrote,
            false
        );
    });

    it("leaves it when the component exports both ways", () => {
        const both = `export function TokyoClock(){}\nexport default TokyoClock;\n`;
        const src = `import { TokyoClock } from "./TokyoClock";\n`;
        assert.equal(
            fixComponentImport(src, both, "TokyoClock").rewrote,
            false
        );
    });

    it("does nothing without the component source", () => {
        const src = `import { TokyoClock } from "./TokyoClock";\n`;
        assert.equal(
            fixComponentImport(src, null, "TokyoClock").rewrote,
            false
        );
    });
});

describe("prepareWidgetConfig", () => {
    it("fixes the export, the import and the missing type together", () => {
        const src = `import { TokyoClock } from "./TokyoClock";\n\nconst TokyoClockConfig = {\n    component: TokyoClock,\n};\n`;
        const out = prepareWidgetConfig(src, {
            componentSource: DEFAULT_COMPONENT,
            componentName: "TokyoClock",
        });
        assert.deepEqual(out.fixes, [
            "added export default",
            "matched the component import to its export",
            'added type: "widget"',
        ]);
        assert.match(out.source, /^import TokyoClock from "\.\/TokyoClock";/);
        assert.match(out.source, /type: "widget"/);
        assert.match(out.source, /export default TokyoClockConfig;/);
    });

    it("a correct config passes through unchanged", () => {
        const src = `import TokyoClock from "./TokyoClock";\n\nexport default {\n    type: "widget",\n    component: TokyoClock,\n};\n`;
        const out = prepareWidgetConfig(src, {
            componentSource: DEFAULT_COMPONENT,
            componentName: "TokyoClock",
        });
        assert.deepEqual(out.fixes, []);
        assert.equal(out.source, src);
    });
});
