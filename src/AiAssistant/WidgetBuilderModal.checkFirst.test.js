/**
 * WidgetBuilderModal — checked while it's written, installed only after a
 * pass (Widget Builder edit fixes; replaces the Checker after install,
 * CRE-011 AC5): each compiled version gets the fast checks and then the
 * Checker; problems go back to the AI; Install / Update waits for a pass of
 * the exact code; the success screen has nothing left running.
 */
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(
    path.join(__dirname, "WidgetBuilderModal.js"),
    "utf8"
);

describe("checks run as the code is written", () => {
    test("each compiled version is checked inside its package, then by the Checker", () => {
        expect(src).toMatch(
            /window\.mainApi\?\.widgetBuilder\?\.checkDraft\?\.\(/
        );
        expect(src).toMatch(
            /runTeamRole\(\s*"checker",\s*draftCheckRequest\(name, asked\)/
        );
        expect(src).toMatch(/codeKeyOf\(detectedCode\)/);
    });

    test("problems go back to the AI, at most MAX_CHECK_FIXES times", () => {
        expect(src).toMatch(/checksFixRequest\(/);
        expect(src).toMatch(/MAX_CHECK_FIXES/);
    });
});

describe("install only after a pass", () => {
    test("Install / Update is disabled until this exact code passed", () => {
        expect(src).toMatch(/const checkPassed =/);
        expect(src).toMatch(/if \(!checkPassed\) return;/);
        expect(src).toMatch(/!checkPassed \|\|/);
        expect(src).toMatch(/<ChecksStatus/);
    });

    test("no Checker after the install — the success screen has nothing running", () => {
        expect(src).not.toMatch(/startTeamCheck/);
        expect(src).not.toMatch(/<CheckerCard/);
    });

    test("an unchanged widget isn't checked under Update original — nothing to save yet", () => {
        expect(src).toMatch(/const unchangedUpdate =/);
        expect(src).toMatch(/if \(unchangedUpdate \|\| aiReplying\) \{/);
    });

    test("nothing counts as checked while the AI is replying, or for an unchanged update", () => {
        expect(src).toMatch(
            /const \[aiReplying, setAiReplying\] = useState\(false\);/
        );
        expect(src).toMatch(/!aiReplying &&\s*!unchangedUpdate &&/);
        expect(src).toMatch(/if \(unchangedUpdate \|\| aiReplying\) \{/);
        expect(src).toMatch(/waiting=\{\s*aiReplying\s*\}/);
    });
    test("no checks until it's known whether this is an update or a remix", () => {
        expect(src).toMatch(/if \(isRemixMode && !editModeSettled\) return;/);
        expect(src).toMatch(/setEditModeSettled\(true\);/);
        // A check that no longer applies is dropped.
        expect(src).toMatch(
            /checkRunRef\.current \+= 1;\s*if \(draftCheckRef\.current\) setDraftCheck\(null\);/
        );
    });
});

// Install gate (consolidation Phase 1a): nothing counts as checked unless
// the checks ran; the main process re-checks the install against them.
describe("no pass without a check", () => {
    test("checks that aren't available, or a Checker that couldn't run, fail — with Check again", () => {
        expect(src).not.toMatch(
            /reviewSkipped: \"the checks aren't available here\"/
        );
        expect(src).not.toMatch(/reviewSkipped: \`the Checker couldn't run/);
        expect(src).toMatch(/canRetry: true/);
        expect(src).toMatch(/onRetry=\{\s*retryCheck\s*\}/);
    });
    test("only a paused or missing Checker skips the review", () => {
        expect(src).toMatch(
            /res\.skipped && \(!res\.bot \|\| res\.bot\.paused\)/
        );
    });
    test("the helper files are checked, and the install names what was checked", () => {
        expect(src).toMatch(
            /checkDraft\?\.\(\{[\s\S]{0,500}files: code\.files/
        );
        expect(src).toMatch(
            /aiBuild\([\s\S]{0,1600}checked under[\s\S]{0,160}checkName\s*\);/
        );
    });
});
