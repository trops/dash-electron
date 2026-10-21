/**
 * Change with AI goes through Create (consolidation Phase 3): Dash.js no
 * longer opens the Widget Builder for it — dash-core's DashboardStage opens
 * Create › Change <widget>. The Widget Builder opens only for "Edit the code
 * yourself", and a widget changed in place reloads where it runs.
 */
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "Dash.js"), "utf8");

describe("Dash.js and Change with AI", () => {
    test("Change with AI isn't heard here (Create opens it)", () => {
        expect(src).not.toMatch(/"dash:edit-widget-with-ai"/);
    });

    test("Edit the code yourself opens the Widget Builder on the widget", () => {
        expect(src).toMatch(
            /window\.addEventListener\("dash:edit-widget-code", async \(e\) =>/
        );
        expect(src).toMatch(/widgetBuilderEditContext: editContext,/);
    });

    test("a widget changed in place gets its new code, and only it remounts", () => {
        const start = src.indexOf('"dash:widget-changed"');
        expect(start).toBeGreaterThan(-1);
        const body = src.slice(start, start + 1200);
        expect(body).toMatch(/window\.mainApi\.widgets\.readBundle\(pkg\)/);
        expect(body).toMatch(
            /registerBundleConfigs\(pkg, bundle\.source, null, \{\s*replaceExisting: true,\s*\}\)/
        );
        expect(body).toMatch(
            /new CustomEvent\("dash:widget-installed", \{\s*detail: \{ widgetName: component \},/
        );
    });
});
