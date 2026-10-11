/**
 * Create screen → Widget Builder (create-entry PRD CRE-005, phase 2a).
 *
 * The Create screen fires `dash:open-widget-builder` with `{ prompt }`.
 * Dash.js passes it to the modal as `initialPrompt` (it isn't part of the
 * cell context), the modal skips the drafts list, and the prompt is sent as
 * the chat's first message — visibly, instead of the hidden greeting.
 *
 * Static source pins (no JSX/jsdom), like the other builder tests.
 */
const fs = require("fs");
const path = require("path");

const modal = fs.readFileSync(
    path.join(__dirname, "WidgetBuilderModal.js"),
    "utf8"
);
const dash = fs.readFileSync(path.join(__dirname, "..", "Dash.js"), "utf8");

describe("Widget Builder — initial prompt from the Create screen", () => {
    test("Dash.js splits the prompt off the cell context", () => {
        expect(dash).toMatch(/const \{ prompt, \.\.\.cellDetail \} = detail;/);
        expect(dash).toMatch(
            /widgetBuilderCellContext: resumeDraftId \? null : cellDetail,/
        );
        expect(dash).toMatch(/widgetBuilderInitialPrompt: initialPrompt,/);
    });

    test("a resumed draft ignores the prompt", () => {
        expect(dash).toMatch(
            /!resumeDraftId && typeof prompt === "string" && prompt\.trim\(\)/
        );
    });

    test("Dash.js passes it to the modal and clears it on close", () => {
        expect(dash).toMatch(
            /initialPrompt=\{\s*this\.state\s*\.widgetBuilderInitialPrompt \|\|\s*null\s*\}/
        );
        expect(dash).toMatch(/widgetBuilderInitialPrompt:\s*null,/);
    });

    test("the modal takes initialPrompt and skips the drafts list with it", () => {
        expect(modal).toMatch(/initialPrompt = null,/);
        expect(modal).toMatch(
            /if \(effectiveEditContext \|\| initialPrompt \|\| resumeDraftId\) \{[\s\S]{0,400}setViewMode\("builder"\);/
        );
    });

    test("the prompt replaces the greeting and is shown in the chat", () => {
        expect(modal).toMatch(
            /: initialPrompt \|\|\s*"Hi, I'd like to build a new widget\."/
        );
        expect(modal).toMatch(
            /initialMessageHidden=\{\s*!\(\s*chatMode !== "discover" &&\s*!effectiveEditContext\?\.componentCode &&\s*initialPrompt\s*\)\s*\}/
        );
    });

    test("the provider gate gets the prompt, so it asks a question (2c-1)", () => {
        expect(modal).toMatch(
            /<ChatProviderGate[\s\S]{0,1000}prompt=\{initialPrompt\}/
        );
    });
});
