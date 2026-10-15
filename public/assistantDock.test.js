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
        // dash-react ButtonIcon2: ariaLabel → aria-label, ariaPressed →
        // aria-pressed.
        assert.match(src, /<ButtonIcon2[\s\S]*?ariaLabel=\{label\}/);
        assert.match(src, /ariaPressed=\{open === which\}/);
    });
    it("the open panel's rail button is shown selected (guide rule 13)", () => {
        assert.match(src, /selected=\{open === which\}/);
        // No opacity-modifier hover classes on the rail.
        assert.doesNotMatch(src, /hover:bg-white\/10/);
    });
});

describe("AssistantDock — the AI Assistant panel is retired (create-entry 5e-2c)", () => {
    it("has no wand button and doesn't mount the Assistant", () => {
        assert.doesNotMatch(src, /AiAssistantPanel/);
        assert.doesNotMatch(src, /wand-magic-sparkles/);
        assert.doesNotMatch(src, /"AI Assistant"/);
    });
    it("the rail is Create, then Bot Activity", () => {
        const create = src.indexOf('railButton("create"');
        const bots = src.indexOf('"bots",\n                    "robot"');
        assert.ok(create > 0 && bots > create);
        assert.equal(src.split("railButton(").length - 1, 2); // the two rail buttons
    });
    it("the panel file is gone", () => {
        assert.equal(
            fs.existsSync(
                path.join(
                    __dirname,
                    "..",
                    "src",
                    "AiAssistant",
                    "AiAssistantPanel.js"
                )
            ),
            false
        );
    });
});

describe("AssistantDock — the robot panel is called Bots (TEAM-015)", () => {
    it("labels the rail button Bots", () => {
        assert.match(src, /"robot",\s*"Bots",/);
        assert.doesNotMatch(src, /"Bot Activity"/);
    });
});

describe("AssistantDock — a clicked bot notification opens the bot (US-018 AC5)", () => {
    it("takes the open request on mount and when told, opening the Bots panel", () => {
        assert.match(src, /const req = await b\.takeOpenRequest\(\);/);
        assert.match(
            src,
            /if \(req\) \{\s+setOpen\("bots"\);\s+setOpenRequest\(\{ botId: req\.botId \|\| null \}\);/
        );
        assert.match(src, /b\.onOpenRequest\(take\)/);
    });
    it("hands the request to the Bots panel", () => {
        assert.match(src, /openRequest=\{openRequest\}/);
    });
});
