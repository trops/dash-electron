/**
 * WidgetBuilderModal — remixing someone else's widget is allowed only when
 * its author allows remixes (remixes PRD, R3). The rule itself is
 * remixGate.js (tested in remixGate.test.js); these pin the wiring.
 */
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(
    path.join(__dirname, "WidgetBuilderModal.js"),
    "utf8"
);

describe("the Widget Builder's remix gate", () => {
    test("asks the registry about the original only for someone else's widget", () => {
        expect(src).toMatch(
            /!isRemixMode \|\|\s*!registryChecked \|\|\s*isOwner \|\|\s*!original \|\|\s*widgetScope === "ai-built"/
        );
        expect(src).toMatch(
            /window\.mainApi\?\.registry\?\.getPackage\?\.\(original\)/
        );
        expect(src).toMatch(
            /setRemixBlocked\(remixBlockedText\(pkg, name \|\| original\)\)/
        );
    });

    test("says why instead of opening the code, and never saves the remix", () => {
        expect(src).toMatch(/data-testid="builder-remix-blocked"/);
        expect(src).toMatch(/viewMode === "builder" && !remixBlocked && \(/);
        expect(src).toMatch(
            /\/\/ A remix its author doesn't allow is never saved\.\s*if \(remixBlocked\) return;/
        );
    });
});
