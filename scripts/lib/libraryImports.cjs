/**
 * libraryImports.cjs — the npm libraries a widget package's source imports
 * (consolidation Phase 1a-3). scripts/packageZip.js records them, with the
 * versions installed in this repo, in the zip's package.json
 * `dependencies`; installers download them and build the checked source
 * with them.
 *
 * Twin of dash-core electron/utils/libraryImports.js (the app records the
 * same at in-app publish) — keep them the same (libraryImports.test.js).
 */
const fs = require("fs");
const path = require("path");
const { builtinModules } = require("module");

// Provided by the host app via MODULE_MAP in widgetBundleLoader.js — never
// bundled, never downloaded.
const HOST_PROVIDED = [
    "react",
    "react-dom",
    "@trops/dash-react",
    "@trops/dash-core",
    "react/jsx-runtime",
    "prop-types",
];

const isHostProvided = (spec) =>
    HOST_PROVIDED.some((h) => spec === h || spec.startsWith(`${h}/`));

/** A library's package name: "@scope/name" or "name" from an import. */
function packageNameOf(spec) {
    const parts = String(spec).split("/");
    return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

const BUILTINS = new Set(builtinModules);
const isBuiltin = (spec) =>
    spec.startsWith("node:") || BUILTINS.has(packageNameOf(spec));

// Not the package's source: builds, installed libraries, dot-files.
const ROOT_BUILDS = new Set(["index.js", "index.cjs.js", "index.esm.js"]);
// Tests and stories ship in some packages but aren't widget code.
const NOT_WIDGET_CODE = /(?:^|\/)__tests__\/|\.(?:test|spec|stories)\.[jt]sx?$/;
const CODE = /\.(?:js|jsx|ts|tsx|mjs|cjs)$/;

function sourceFiles(dir, rel = "") {
    let entries;
    try {
        entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
    } catch (_e) {
        return [];
    }
    const out = [];
    for (const e of entries) {
        if (e.name.startsWith(".") || e.name === "node_modules") continue;
        if (!rel && (e.name === "dist" || ROOT_BUILDS.has(e.name))) continue;
        const child = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) out.push(...sourceFiles(dir, child));
        else if (
            e.isFile() &&
            CODE.test(e.name) &&
            !NOT_WIDGET_CODE.test(child)
        )
            out.push(child);
    }
    return out;
}

/**
 * Which characters of a source file are code — not inside a comment or a
 * string. A quote not closed on its line isn't a string (an apostrophe in
 * JSX text).
 */
function codeMask(src) {
    const code = new Array(src.length).fill(true);
    let i = 0;
    while (i < src.length) {
        const c = src[i];
        const n = src[i + 1];
        if (c === "/" && n === "/") {
            while (i < src.length && src[i] !== "\n") code[i++] = false;
        } else if (c === "/" && n === "*") {
            const end = src.indexOf("*/", i + 2);
            const stop = end < 0 ? src.length : end + 2;
            while (i < stop) code[i++] = false;
        } else if (c === "'" || c === '"' || c === "`") {
            let j = i + 1;
            while (j < src.length && src[j] !== c) {
                if (src[j] === "\\") j += 1;
                else if (src[j] === "\n" && c !== "`") break;
                j += 1;
            }
            if (src[j] === c) {
                for (let k = i + 1; k < j; k++) code[k] = false;
                i = j + 1;
            } else {
                i += 1;
            }
        } else {
            i += 1;
        }
    }
    return code;
}

// import … from "x" / export … from "x" (a statement at the start of a
// line, possibly spanning lines), import "x", require("x"), import("x").
const IMPORTS = [
    /^[ \t]*(?:import|export)\b[^;'"`]*?\bfrom\s*["']([^"'\n]+)["']/gm,
    /^[ \t]*import\s*["']([^"'\n]+)["']/gm,
    /\b(?:require|import)\s*\(\s*["']([^"'\n]+)["']\s*\)/g,
];
// npm's package-name rules (older packages may use capitals).
const VALID_NAME = /^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/i;

/**
 * The libraries a package's source imports — not the app's own (React,
 * dash-react…), relative files, Node's modules, builds or tests; only real
 * import statements, not text that looks like one.
 * → sorted package names.
 */
function findLibraryImports(dir) {
    const found = new Set();
    for (const rel of sourceFiles(dir)) {
        const source = fs.readFileSync(path.join(dir, rel), "utf8");
        const code = codeMask(source);
        for (const re of IMPORTS) {
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(source))) {
                const at = m.index + m[0].search(/\S/);
                if (!code[at]) continue;
                const spec = m[1];
                if (
                    /^[./]/.test(spec) ||
                    isBuiltin(spec) ||
                    isHostProvided(spec)
                ) {
                    continue;
                }
                const name = packageNameOf(spec);
                if (VALID_NAME.test(name)) found.add(name);
            }
        }
    }
    return [...found].sort();
}

/** The version of a library installed in one of `paths` (node_modules). */
function installedVersion(name, paths) {
    for (const p of paths || []) {
        const file = path.join(p, ...name.split("/"), "package.json");
        try {
            const v = JSON.parse(fs.readFileSync(file, "utf8")).version;
            if (typeof v === "string" && v) return v;
        } catch (_e) {
            // not here
        }
    }
    return null;
}

/**
 * The dependencies to record for a package: what its package.json lists
 * already (kept as written), plus each library its source imports at the
 * version installed in `paths`. → { dependencies, missing: [names] }.
 */
function libraryDependencies(dir, paths) {
    let listed = {};
    try {
        const pkg = JSON.parse(
            fs.readFileSync(path.join(dir, "package.json"), "utf8")
        );
        if (pkg && pkg.dependencies && typeof pkg.dependencies === "object") {
            listed = pkg.dependencies;
        }
    } catch (_e) {
        // no package.json yet
    }
    const dependencies = { ...listed };
    const missing = [];
    for (const name of findLibraryImports(dir)) {
        if (!dependencies[name]) {
            const v = installedVersion(name, paths);
            if (v) dependencies[name] = v;
            else missing.push(name);
        }
    }
    return { dependencies, missing };
}

module.exports = {
    HOST_PROVIDED,
    isHostProvided,
    packageNameOf,
    findLibraryImports,
    installedVersion,
    libraryDependencies,
};
