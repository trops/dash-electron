/**
 * WidgetBuilderModal — the draft auto-save skips Compose's empty placeholder,
 * so opening Compose doesn't leave an "Empty widget" draft behind.
 */
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(
    path.join(__dirname, "WidgetBuilderModal.js"),
    "utf8"
);

describe("WidgetBuilderModal — draft auto-save", () => {
    test("Compose's emit carries whether the grid is empty", () => {
        expect(src).toMatch(/emptyGrid: !!code\.empty,/);
    });
    test("an empty Compose grid isn't saved as a draft", () => {
        expect(src).toMatch(
            /if \(!detectedCode\?\.componentCode\) return;\s+\/\/ [^\n]+\n\s+if \(detectedCode\.emptyGrid\) return;/
        );
    });
});
