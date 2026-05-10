/**
 * Drift detector for dashReactComponentRegistry.
 *
 * Parses node_modules/@trops/dash-react/dist/index.js for all named
 * exports starting with an uppercase letter (PascalCase = React
 * component or context, by convention) and asserts the registry's
 * Set agrees:
 *
 *   1. Every entry in DASH_REACT_COMPONENTS is exported by dash-react
 *      (no fictional entries — would cause the validator to falsely
 *      pass widgets using nonexistent components).
 *   2. Every PascalCase export of dash-react is in the registry (no
 *      missing entries — would cause the validator to falsely reject
 *      widgets using legitimate components).
 *
 * If dash-react adds or removes an export, this test fails. The fix
 * is to update the registry to match — never to weaken the test. The
 * whole point of the registry is "what's actually exported."
 *
 * Running this in jest (jsdom) is fine: we only read the dist file
 * as text and parse the export list. We do NOT import dash-react
 * (which has window-level side effects that break under node).
 */
const fs = require("fs");
const path = require("path");
const { DASH_REACT_COMPONENTS } = require("./dashReactComponentRegistry");

const distPath = path.join(
    __dirname,
    "..",
    "..",
    "node_modules",
    "@trops",
    "dash-react",
    "dist",
    "index.js"
);

/**
 * Parse all `export { … }` blocks in the dist and return the set of
 * exported names whose published name starts with an uppercase letter.
 *
 * `export { foo as Bar }` aliases — we want the published name (Bar).
 */
function parseDashReactExports() {
    const src = fs.readFileSync(distPath, "utf8");
    const exports = new Set();
    const blockMatches = src.matchAll(/export\s*\{([^}]+)\}/g);
    for (const m of blockMatches) {
        for (const entry of m[1].split(",")) {
            const trimmed = entry.trim();
            if (!trimmed) continue;
            // Pattern: `name as Alias` — pick Alias. Otherwise: name.
            const aliasMatch = trimmed.match(/\s+as\s+([A-Za-z_$][\w$]*)$/);
            const published = aliasMatch
                ? aliasMatch[1]
                : trimmed.split(/\s+/)[0];
            if (/^[A-Z]/.test(published)) {
                exports.add(published);
            }
        }
    }
    return exports;
}

describe("dashReactComponentRegistry — drift against @trops/dash-react dist", () => {
    test("dist file exists at the expected path", () => {
        expect(fs.existsSync(distPath)).toBe(true);
    });

    test("every registry entry is exported by @trops/dash-react", () => {
        const real = parseDashReactExports();
        const fictional = [...DASH_REACT_COMPONENTS].filter(
            (name) => !real.has(name)
        );
        if (fictional.length > 0) {
            throw new Error(
                `registry contains components NOT exported by @trops/dash-react: ${fictional.join(
                    ", "
                )}. Either add the export to dash-react or remove the entry from the registry — otherwise the validator will silently pass widgets using nonexistent components.`
            );
        }
    });

    test("every PascalCase dash-react export is in the registry", () => {
        const real = parseDashReactExports();
        const missing = [...real].filter(
            (name) => !DASH_REACT_COMPONENTS.has(name)
        );
        if (missing.length > 0) {
            throw new Error(
                `@trops/dash-react exports components NOT in the registry: ${missing.join(
                    ", "
                )}. Add them so the validator stops false-rejecting widgets that use them. (If they're not real components — e.g. utility constants — exclude them by case-renaming or by tightening the parser; the registry only carries component-shaped names.)`
            );
        }
    });
});
