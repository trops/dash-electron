/**
 * The Widget Builder inside Create (create-entry PRD CRE-005 AC1, 2c-3).
 *
 * Static source pins (no JSX/jsdom), like the other builder tests:
 *   - the builder renders without its own modal frame and header when
 *     embedded;
 *   - Dash.js registers the embedded builder with dash-core, and its own
 *     window finishes through the shared finalizeWidgetBuilderSession and
 *     the shared remount guard.
 */
const fs = require("fs");
const path = require("path");

const modal = fs.readFileSync(
    path.join(__dirname, "WidgetBuilderModal.js"),
    "utf8"
);
const dash = fs.readFileSync(path.join(__dirname, "..", "Dash.js"), "utf8");

describe("WidgetBuilderModal — embedded", () => {
    test("takes an embedded prop, off by default", () => {
        expect(modal).toMatch(/embedded = false,/);
    });

    test("embedded swaps the Modal for a plain frame", () => {
        expect(modal).toMatch(
            /const Frame = embedded \? EmbeddedFrame : BuilderModalFrame;/
        );
        expect(modal).toMatch(/<Frame \{\.\.\.frameProps\}>/);
        expect(modal).toMatch(/<\/Frame>/);
        // The standalone frame is the Modal with one raised surface inside.
        expect(modal).toMatch(
            /const BuilderModalFrame = [\s\S]{0,200}<Modal \{\.\.\.modalProps\}>\s*<div\s+className=\{`dr-modal-surface/
        );
    });

    test("the builder's own header is hidden when embedded", () => {
        expect(modal).toMatch(/\{!embedded && \(\s*<PanelHeader/);
    });
});

describe("Dash.js — one way to finish a builder session", () => {
    test("registers the embedded builder for the Create screen", () => {
        expect(dash).toMatch(
            /setWidgetBuilderRenderer\(makeEmbeddedWidgetBuilder\(registerBundleConfigs\)\);/
        );
    });

    test("the builder window's close goes through the shared finish step", () => {
        expect(dash).toMatch(
            /await finalizeWidgetBuilderSession\(\s*\{\s*installed,\s*cellContext: ctx,\s*editContext: editCtx,\s*registerBundle:\s*registerBundleConfigs,\s*\}\s*\);/
        );
        expect(dash).not.toMatch(/dash:place-widget-in-cell/);
        expect(dash).not.toMatch(/dash:swap-widget-in-cell/);
    });

    test("remount guards use the shared flag, not a field", () => {
        expect(dash).not.toMatch(/_suppressStageKeyUntil/);
        expect(dash.match(/!widgetBuilderBlocksRemount\(\)/g)).toHaveLength(2);
        expect(dash).toMatch(/suppressStageRemount\(\);/);
    });

    test("there's no builder chat to clear any more", () => {
        expect(dash).not.toMatch(/primeWidgetBuilderChat/);
        expect(dash).not.toMatch(/widgetBuilderInitialPrompt/);
    });

    test("the builder window reads the install synchronously (drafts list installs, then closes in one tick)", () => {
        expect(dash).toMatch(
            /const installed =\s*this\._installedWidgetInfo \|\|\s*this\.state\s*\.installedWidgetInfo;/
        );
        expect(dash).toMatch(/this\._installedWidgetInfo =\s*null;/);
        expect(dash).toMatch(
            /this\._installedWidgetInfo = \{\s*componentName,\s*scopedName,\s*\};/
        );
    });
});

describe("WidgetBuilderModal — a resumed draft", () => {
    test("skips the drafts list (no race with resumeFromDraft)", () => {
        expect(modal).toMatch(
            /if \(effectiveEditContext \|\| resumeDraftId\) \{/
        );
    });
});
