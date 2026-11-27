#!/usr/bin/env node
/**
 * check-tailwind-safelist.js
 *
 * Walks dash-electron's src/ for Tailwind utility classes outside the
 * safelist, and fails CI on any NEW violation (one not present in
 * `scripts/tailwind-safelist-baseline.json`). Ported from dash-core's
 * copy (DASH-154); the finder is scripts/lib/findTailwindViolations.js.
 *
 * Why baseline-first instead of strict zero: there's existing code
 * with opacity-modifier classes (`bg-white/5`, `border-white/10`) that
 * predates the safelist convention. Failing on those would block this
 * lint from landing. The baseline grandfathers the existing set; new
 * commits can't increase the violation count without explicit
 * `--update-baseline` opt-in.
 *
 * Usage:
 *   node scripts/check-tailwind-safelist.js
 *     → exits 0 if violation set ⊆ baseline, 1 otherwise.
 *   node scripts/check-tailwind-safelist.js --update-baseline
 *     → rewrites the baseline to match current state. Run after an
 *       intentional cleanup so future runs catch fresh violations.
 *
 * Why no per-file allowlist: a baseline file scoped by `{file, class,
 * line}` would invalidate on every line shift. Scoping by
 * `{file, class}` only is enough to gate "did a new TYPE of violation
 * land in a file" without false-positive churn.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const { findTailwindViolations } = require("./lib/findTailwindViolations");

const REPO_ROOT = path.resolve(__dirname, "..");
const BASELINE_PATH = path.join(
    REPO_ROOT,
    "scripts",
    "tailwind-safelist-baseline.json"
);

const SCAN_ROOTS = ["src"];
const SOURCE_EXTS = new Set([".js", ".jsx"]);
const SKIP_DIRS = new Set([
    "node_modules",
    "dist",
    "build",
    ".git",
    "__mocks__",
]);

function walkSourceFiles(dir, out) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
        return;
    }
    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            walkSourceFiles(path.join(dir, entry.name), out);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (!SOURCE_EXTS.has(ext)) continue;
            // Skip test files — violations in tests are intentional fixtures.
            if (entry.name.endsWith(".test.js")) continue;
            out.push(path.join(dir, entry.name));
        }
    }
}

function collectAllViolations() {
    const all = [];
    for (const root of SCAN_ROOTS) {
        const abs = path.join(REPO_ROOT, root);
        if (!fs.existsSync(abs)) continue;
        const files = [];
        walkSourceFiles(abs, files);
        for (const file of files) {
            const rel = path.relative(REPO_ROOT, file);
            const src = fs.readFileSync(file, "utf8");
            const violations = findTailwindViolations(src);
            for (const v of violations) {
                all.push({
                    file: rel,
                    class: v.class,
                    kind: v.kind,
                    line: v.line,
                });
            }
        }
    }
    return all;
}

/**
 * Reduce the violation list to a `{file: [class, ...]}` map. Sort
 * everything for stable diffs in the baseline file.
 */
function toBaselineShape(violations) {
    const byFile = new Map();
    for (const v of violations) {
        if (!byFile.has(v.file)) byFile.set(v.file, new Set());
        byFile.get(v.file).add(v.class);
    }
    const out = {};
    for (const file of [...byFile.keys()].sort()) {
        out[file] = [...byFile.get(file)].sort();
    }
    return out;
}

function readBaseline() {
    if (!fs.existsSync(BASELINE_PATH)) return {};
    try {
        return JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
    } catch (e) {
        console.error(`[safelist] Could not parse baseline: ${e.message}`);
        return {};
    }
}

function writeBaseline(shape) {
    let text = JSON.stringify(shape, null, 4) + "\n";
    // Write it the way Prettier would, so `prettier --check` in ci.sh passes.
    try {
        const prettier = require("prettier");
        const options = prettier.resolveConfig.sync(BASELINE_PATH) || {};
        text = prettier.format(text, { ...options, filepath: BASELINE_PATH });
    } catch (_e) {
        // Prettier isn't installed: keep the plain JSON
    }
    fs.writeFileSync(BASELINE_PATH, text, "utf8");
}

function main() {
    const args = new Set(process.argv.slice(2));
    const violations = collectAllViolations();
    const current = toBaselineShape(violations);

    if (args.has("--update-baseline")) {
        writeBaseline(current);
        const total = violations.length;
        console.log(
            `[safelist] Baseline updated. ${total} known violation${
                total === 1 ? "" : "s"
            } grandfathered across ${Object.keys(current).length} file${
                Object.keys(current).length === 1 ? "" : "s"
            }.`
        );
        process.exit(0);
    }

    const baseline = readBaseline();
    const newViolations = [];
    for (const v of violations) {
        const baselineForFile = new Set(baseline[v.file] || []);
        if (!baselineForFile.has(v.class)) newViolations.push(v);
    }

    if (newViolations.length === 0) {
        const total = violations.length;
        console.log(
            `[safelist] OK. ${total} grandfathered violation${
                total === 1 ? "" : "s"
            } unchanged; no new ones.`
        );
        process.exit(0);
    }

    console.error(
        `[safelist] FAIL: ${newViolations.length} new safelist violation${
            newViolations.length === 1 ? "" : "s"
        } not in baseline:`
    );
    for (const v of newViolations) {
        console.error(`  ${v.file}:${v.line}  ${v.class}  (${v.kind})`);
    }
    console.error("");
    console.error("Either:");
    console.error(
        "  - Replace with safelist-compliant classes (bg/text/border/from/via/to-{color}-{shade})."
    );
    console.error(
        "  - Or, if intentional (the class is in the safelist or built some other way), run:"
    );
    console.error(
        "      node scripts/check-tailwind-safelist.js --update-baseline"
    );
    process.exit(1);
}

main();
