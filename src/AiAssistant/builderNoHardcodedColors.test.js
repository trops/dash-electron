/**
 * The Widget Builder follows the app theme (light and dark), so its UI uses
 * theme tokens and dash-react status colours — not fixed Tailwind palette
 * classes (`text-gray-400`, `bg-indigo-600`, `bg-black/30`), which only read
 * correctly on a dark background.
 *
 * Converted files must stay at zero. The modal is being converted in slices,
 * so it has a ceiling that each slice lowers; it may only go down.
 */
const fs = require("fs");
const path = require("path");

const PALETTE =
    "gray|slate|zinc|neutral|stone|red|rose|amber|yellow|green|emerald|blue|indigo|violet|purple|sky|cyan|teal|orange|pink|lime|fuchsia";
const HARDCODED = new RegExp(
    `(?:^|[\\s"'\`:])(?:[a-z-]+:)?(?:bg|text|border|divide|ring|from|to)-(?:(?:${PALETTE})-\\d{2,3}|white|black)(?:\\/\\d+)?(?=[\\s"'\`]|$)`,
    "g"
);

function hardcoded(file) {
    const src = fs.readFileSync(path.join(__dirname, file), "utf8");
    return src.match(HARDCODED) || [];
}

describe("Widget Builder — no hard-coded palette colours", () => {
    test("the pattern catches palette classes and skips theme tokens", () => {
        const sample =
            'className="text-gray-400 hover:bg-white/5 bg-black/30 bg-[var(--primary-700)] text-xs"';
        expect(sample.match(HARDCODED).map((m) => m.trim())).toEqual([
            '"text-gray-400',
            "hover:bg-white/5",
            "bg-black/30",
        ]);
    });

    test.each(["WidgetDraftsList.js"])("%s has none", (file) => {
        expect(hardcoded(file)).toEqual([]);
    });

    test("WidgetBuilderModal.js stays under its ceiling", () => {
        // Slice A (frame, tabs, toolbar, footers). Lower this as slices
        // B–D convert the rest; never raise it.
        const CEILING = 189;
        expect(hardcoded("WidgetBuilderModal.js").length).toBeLessThanOrEqual(
            CEILING
        );
    });
});
