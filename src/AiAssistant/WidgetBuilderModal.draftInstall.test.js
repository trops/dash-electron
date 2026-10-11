/**
 * Installing a draft from the builder's drafts list hands the host the same
 * arguments as a fresh AI build: (scoped component id, package name).
 *
 * WidgetDraftsList reports (package, bare component name). Passed through
 * as-is, Dash.js read the bundle for the bare name and placed the package
 * name as the cell's component, so a draft installed from an empty cell
 * didn't land. Static source pins, like the other builder tests.
 */
const fs = require("fs");
const path = require("path");

const modal = fs.readFileSync(
    path.join(__dirname, "WidgetBuilderModal.js"),
    "utf8"
);

describe("Widget Builder — installing a draft from the list", () => {
    test("maps (package, component) to (scoped component id, package)", () => {
        expect(modal).toMatch(
            /onInstalled=\{\(packageName, componentName\) => \{[\s\S]{0,1200}onInstalled\(\s*packageName\s*\?\s*makeScopedComponentId\(\s*packageName,\s*componentName\s*\)\s*:\s*componentName,\s*packageName\s*\)/
        );
    });

    test("the fresh AI build passes the same shape", () => {
        expect(modal).toMatch(
            /onInstalled\(scopedRegistryId, result\.widgetName\);/
        );
    });
});
