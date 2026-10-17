/**
 * installGate.cjs — the code checks every package install runs (consolidation
 * Phase 1a). dash-core's widget registry calls it on the staged package
 * (setInstallGate) before the installed one is touched — registry, file and
 * folder installs, updates, drafts and the Widget Builder's installs alike —
 * and on installed packages at startup (checkInstalled). dash-core builds
 * the package itself; this adds the widget code checks.
 *
 * The whole package's source, at any depth (Phase 1a-2): each widget
 * (<Name>.dash.js with its <Name>.js / .jsx) and every other .js / .jsx
 * file — shared utils/, hooks/, contexts/ included. Builds (dist/, the
 * bundle at the root), node_modules and dot-files aren't source; tests and
 * stories aren't either, unless something imports them.
 *
 * @param {string} dir  the staged package folder
 * @returns {Promise<{ ok: boolean, problems: string[], sourceFiles: number }>}
 *   each problem is "<Widget>: <what's wrong>" or "<path>: <what's wrong>";
 *   sourceFiles = how many source files were checked (0: none came with it)
 */
const fs = require("fs");
const path = require("path");
const {
    codeProblems,
    helperProblems,
    NOT_WIDGET_CODE,
} = require("./teamWidgetTools.cjs");

// The build at the package root (dash-core findBundlePath), not source.
const ROOT_BUILDS = new Set(["index.js", "index.cjs.js", "index.esm.js"]);
const CODE = /\.(?:js|jsx)$/;

/** Every file under dir that could be source, "/"-separated. */
function sourceFilesUnder(dir, rel = "") {
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
        if (e.isDirectory()) out.push(...sourceFilesUnder(dir, child));
        else if (e.isFile() && CODE.test(e.name)) out.push(child);
    }
    return out;
}

/** The package files that `from` imports relatively ("./x", "../lib/y"). */
function importsOf(from, source, files) {
    const found = new Set();
    const re =
        /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)["'](\.{1,2}\/[^"']+)["']/gm;
    let m;
    while ((m = re.exec(source))) {
        const base = path.posix.normalize(
            path.posix.join(path.posix.dirname(from), m[1])
        );
        for (const candidate of [
            base,
            `${base}.js`,
            `${base}.jsx`,
            `${base}/index.js`,
            `${base}/index.jsx`,
        ]) {
            if (files.has(candidate)) found.add(candidate);
        }
    }
    return found;
}

async function installGate(dir) {
    const files = sourceFilesUnder(dir).sort();
    const all = new Set(files);
    const read = (rel) => fs.readFileSync(path.join(dir, rel), "utf8");
    const problems = [];

    // Widgets: a config beside its component.
    const components = new Set();
    for (const config of files.filter((f) => f.endsWith(".dash.js"))) {
        const base = config.slice(0, -".dash.js".length);
        const component = [`${base}.js`, `${base}.jsx`].find((f) => all.has(f));
        if (!component) continue;
        components.add(component);
        const name = path.posix.basename(base);
        for (const p of codeProblems(read(component), read(config))) {
            problems.push(`${name}: ${p}`);
        }
    }

    // Everything else is a helper — tests and stories only when imported.
    const code = files.filter((f) => !f.endsWith(".dash.js"));
    const imported = new Set();
    for (const f of code.filter((f) => !NOT_WIDGET_CODE.test(f))) {
        for (const i of importsOf(f, read(f), all)) imported.add(i);
    }
    const helpers = code
        .filter((f) => !components.has(f))
        .filter((f) => !NOT_WIDGET_CODE.test(f) || imported.has(f))
        .map((f) => ({ path: f, content: read(f) }));
    problems.push(...helperProblems(helpers, { includeTests: true }));

    return {
        ok: problems.length === 0,
        problems,
        sourceFiles: components.size + helpers.length,
    };
}

module.exports = { installGate };
