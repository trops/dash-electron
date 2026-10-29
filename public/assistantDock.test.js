/**
 * assistantDock.test.js — the right-hand dock: the bot notifications panel.
 * It hosted Create (create-entry CRE-007 AC1, phase 4e-2) until the Create
 * window was retired (lead-workspace release 6c).
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(
    path.join(__dirname, "..", "src", "AssistantDock", "AssistantDock.js"),
    "utf8"
);

describe("AssistantDock — no Create panel (lead-workspace 6c)", () => {
    it("doesn't mount Create or listen for folds", () => {
        assert.doesNotMatch(src, /CreateDockPanel/);
        assert.doesNotMatch(src, /dash:create-fold/);
    });
    it("rail buttons are labelled for screen readers", () => {
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
    it("the rail is Bots only — no Create button (Phase 2a)", () => {
        assert.doesNotMatch(src, /railButton\("create"/);
        assert.match(src, /railButton\(\s*"bots",\s*"robot"/);
        // The one rail button.
        assert.equal(src.split("railButton(").length - 1, 1);
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
    // Lead-workspace release 4: the robot opens the bot notifications.
    it("labels the rail button Bot notifications", () => {
        assert.match(src, /"robot",\s*needs > 0/);
        assert.match(src, /: "Bot notifications"/);
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
