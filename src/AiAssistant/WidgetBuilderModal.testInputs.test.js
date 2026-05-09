/**
 * Pins the test-inputs form (slice 17b.9) and the empty-render
 * detector tuning that ships alongside it.
 *
 * The form lets the user type values into the previewed widget's
 * userConfig fields without leaving the modal. The detector tuning
 * eliminates a false-positive where a widget rendering its own
 * EmptyState (e.g. "No Index Selected") was being flagged as
 * empty by an over-eager 700ms one-shot check.
 *
 * Static source-presence test (no JSX/jsdom); reads the modal
 * source as text.
 */
const fs = require("fs");
const path = require("path");

const modalPath = path.join(__dirname, "WidgetBuilderModal.js");
const source = fs.readFileSync(modalPath, "utf8");

describe("WidgetBuilderModal — test-inputs form (slice 17b.9)", () => {
    test("declares previewTestInputs state", () => {
        expect(source).toMatch(
            /\[previewTestInputs,\s*setPreviewTestInputs\]\s*=\s*useState\(\{\}\)/
        );
    });

    test("PreviewTestInputsForm component is defined", () => {
        expect(source).toMatch(/function\s+PreviewTestInputsForm\s*\(/);
    });

    test("test inputs feed into the previewed widget after defaults but before userPrefs", () => {
        // The spread order matters: defaults are seed values from the
        // userConfig schema, test inputs override them, but a saved
        // userPrefs from Edit-with-AI mode wins so editing an
        // existing widget shows the user's actual saved state.
        const componentMount = source.indexOf("<PreviewComponent");
        const componentEnd = source.indexOf("/>", componentMount);
        expect(componentMount).toBeGreaterThan(-1);
        const block = source.slice(componentMount, componentEnd);

        const defaultsPos = block.indexOf("...previewWidgetDefaults");
        const testInputsPos = block.indexOf("...previewTestInputs");
        const userPrefsPos = block.indexOf(
            "...(effectiveEditContext?.userPrefs"
        );

        expect(defaultsPos).toBeGreaterThan(-1);
        expect(testInputsPos).toBeGreaterThan(-1);
        expect(userPrefsPos).toBeGreaterThan(-1);

        // Required precedence: defaults < testInputs < userPrefs.
        expect(defaultsPos).toBeLessThan(testInputsPos);
        expect(testInputsPos).toBeLessThan(userPrefsPos);
    });

    test("test inputs reset when a new config compiles", () => {
        // setPreviewTestInputs({}) must be called inside the
        // compile-success branch so a stale value from a previous
        // widget can't leak into the next one.
        const compileBranch = source.indexOf(
            "Reset the test-inputs form to the new defaults"
        );
        expect(compileBranch).toBeGreaterThan(-1);
        // Within ~600 chars (multi-line comment + indentation) of
        // that anchor we expect the actual reset call.
        const nextChunk = source.slice(compileBranch, compileBranch + 600);
        expect(nextChunk).toMatch(/setPreviewTestInputs\(\{\}\)/);
    });

    test("the rendered form is mounted above the preview wrapper", () => {
        // The form is rendered as a JSX element in the preview pane.
        // We check that <PreviewTestInputsForm appears BEFORE the
        // empty-render banner check (which itself is anchored on
        // `previewLooksEmpty &&`).
        const formMount = source.indexOf("<PreviewTestInputsForm");
        const bannerCheck = source.indexOf("{previewLooksEmpty &&");
        expect(formMount).toBeGreaterThan(-1);
        expect(bannerCheck).toBeGreaterThan(-1);
        expect(formMount).toBeLessThan(bannerCheck);
    });
});

describe("WidgetBuilderModal — empty-render detector tuning (slice 17b.9)", () => {
    test("detector double-checks at 1500ms before tripping", () => {
        // Earlier 700ms one-shot check produced false positives on
        // widgets rendering their own EmptyState. The new detector
        // requires the empty condition to hold across two checks
        // (~3s total) before flipping the banner.
        const detectorComment = source.indexOf("Empty-render detector");
        expect(detectorComment).toBeGreaterThan(-1);
        const block = source.slice(detectorComment, detectorComment + 2200);
        // At least one 1500ms timeout (the new tuning) is present.
        expect(block).toMatch(/setTimeout\([^,]+,\s*1500\)/);
        // Old 700ms one-shot must be gone.
        expect(block).not.toMatch(/setTimeout\([^,]+,\s*700\)/);
    });

    test("detector requires both checks to see the same empty state", () => {
        const detectorComment = source.indexOf("Empty-render detector");
        const block = source.slice(detectorComment, detectorComment + 2200);
        // The double-check pattern: a helper isStillEmpty() called
        // by both the outer and inner setTimeout.
        expect(block).toMatch(/isStillEmpty\s*\(/);
    });
});
