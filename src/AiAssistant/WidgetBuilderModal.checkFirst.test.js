/**
 * WidgetBuilderModal — checked while it's written, installed only after a
 * pass (Widget Builder edit fixes; replaces the Checker after install,
 * CRE-011 AC5): each compiled version gets the fast checks and then the
 * Checker; problems are listed for the user to fix (consolidation Phase 3b
 * — no AI here); Install / Update waits for a pass of
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
        // Built by hand: no request to hold it to, only the widget.
        expect(src).toMatch(
            /runTeamRole\(\s*"checker",\s*draftCheckRequest\(name, ""\)/
        );
        expect(src).toMatch(/codeKeyOf\(detectedCode\)/);
    });

    test("problems are listed for the user — nothing goes back to an AI", () => {
        expect(src).toMatch(
            /const fail = \(lines, review\) =>\s*setDraftCheck\(\{ key, phase: "failed", lines, review \}\);/
        );
        expect(src).not.toMatch(/checksFixRequest|MAX_CHECK_FIXES/);
        expect(src).not.toMatch(/dash:chat-core-send/);
        expect(src).not.toMatch(/ChatCore/);
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
        expect(src).toMatch(/if \(unchangedUpdate \|\| needsName\) \{/);
    });

    test("built by hand: checked once named, after the code settles, retried while the Checker is busy", () => {
        expect(src).toMatch(
            /const needsName =\s*!isRemixMode && \(!widgetName \|\| \/\^ComposedWidget\\d\*\$\/\.test\(widgetName\)\);/
        );
        expect(src).toMatch(/timer = setTimeout\(start, 1500\);/);
        expect(src).toMatch(
            /\/in progress\/i\.test\(String\(res\.reason \|\| ""\)\)[\s\S]{0,120}if \(!stale\(\)\) retryCheck\(\);/
        );
    });

    test("an unchanged update doesn't count as checked", () => {
        expect(src).toMatch(/const checkPassed =\s*!unchangedUpdate &&/);
        expect(src).not.toMatch(/aiReplying/);
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
