/**
 * findTailwindViolations
 *
 * Pure helper that scans a single file's source for Tailwind utility
 * classes that fall outside dash-electron's safelist (defined in
 * `dash-electron/tailwind.config.js`).
 *
 * Rationale: dash-electron ships a prebuilt CSS bundle. Any class
 * NOT in the safelist AND NOT statically present in dash-electron's
 * own source silently fails to render when consumed from dash-core
 * — invisible at PR review, only catches the eye when someone
 * notices a missing background or hover state.
 *
 * Detection strategy: extract candidate class tokens from `className=`
 * attributes (string literals, JSX expressions, template literals,
 * ternary branches) and test each against three patterns we know to
 * be unsafe:
 *
 *   1. Opacity modifier on a color (`bg-white/5`, `text-gray-200/40`,
 *      `hover:bg-white/10`) — the safelist deliberately omits these.
 *   2. Arbitrary value (`text-[10px]`, `w-[440px]`, `bg-[#abc]`) —
 *      Tailwind generates these on demand from content scanning, but
 *      content scanning doesn't see dash-core source from inside
 *      dash-electron's prebuilt bundle.
 *   3. Off-safelist utility prefix paired with a color shade
 *      (`divide-gray-800`, `ring-blue-500`, `outline-red-500`) —
 *      explicitly NOT in the safelist patterns.
 *
 * False-positive risk: only scans inside `className=` attributes, so
 * raw URL strings or unrelated literals don't trigger.
 *
 * Returns: Array<{class, kind, line}>
 */
"use strict";

const CLASSNAME_PATTERN =
    /\bclassName\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]+)\})/g;

const OPACITY_MOD =
    /^(?:hover:|focus:|active:|disabled:|group-hover:)?(?:bg|text|border|from|via|to|ring|outline|divide|fill|stroke)-(?:[a-z-]+)\/\d+$/;
const ARBITRARY = /\[[^\]]+\]/;
const OFF_SAFELIST =
    /^(?:hover:|focus:|active:)?(?:divide|ring|outline)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+$/;

function findTailwindViolations(source) {
    if (typeof source !== "string" || !source) return [];
    const violations = [];

    // Build a line index for O(log n) line lookup per match offset.
    const lineStarts = [0];
    for (let i = 0; i < source.length; i++) {
        if (source.charCodeAt(i) === 10 /* \n */) lineStarts.push(i + 1);
    }
    const lineOf = (offset) => {
        let lo = 0;
        let hi = lineStarts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >>> 1;
            if (lineStarts[mid] <= offset) lo = mid;
            else hi = mid - 1;
        }
        return lo + 1;
    };

    for (const match of source.matchAll(CLASSNAME_PATTERN)) {
        const startOffset = match.index;
        const value = match[1] ?? match[2] ?? match[3] ?? "";
        if (!value) continue;
        const tokens = extractClassTokens(value);
        for (const token of tokens) {
            const kind = classifyViolation(token);
            if (kind) {
                violations.push({
                    class: token,
                    kind,
                    line: lineOf(startOffset),
                });
            }
        }
    }
    return violations;
}

/**
 * Pull every plausible Tailwind class token out of a className value.
 * Handles plain space-separated lists, template literals (split on
 * `${...}` placeholders), and string literals nested in ternaries.
 */
function extractClassTokens(value) {
    const tokens = [];
    // Strip template-literal interpolations and quote characters; we want
    // the raw class text. JS literal strings nested via "..." or '...'
    // contribute their quoted contents.
    const cleaned = value.replace(/\$\{[^}]*\}/g, " ").replace(/[`{}]/g, " ");
    // Pull out anything that looks like quoted strings.
    const quoted = [];
    for (const m of cleaned.matchAll(/"([^"]*)"|'([^']*)'/g)) {
        quoted.push(m[1] ?? m[2] ?? "");
    }
    const sources = quoted.length > 0 ? quoted : [cleaned];
    for (const s of sources) {
        for (const tok of s.split(/\s+/)) {
            const t = tok.trim();
            if (!t) continue;
            // Filter out obvious non-class content (URLs, file paths).
            if (
                t.includes("/") &&
                (t.startsWith("http") ||
                    t.startsWith("./") ||
                    t.startsWith("../"))
            ) {
                continue;
            }
            tokens.push(t);
        }
    }
    return tokens;
}

function classifyViolation(token) {
    if (OPACITY_MOD.test(token)) return "opacity-modifier";
    if (ARBITRARY.test(token)) return "arbitrary-value";
    if (OFF_SAFELIST.test(token)) return "off-safelist-utility";
    return null;
}

module.exports = { findTailwindViolations };
