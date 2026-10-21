/**
 * WidgetBuilderModal — editing a widget from one of the user's own packages
 * (Widget Builder edit fixes): "Update original" rebuilds that package in
 * place, the category comes from the widget and isn't required to update,
 * and the success screen says what happened.
 */
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(
    path.join(__dirname, "WidgetBuilderModal.js"),
    "utf8"
);
const preload = fs.readFileSync(
    path.join(__dirname, "..", "..", "public", "preload.js"),
    "utf8"
);

describe("Update original rebuilds the user's own package", () => {
    test("the install hands aiBuild the original package to update", () => {
        expect(src).toMatch(
            /isRemixMode && editMode === "update"\s*\?\s*effectiveEditContext\?\.originalPackage \|\| null\s*:\s*null/
        );
        expect(preload).toMatch(/updateOriginal: updateOriginal \|\| null/);
    });

    test("the success screen says the package was updated, with its version", () => {
        expect(src).toMatch(/updated: !!result\.updated/);
        expect(src).toMatch(/was updated to version/);
    });
});

describe("category when editing (prefilled when known, else picked)", () => {
    test("prefilled from the widget's config, else its package manifest", () => {
        expect(src).toMatch(/categoryFromManifest\(/);
    });

    test("a category is always required — Update original too — and written into the widget", () => {
        // The registry organizes widgets by category: an empty one is picked.
        expect(src).not.toMatch(/categoryNeeded/);
        expect(src).toMatch(/if \(!selectedCategory\) return;/);
        expect(src).toMatch(
            /finalConfigCode = injectCategoryIntoConfigCode\(\s*detectedCode\.configCode,\s*selectedCategory\s*\)/
        );
    });
});
