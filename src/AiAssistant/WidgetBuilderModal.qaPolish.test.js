/**
 * Widget Builder fixes from the QA pass of 2026-10-22 (static source
 * checks, like the polish test):
 *
 *   - "Enter a name for the remix" only when remixing (it showed on a new
 *     widget's Install tooltip).
 *   - Build Another starts clean: a new draft, an empty composer, no
 *     category (it kept the last widget's layout and Category).
 *   - Saving a draft tells an open Widgets page to refresh its list.
 */
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
    path.join(__dirname, "WidgetBuilderModal.js"),
    "utf8"
);

describe("WidgetBuilderModal — QA 2026-10-22", () => {
    test("the remix-name tooltip needs remix mode, like the disabled check", () => {
        expect(source).toMatch(
            /: isRemixMode &&\s*editMode ===\s*"remix" &&\s*!remixName\s*\?\s*"Enter a name for the remix"/
        );
    });

    test("one fresh start for Start new and Build Another", () => {
        const fresh = source.match(
            /const startFresh = \(\) => \{([\s\S]*?)\n {4}\};/
        );
        expect(fresh).toBeTruthy();
        for (const step of [
            "draftSessionIdRef.current = null;",
            "resumedDraftRef.current = null;",
            "setComposerInitialGrid(null);",
            "setComposerGrid(null);",
            "setComposerSessionKey((k) => k + 1);",
        ]) {
            expect(fresh[1]).toContain(step);
        }
        expect(source).toMatch(
            /onStartNew=\{\(\) => \{\s*startFresh\(\);\s*setViewMode\("builder"\);/
        );
        expect(source).toMatch(
            /startFresh\(\);\s*setSelectedCategory\(\s*null\s*\);[\s\S]{0,400}Build Another/
        );
    });

    test("a saved draft tells the Widgets page to refresh", () => {
        expect(source).toMatch(
            /await window\.mainApi\?\.drafts\?\.save\?\.\(draft, files\);[\s\S]{0,120}window\.dispatchEvent\(new Event\("dash:widgets-updated"\)\);/
        );
    });
});
