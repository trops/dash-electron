/**
 * Pins the in-builder toolbar additions:
 *
 *   - Open in Editor button (data-testid="builder-open-editor")
 *     placed AFTER the Console tab in the same row, gated on the
 *     presence of detectedCode.componentCode + a draft session id +
 *     not-edit-context (build mode).
 *   - Save Draft button (data-testid="builder-save-draft") with the
 *     same gating, also AFTER the Console tab.
 *   - Save-status text referencing draftLastSavedAt so the user can
 *     see auto-save activity (vs the prior version where saves were
 *     silent).
 *   - PreviewProviderPicker accepts a `justChanged` prop and emits a
 *     data-testid="provider-just-changed" element when set.
 *   - The picker's onChange is now called with three args
 *     (next, changedType, changedValue) so the modal can flag a
 *     change that just happened.
 *
 * Static source-presence test (no JSX/jsdom): reads the modal as text
 * and asserts each token's presence + relative ordering.
 */
const fs = require("fs");
const path = require("path");

describe("WidgetBuilderModal — in-builder toolbar (Open in Editor / Save Draft / provider feedback)", () => {
    const modalPath = path.join(__dirname, "WidgetBuilderModal.js");
    const source = fs.readFileSync(modalPath, "utf8");

    test('"Open in editor" toolbar button is present', () => {
        expect(source).toContain('data-testid="builder-open-editor"');
    });

    test('"Save Draft" toolbar button is present', () => {
        expect(source).toContain('data-testid="builder-save-draft"');
    });

    test('"Open in editor" appears AFTER the Console tab in source order (toolbar placement)', () => {
        const consoleTabPos = source.indexOf('data-testid="tab-console"');
        const openEditorPos = source.indexOf(
            'data-testid="builder-open-editor"'
        );
        expect(consoleTabPos).toBeGreaterThan(-1);
        expect(openEditorPos).toBeGreaterThan(-1);
        expect(openEditorPos).toBeGreaterThan(consoleTabPos);
    });

    test("save-status text references draftLastSavedAt and a 'saved … ago' string", () => {
        expect(source).toMatch(/draftLastSavedAt/);
        // Either "Draft saved" or "saved {N}s ago" — accept either tokenization.
        expect(source).toMatch(/(?:Draft saved|saved\s.*ago)/i);
    });

    test("PreviewProviderPicker accepts justChanged prop and renders the change caption", () => {
        // Function signature must include justChanged in the destructured props.
        const sigMatch = source.match(
            /function\s+PreviewProviderPicker\s*\(\s*\{([^}]*)\}\s*\)/
        );
        expect(sigMatch).not.toBeNull();
        expect(sigMatch[1]).toMatch(/\bjustChanged\b/);
        // Caption rendered with a stable test-id.
        expect(source).toContain('data-testid="provider-just-changed"');
    });

    test("PreviewProviderPicker onChange call site is invoked with (next, type, value)", () => {
        // When the user picks from the dropdown, the picker must
        // invoke onChange with the new selection object PLUS the
        // changed type and value, so the parent can flag the change.
        // We check that within the body of the inner select handler,
        // both the object literal `[decl.type]: e.target.value` AND
        // the bare-arg pair `decl.type` followed by `e.target.value`
        // appear in source order — that's the 3-arg shape.
        const objectLiteralPos = source.indexOf("[decl.type]: e.target.value");
        // Look for the bare-arg pair AFTER the object literal — they
        // must be passed as positional args after the new-selection
        // object. Prettier may break across lines, so allow whitespace
        // between the comma and `e.target.value`.
        const bareArgsRegex = /decl\.type\s*,\s*e\.target\.value\s*\)/;
        const bareArgsMatch = source
            .slice(objectLiteralPos)
            .match(bareArgsRegex);
        expect(objectLiteralPos).toBeGreaterThan(-1);
        expect(bareArgsMatch).not.toBeNull();
    });
});
