/**
 * widgetImports — what a widget imports from Dash's own packages has to
 * exist there. A name dash-react doesn't export compiles fine (the bundle
 * keeps it as a lookup) and is undefined when the widget renders: React
 * throws "Element type is invalid … got: undefined". Seen live: the Builder
 * wrote `import { Widget } from "@trops/dash-react"` (Widget is
 * dash-core's), and the Checker passed it.
 *
 * The export lists come from the installed packages' own builds — their
 * top-level `export { … }` statements (a line of their own; the same text
 * inside a prompt or an example doesn't count) and what their
 * `export * from "…"` passes on (dash-core passes on all of dash-react;
 * dash-react the Font Awesome icons) — read once. If any part can't be
 * read, that package's imports aren't checked — never a false failure.
 *
 * Used by the Dash team's build_widget and check_widget (teamWidgetTools);
 * not by the install gate, so widgets people already have are untouched.
 */
const fs = require("fs");
const path = require("path");

const PACKAGES = ["@trops/dash-react", "@trops/dash-core"];
// The ESM build next to what require() finds, when there is one.
const ESM_SIBLINGS = ["index.esm.js", "index.mjs", "index.js"];

const IDENT = "[A-Za-z_$][\\w$]*";

/**
 * A build's own exports: the names in its top-level `export { a, b as c }`
 * statements (`… from "x"` ones too), and the packages its
 * `export * from "x"` passes on. A CommonJS build's `exports.Name =` when
 * it has no ESM statements.
 */
function exportedNames(source) {
    const names = new Set();
    const stars = [];
    const text = String(source || "");
    const list = /^export\s*\{([^}]*)\}(?:\s*from\s*["'][^"']+["'])?\s*;?/gm;
    let m;
    while ((m = list.exec(text))) {
        for (const part of m[1].split(",")) {
            const p = part.trim();
            if (!p) continue;
            const alias = p.match(new RegExp(`\\s+as\\s+(${IDENT})$`));
            names.add(alias ? alias[1] : p.split(/\s+/)[0]);
        }
    }
    const star = /^export\s*\*\s*from\s*["']([^"']+)["']/gm;
    while ((m = star.exec(text))) stars.push(m[1]);
    if (!names.size && !stars.length) {
        const cjs = new RegExp(`\\bexports\\.(${IDENT})\\s*=`, "g");
        while ((m = cjs.exec(text))) names.add(m[1]);
    }
    names.delete("default");
    return { names, stars };
}

/** The package's build file(s) to read: its ESM build first. */
function buildFiles(pkg, resolve) {
    let main;
    try {
        main = resolve(pkg);
    } catch (_e) {
        return [];
    }
    const dir = path.dirname(main);
    return [...ESM_SIBLINGS.map((f) => path.join(dir, f)), main].filter(
        (f, i, all) => all.indexOf(f) === i
    );
}

/**
 * Everything a package exports, with what it passes on from others — or
 * null if any of it can't be read.
 */
function readExports(pkg, io, depth = 0) {
    if (depth > 3) return null;
    for (const file of buildFiles(pkg, io.resolve)) {
        let source;
        try {
            source = io.read(file);
        } catch (_e) {
            continue;
        }
        const { names, stars } = exportedNames(source);
        if (!names.size && !stars.length) continue;
        for (const target of stars) {
            const passed = readExports(target, io, depth + 1);
            if (!passed) return null;
            for (const n of passed) names.add(n);
        }
        return names;
    }
    return null;
}

/**
 * What each package exports: { [pkg]: Set<string> }, without the packages
 * whose exports couldn't all be read. Cached per process.
 */
let cached = null;
function packageExports({
    resolve = require.resolve,
    read = (f) => fs.readFileSync(f, "utf8"),
} = {}) {
    if (cached && resolve === require.resolve) return cached;
    const out = {};
    for (const pkg of PACKAGES) {
        const names = readExports(pkg, { resolve, read });
        if (names && names.size) out[pkg] = names;
    }
    if (resolve === require.resolve) cached = out;
    return out;
}

function lineOf(source, idx) {
    return String(source).slice(0, idx).split("\n").length;
}

/**
 * Named imports from Dash's packages that the package doesn't export.
 * @param {string} code  a widget's source
 * @param {{ [pkg]: Set<string> }} [exportsByPackage]  packageExports()
 * @returns {{ ok, errors: [{ name, from, line, suggestion }] }}
 */
function validateImportedNames(code, exportsByPackage = packageExports()) {
    const errors = [];
    // A commented-out import isn't one.
    const source = String(code || "")
        .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
        .replace(/^\s*\/\/[^\n]*/gm, (c) => c.replace(/[^\n]/g, " "));
    const re = new RegExp(
        `import\\s+(?:${IDENT}\\s*,\\s*)?\\{([^}]*)\\}\\s*from\\s*["']([^"']+)["']`,
        "g"
    );
    let m;
    while ((m = re.exec(source))) {
        const from = m[2];
        const known = exportsByPackage[from];
        if (!known) continue;
        // Comments in the list aren't names.
        const list = m[1]
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/\/\/[^\n]*/g, "");
        for (const part of list.split(",")) {
            const p = part.trim();
            if (!p || p.startsWith("type ")) continue;
            const name = p.split(/\s+/)[0];
            if (known.has(name)) continue;
            const elsewhere = Object.keys(exportsByPackage).find(
                (pkg) => pkg !== from && exportsByPackage[pkg].has(name)
            );
            errors.push({
                name,
                from,
                line: lineOf(source, m.index),
                suggestion: elsewhere
                    ? `import it from ${elsewhere}`
                    : `use one ${from} has`,
            });
        }
    }
    return { ok: errors.length === 0, errors };
}

module.exports = {
    exportedNames,
    packageExports,
    validateImportedNames,
};
