/**
 * WidgetBuilderModal — drafts only when the user asks (Widget Builder edit
 * fixes): no automatic drafts; Save as draft for new widgets and edits
 * (an edit's draft remembers what it edits); leaving with unsaved work asks
 * Save as draft / Discard / Keep editing — the builder's own Close, and
 * Create's Back and Close through setLeaveGuard.
 */
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(
    path.join(__dirname, "WidgetBuilderModal.js"),
    "utf8"
);

describe("no automatic drafts", () => {
    test("drafts are saved by saveDraft, not an effect on every AI reply", () => {
        expect(src).not.toMatch(/Auto-save the in-flight widget whenever/);
        expect(src).toMatch(/const saveDraft = useCallback\(/);
    });
});

describe("Save as draft", () => {
    test("offered for new widgets and edits alike", () => {
        expect(src).toMatch(/data-testid="builder-save-draft"/);
        expect(src).toMatch(/title="Save as draft"/);
        expect(src).not.toMatch(
            /detectedCode\.componentCode &&\s+!effectiveEditContext &&\s+draftSessionIdRef\.current &&/
        );
    });

    test("an edit's draft remembers what it edits, and resuming it edits that widget again", () => {
        expect(src).toMatch(/editOf: effectiveEditContext/);
        expect(src).toMatch(/if \(full\.editOf\)/);
        expect(src).toMatch(/setEditContextOverride\(\{/);
    });
});

describe("leaving with unsaved work asks first", () => {
    test("the prompt (UnsavedWorkPrompt) answers save / discard / keep", () => {
        expect(src).toMatch(/<UnsavedWorkPrompt/);
        expect(src).toMatch(/onAnswer=\{answerLeave\}/);
        expect(src).not.toMatch(/<ConfirmationModal/);
    });

    test("the builder's Close and Create's Back / Close go through it", () => {
        expect(src).toMatch(/onClick=\{requestClose\}/);
        expect(src).toMatch(/setLeaveGuard\(/);
        expect(src).toMatch(/const hasUnsavedWork =/);
    });

    test("the builder window's own dismissal (outside click, Escape) asks too, and waits while the prompt is up", () => {
        expect(src).toMatch(/const dismissFrame = useCallback\(/);
        expect(src).toMatch(/setIsOpen: dismissFrame,/);
        expect(src).toMatch(/if \(leavePromptRef\.current\) return;/);
        // Create's guard says not now while the prompt is up.
        expect(src).toMatch(/leavePromptRef\.current\s*\?\s*false/);
    });
});
