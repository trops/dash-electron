/**
 * assistantDock.test.js — the right-hand dock hosts Create (create-entry
 * CRE-007 AC1, phase 4e-2): a third rail button, one always-mounted
 * CreateDockPanel, and a fold from the Create modal opens it.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(
    path.join(__dirname, "..", "src", "AssistantDock", "AssistantDock.js"),
    "utf8"
);

describe("AssistantDock — Create (4e-2)", () => {
    it("renders dash-core's CreateDockPanel, always mounted, collapsed unless open", () => {
        assert.match(
            src,
            /import \{ CreateDockPanel \} from "@trops\/dash-core";/
        );
        assert.match(
            src,
            /<CreateDockPanel\s+collapsed=\{open !== "create"\}\s+onCollapse=\{\(\) => setOpen\(null\)\}/
        );
        assert.equal(src.split("<CreateDockPanel").length, 2);
    });
    it("a fold opens the Create panel", () => {
        assert.match(
            src,
            /window\.addEventListener\("dash:create-fold", onFold\)/
        );
        assert.match(src, /const onFold = \(\) => setOpen\("create"\);/);
    });
    it("rail buttons are labelled for screen readers", () => {
        assert.match(src, /\{railButton\("create", "plus", "Create"\)\}/);
        assert.match(src, /aria-label=\{label\}/);
        assert.match(src, /aria-pressed=\{open === which\}/);
    });
});
