/**
 * installGate.cjs — the code checks every package install runs (consolidation
 * Phase 1a). dash-core's widget registry calls it on the staged package
 * (setInstallGate) before the installed one is touched — registry, file and
 * folder installs, updates, drafts and the Widget Builder's installs alike.
 * dash-core builds the package itself; this adds the widget code checks.
 *
 * @param {string} dir  the staged package folder
 * @returns {Promise<{ ok: boolean, problems: string[] }>} each problem is
 *   "<Widget>: <what's wrong>"
 */
const fs = require("fs");
const path = require("path");
const { codeProblems } = require("./teamWidgetTools.cjs");

function widgetsDir(dir) {
    const own = path.join(dir, "widgets");
    return fs.existsSync(own) && fs.statSync(own).isDirectory() ? own : null;
}

async function installGate(dir) {
    const widgets = widgetsDir(dir);
    if (!widgets) return { ok: true, problems: [] };
    const problems = [];
    for (const file of fs.readdirSync(widgets).sort()) {
        if (!file.endsWith(".dash.js")) continue;
        const name = file.slice(0, -".dash.js".length);
        const componentPath = path.join(widgets, `${name}.js`);
        if (!fs.existsSync(componentPath)) continue;
        const found = codeProblems(
            fs.readFileSync(componentPath, "utf8"),
            fs.readFileSync(path.join(widgets, file), "utf8")
        );
        for (const p of found) problems.push(`${name}: ${p}`);
    }
    return { ok: problems.length === 0, problems };
}

module.exports = { installGate };
