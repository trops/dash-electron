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
        // startPrompt: Create's prompt, or what was typed in the gate.
        expect(modal).toMatch(
            /const startPrompt = initialPrompt \|\| typedPrompt;/
        );
        expect(modal).toMatch(
            /: startPrompt \|\|\s*"Hi, I'd like to build a new widget\."/
        );
        expect(modal).toMatch(
            /initialMessageHidden=\{\s*!\(\s*chatMode !== "discover" &&\s*!effectiveEditContext\?\.componentCode &&\s*startPrompt\s*\)\s*\}/
        );
    });

    test("the provider gate gets the prompt, so it asks a question (2c-1)", () => {
        expect(modal).toMatch(
            /<ChatProviderGate[\s\S]{0,1000}prompt=\{startPrompt\}\s*onPrompt=\{\(text\) => \{/
        );
    });

    test("a typed description starts an empty conversation, so ChatCore sends it", () => {
        // ChatCore only sends initialMessage into an empty history.
        expect(modal).toMatch(
            /onPrompt=\{\(text\) => \{[\s\S]{0,600}localStorage\.setItem\(\s*"dash-widget-builder",\s*JSON\.stringify\(\{\s*messages: \[\],?\s*\}\)\s*\);[\s\S]{0,900}lastMsgCount\.current = 0;[\s\S]{0,200}setTypedPrompt\(text \|\| null\);/
        );
        // Only a description typed here can be edited (not Create's).
        expect(modal).toMatch(
            /canEditPrompt=\{\s*!initialPrompt && !!typedPrompt\s*\}/
        );
    });

    test("Change only shows before code exists", () => {
        expect(modal).toMatch(
            /\{!detectedCode\?\.componentCode && \(\s*<Button3\s+size="sm"\s+title="Change"/
        );
    });

    test("a typed prompt is cleared when the session starts over", () => {
        // New chat (message-poller reset) and "Build new widget".
        expect(
            modal.match(
                /setSelectedProviderForBuild\(null\);\s*setTypedPrompt\(null\);/g
            ) || []
        ).toHaveLength(2);
    });
});
