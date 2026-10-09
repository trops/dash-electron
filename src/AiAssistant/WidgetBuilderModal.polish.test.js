/**
 * Widget Builder polish (static source checks, like the toolbar test):
 *
 *   - The chat is wrapped in the APP theme. The modal mounts outside the
 *     theme provider, so ChatCore's bubbles had no background and dim text.
 *   - The builder opens in Build (the AI chat), not Compose.
 *   - The footer says why Install is greyed out (no category yet).
 *   - A draft's fallback name skips the hidden greeting message.
 */
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
    path.join(__dirname, "WidgetBuilderModal.js"),
    "utf8"
);

describe("WidgetBuilderModal — polish", () => {
    test("ChatCore renders inside the app theme provider", () => {
        expect(source).toMatch(/window\.__dashAppThemeContext/);
        expect(source).toMatch(
            /<ThemeContext\.Provider\s+value=\{chatThemeCtx\}>\s*<ChatCore/
        );
    });

    test("opens in Build mode", () => {
        expect(source).toMatch(/useState\("build"\)/);
        expect(source).not.toMatch(
            /setChatMode\("compose"\);\s*setDiscoverResults/
        );
    });

    test("explains why Install is disabled", () => {
        expect(source).toContain('data-testid="install-category-hint"');
    });

    test("the Discover search never uses the hidden greeting", () => {
        expect(source).toMatch(/m\?\.role !== "user" \|\| m\.hidden/);
    });

    test("the missing-files hint only matches real import errors", () => {
        const hint = source.match(
            /\{(\/Could not resolve[^/]*\/i)\.test\(\s*previewError/
        );
        expect(hint).not.toBeNull();
        // "/body/i" from the source → a RegExp (body only, no eval).
        const re = new RegExp(hint[1].slice(1, -2), "i");
        expect(re.test('Could not resolve "./utils"')).toBe(true);
        expect(re.test("Cannot find module './x'")).toBe(true);
        expect(re.test("Could not resolve widget component from bundle.")).toBe(
            false
        );
    });

    test("draft fallback name skips hidden messages", () => {
        expect(source).toMatch(/firstUserMessageExcerpt\(chatHistory\)/);
    });
});
