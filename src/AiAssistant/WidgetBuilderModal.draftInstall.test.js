/**
 * Drafts aren't installed from the builder's drafts list (consolidation
 * Phase 1a — that skipped the checks): Resume opens the draft in the
 * builder, whose Install runs only after the code passed. Static source
 * pins, like the other builder tests.
 */
const fs = require("fs");
const path = require("path");

const modal = fs.readFileSync(
    path.join(__dirname, "WidgetBuilderModal.js"),
    "utf8"
);

describe("Widget Builder — drafts are installed only after their checks", () => {
    test("the drafts list is given no install callback", () => {
        const at = modal.indexOf("<WidgetDraftsList");
        expect(at).toBeGreaterThan(-1);
        const tag = modal.slice(at, modal.indexOf("/>", at));
        expect(tag).not.toMatch(/onInstalled=/);
    });

    test("the fresh AI build hands the host (scoped component id, package)", () => {
        expect(modal).toMatch(
            /onInstalled\(scopedRegistryId, result\.widgetName\);/
        );
    });
});
