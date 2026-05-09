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
        const iframeMount = source.indexOf("<PreviewIframe");
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
