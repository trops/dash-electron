/**
 * Pins the AI builder prompt's theme-access guidance.
 *
 * The PRIMARY theme strategy in the prompt is "use @trops/dash-react
 * components — they pick up the active theme automatically." That
 * works as long as the AI sticks to the component library. But for
 * cases where raw HTML elements are unavoidable (custom card layout,
 * conditional borders, a one-off icon container) the AI needs to
 * know that direct ThemeContext access exists. Without this, it
 * defaults to hardcoded Tailwind classes (`bg-gray-800`, etc.) that
 * look fine on the default dark theme but don't follow theme switches.
 *
 * Static source-presence test: read the prompt source and assert the
 * key tokens are present.
 */
const fs = require("fs");
const path = require("path");

describe("WidgetBuilderModal system prompt — direct theme access guidance", () => {
    const modalPath = path.join(__dirname, "WidgetBuilderModal.js");
    const source = fs.readFileSync(modalPath, "utf8");

    // Slice the prompt's theme paragraph by anchoring on a stable
    // marker we'll insert in the prompt. The marker isolates the
    // paragraph from incidental matches elsewhere in the modal source
    // (the modal's own runtime code uses useContext(ThemeContext) and
    // currentTheme[...] for its chrome — those don't count as
    // "prompt teaches the AI").
    const SECTION_MARKER = "## Theme access";
    function getThemeParagraph() {
        const start = source.indexOf(SECTION_MARKER);
        if (start < 0) return null;
        // Paragraph ends at the next markdown-style header in the
        // template literal (`## ...`) or the closing of the template
        // (a backtick).
        const after = source.indexOf("\\n## ", start + SECTION_MARKER.length);
        const end =
            after > 0
                ? after
                : source.indexOf("`;", start + SECTION_MARKER.length);
        if (end < 0) return null;
        return source.slice(start, end);
    }

    test("prompt has a Theme access section", () => {
        expect(getThemeParagraph()).not.toBeNull();
    });

    test("section mentions useContext(ThemeContext) for direct theme access", () => {
        const para = getThemeParagraph();
        expect(para).not.toBeNull();
        expect(para).toMatch(/useContext\s*\(\s*ThemeContext\s*\)/);
    });

    test("section directs the import at @trops/dash-react", () => {
        const para = getThemeParagraph();
        expect(para).not.toBeNull();
        expect(para).toMatch(/ThemeContext.*@trops\/dash-react/);
    });

    test("section shows the currentTheme[key] || fallback className pattern", () => {
        const para = getThemeParagraph();
        expect(para).not.toBeNull();
        // Tolerate optional chaining (currentTheme?.["key"]) — the
        // recommended shape is to use it because currentTheme can be
        // undefined under some Provider configurations.
        expect(para).toMatch(
            /currentTheme\??\.?\[\s*["'][^"']+["']\s*\]\s*\|\|\s*["']/
        );
    });

    test("section includes at least one concrete theme key as example", () => {
        const para = getThemeParagraph();
        expect(para).not.toBeNull();
        const knownKeys = [
            "bg-primary-dark",
            "border-primary-dark",
            "text-primary-light",
            "bg-secondary-medium",
        ];
        expect(knownKeys.some((k) => para.includes(k))).toBe(true);
    });
});
