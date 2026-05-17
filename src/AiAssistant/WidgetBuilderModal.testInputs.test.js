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
        //
        // Slice 17c.7 — the inline `<PreviewComponent>` mount was
        // removed; props now flow through the `<PreviewIframe>`
        // mount's `props={{ ... }}` attribute.
        // Skip the explanatory comment at line ~1527 that also
        // contains "<PreviewIframe " — anchor on the JSX mount by
        // requiring a newline immediately after the tag name (the
        // comment writes the whole tag inline on one line).
        const iframeMount = source.search(/<PreviewIframe\s*\n/);
        const iframeEnd = source.indexOf("/>", iframeMount);
        expect(iframeMount).toBeGreaterThan(-1);
        const block = source.slice(iframeMount, iframeEnd);

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

    test("test inputs preserve keys still in the new userConfig schema on recompile", () => {
        // Recompile fires on every grid edit and every streamed AI
        // keystroke. A blanket setPreviewTestInputs({}) wiped values
        // the user had typed into unrelated fields (editing a Heading
        // shouldn't clear the `indexName` they typed for the
        // SearchInput's Algolia wire).
        //
        // The success branch must use an updater that keeps entries
        // whose key still exists in the new userConfig schema and drops
        // only keys the schema no longer has.
        const anchor = source.indexOf(
            "Preserve typed test-input values whose key still"
        );
        expect(anchor).toBeGreaterThan(-1);
        const nextChunk = source.slice(anchor, anchor + 1500);
        // Updater form, not a blanket reset.
        expect(nextChunk).toMatch(/setPreviewTestInputs\(\(prev\)\s*=>/);
        // Iterates the previous keys.
        expect(nextChunk).toMatch(/Object\.keys\(prev\b/);
        // Filters by membership in the new userConfig. Use [\s\S]*?
        // to allow prettier to break the call across lines without
        // breaking the test.
        expect(nextChunk).toMatch(
            /hasOwnProperty\.call\([\s\S]*?userConfig[\s\S]*?key[\s\S]*?\)/
        );
        // The blanket reset must NOT live inside the success branch
        // — it survives in the fallback branch (unparseable widget)
        // and as the explicit Reset button below the form.
        const successBranchStart = source.indexOf(
            'match && typeof match.config.component === "function"'
        );
        const successBranchEnd = source.indexOf("} else {", successBranchStart);
        expect(successBranchStart).toBeGreaterThan(-1);
        expect(successBranchEnd).toBeGreaterThan(successBranchStart);
        const successBranch = source.slice(
            successBranchStart,
            successBranchEnd
        );
        expect(successBranch).not.toMatch(/setPreviewTestInputs\(\{\}\)/);
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

describe("widget-preview-shell — empty-render detector timing (slice 17b.9 + 17c.5)", () => {
    // Slice 17c.7 — the inline empty-render detector that read
    // previewWrapperRef.current.textContent has been removed from
    // WidgetBuilderModal.js. The same double-check timing now lives
    // in the iframe shell; the host receives the result via
    // `bridge:render-stats`. These tests pin the shell's timing.
    const shellPath = path.join(
        __dirname,
        "..",
        "..",
        "public",
        "widget-preview-shell.js"
    );
    const shellSource = fs.readFileSync(shellPath, "utf8");

    test("shell schedules render-stats checks at 1500ms and 3000ms", () => {
        // Both timing values must appear in the schedule helper —
        // any earlier check fires before React commits text content
        // and produces false-positive empty banners.
        expect(shellSource).toMatch(
            /setTimeout\(\s*measureAndPostStats\s*,\s*1500\s*\)/
        );
        expect(shellSource).toMatch(
            /setTimeout\(\s*measureAndPostStats\s*,\s*3000\s*\)/
        );
    });

    test("shell measures text length + child count of the rendered widget", () => {
        // The measurement must return both fields the host's
        // handleIframeRenderStats threshold reads. (textLength === 0
        // && childCount <= 1 → looksEmpty.)
        expect(shellSource).toMatch(/textLength\s*:\s*[a-zA-Z]/);
        expect(shellSource).toMatch(/childCount\s*:\s*[a-zA-Z]/);
    });

    test("host's handleIframeRenderStats applies the detector threshold", () => {
        const start = source.indexOf("handleIframeRenderStats");
        expect(start).toBeGreaterThan(-1);
        const block = source.slice(start, start + 1500);
        expect(block).toMatch(/textLength\s*===\s*0/);
        expect(block).toMatch(/childCount\s*<=?\s*1/);
        expect(block).toContain("setPreviewLooksEmpty");
    });
});
