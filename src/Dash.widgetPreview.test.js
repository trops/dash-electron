/**
 * Dash.js registers the sandboxed widget preview with dash-core at
 * startup (app-navigation NAV-011), next to setHostModules.
 */
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "Dash.js"), "utf8");

describe("Dash.js — live widget preview", () => {
    it("registers the iframe preview with dash-core at startup", () => {
        expect(src).toMatch(
            /import \{ registerWidgetPreview \} from "\.\/AiAssistant\/registerWidgetPreview";/
        );
        expect(src).toMatch(
            /setHostModules\(\{ "@trops\/dash-core": dashCore \}\);[\s\S]{0,400}registerWidgetPreview\(\);/
        );
    });
});
