/**
 * The Widget Builder follows the app theme (light and dark), so its UI uses
 * theme tokens and dash-react status colours — not fixed Tailwind palette
 * classes (`text-gray-400`, `bg-indigo-600`, `bg-black/30`,
 * `placeholder-gray-500`), which only read
 * correctly on a dark background.
 *
 * Every builder UI file must stay at zero.
 */
const fs = require("fs");
const path = require("path");

const PALETTE =
    "gray|slate|zinc|neutral|stone|red|rose|amber|yellow|green|emerald|blue|indigo|violet|purple|sky|cyan|teal|orange|pink|lime|fuchsia";
const HARDCODED = new RegExp(
    `(?:^|[\\s"'\`:])(?:[a-z-]+:)?(?:bg|text|border(?:-[lrtbxy])?|divide|ring|from|to|placeholder)-(?:(?:${PALETTE})-\\d{2,3}|white|black)(?:\\/\\d+)?(?=[\\s"'\`]|$)`,
    "g"
);

function hardcoded(file) {
    const src = fs.readFileSync(path.join(__dirname, file), "utf8");
    return src.match(HARDCODED) || [];
}

describe("Widget Builder — no hard-coded palette colours", () => {
    test("the pattern catches palette classes and skips theme tokens", () => {
        const sample =
            'className="text-gray-400 hover:bg-white/5 bg-black/30 placeholder-gray-500 border-l-sky-500 bg-[var(--primary-700)] text-xs placeholder-shown:p-2"';
        expect(sample.match(HARDCODED).map((m) => m.trim())).toEqual([
            '"text-gray-400',
            "hover:bg-white/5",
            "bg-black/30",
            "placeholder-gray-500",
            "border-l-sky-500",
        ]);
    });

    test.each([
        "WidgetBuilderModal.js",
        "WidgetDraftsList.js",
        "WidgetConfigureTab.js",
        "WidgetConsolePane.js",
        "composer/AcceptanceScorecard.js",
        "ChecksStatus.js",
        "UnsavedWorkPrompt.js",
        "WidgetCredentialPermissionModal.js",
        "composer/ComposerPaneV2.js",
        "composer/GridEditor.js",
        "composer/PaletteView.js",
        "composer/PropertyInspector.js",
        "composer/QuickStartPane.js",
        "composer/WirePicker.js",
    ])("%s has none", (file) => {
        expect(hardcoded(file)).toEqual([]);
    });
});
