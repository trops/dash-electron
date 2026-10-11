/**
 * The builder fixes its own build errors (create-entry PRD, phase 2d).
 *
 * Static source pins (no JSX/jsdom), like the other builder tests. The
 * decisions themselves are unit-tested in autoFixPolicy.test.js; these pin
 * the wiring: which errors count as build errors, the automatic send, the
 * progress panel, the reset on the user's own message, and Try again.
 */
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
    path.join(__dirname, "WidgetBuilderModal.js"),
    "utf8"
);

describe("WidgetBuilderModal — automatic build-error fixes", () => {
    test("a compile marks its errors as build errors", () => {
        expect(source).toMatch(
            /setIsCompiling\(true\);\s*previewErrorKindRef\.current = "compile";/
        );
    });

    test("errors the widget throws while running are marked runtime", () => {
        expect(
            source.match(/previewErrorKindRef\.current = "runtime";/g)
        ).toHaveLength(2);
    });

    test("the effect asks the policy, then sends the request hidden after a pause", () => {
        expect(source).toMatch(
            /onBuildError\(autoFixStateRef\.current, \{\s*code: lastCompiledCode\.current,\s*kind: previewErrorKindRef\.current,\s*\}\)/
        );
        expect(source).toMatch(
            /sendFixRequest\(content, \{ hidden: true \}\),\s*1500/
        );
    });

    test("a successful compile starts the tries over", () => {
        expect(source).toMatch(
            /setPreviewError\(null\);\s*\/\/ It compiled[^\n]*\n\s*autoFixStateRef\.current = resetAutoFix\(\);/
        );
    });

    test("the user's own message starts the tries over", () => {
        expect(source).toMatch(/onPublishEvent=\{handleChatEvent\}/);
        expect(source).toMatch(
            /payload\.text === lastAutoFixTextRef\.current\) return;/
        );
    });

    test("while fixing, the preview shows progress instead of the red box", () => {
        expect(source).toMatch(/data-testid="auto-fix-progress"/);
        expect(source).toMatch(/Fixing a build error… \(try/);
        expect(source).toMatch(
            /const autoFixShowing =\s*!!previewError &&\s*previewErrorKindRef\.current === "compile" &&\s*autoFix\.status !== "exhausted";/
        );
        expect(source).toMatch(/!autoFixShowing &&/);
    });

    test("when the tries run out: Try again and Open Code tab", () => {
        expect(source).toMatch(
            /Still failing after \$\{MAX_AUTO_FIX\} automatic fixes/
        );
        expect(source).toMatch(/\? "Try again"\s*: "Send error to AI"/);
        expect(source).toMatch(/Open Code tab/);
    });

    test("code with no recognisable component is a build error, never a silent stall", () => {
        expect(source).toMatch(
            /if \(!name\) \{[\s\S]{0,400}previewErrorKindRef\.current = "compile";[\s\S]{0,200}setPreviewError\(\s*"Couldn't find the widget's component in the code/
        );
        expect(source).not.toMatch(
            /if \(!name \|\| !code\.componentCode\) return;/
        );
        expect(source).toMatch(
            /import \{ extractWidgetName \} from "\.\/extractWidgetName";/
        );
    });
});
