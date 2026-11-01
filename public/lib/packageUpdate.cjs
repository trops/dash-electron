/**
 * packageUpdate.cjs — "Update original" in the Widget Builder for a widget
 * from one of the user's own packages (not @ai-built): the whole package is
 * rebuilt with the edited widget and reinstalled under its own name.
 *
 *   bumpLocalVersion(version)  → the next local version: "0.0.911" →
 *       "0.0.912-local.1", "0.0.912-local.1" → "0.0.912-local.2". A real
 *       0.0.912 from the registry still counts as newer.
 *   prepareUpdateBuild({ sourcePath, buildDir, widgetName, componentCode,
 *       configCode }) → { version } — a full copy of the installed package
 *       (every widget, shared file and setting) with the edited widget
 *       written over it, old bundles dropped and the version bumped. The
 *       installed package isn't touched.
 *   installWithBackup({ packagePath, backupRoot, install }) — moves the
 *       installed package aside, runs install(); on failure puts it back,
 *       on success removes the backup.
 */
"use strict";

const fs = require("fs");
const path = require("path");

function bumpLocalVersion(version) {
    const m = /^(\d+)\.(\d+)\.(\d+)(?:-local\.(\d+))?$/.exec(
        String(version || "").trim()
    );
    if (!m) return "1.0.1-local.1";
    const [, major, minor, patch, local] = m;
    if (local) return `${major}.${minor}.${patch}-local.${Number(local) + 1}`;
    return `${major}.${minor}.${Number(patch) + 1}-local.1`;
}

/**
 * The next version of an @ai-built widget: every install is a new one, so
 * what runs can be told apart ("1.0.0", then "1.0.1", …).
 */
function nextBuildVersion(previous) {
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(previous || "").trim());
    if (!m) return "1.0.0";
    return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

const versionParts = (v) =>
    (/^(\d+)\.(\d+)\.(\d+)/.exec(String(v || "")) || []).slice(1).map(Number);

/**
 * The installed version of a package: the higher of its dash.json and
 * package.json (they can disagree), so the next one never goes backwards.
 */
function installedVersion(packagePath) {
    if (!packagePath) return null;
    let best = null;
    for (const file of ["dash.json", "package.json"]) {
        try {
            const v = JSON.parse(
                fs.readFileSync(path.join(packagePath, file), "utf8")
            ).version;
            const p = versionParts(v);
            if (p.length !== 3) continue;
            const b = versionParts(best);
            if (
                !best ||
                p[0] > b[0] ||
                (p[0] === b[0] &&
                    (p[1] > b[1] || (p[1] === b[1] && p[2] > b[2])))
            ) {
                best = v;
            }
        } catch (_) {
            // not there: the next file
        }
    }
    return best;
}

// A package's built bundles: left in place, an install takes them as its
// own build and never compiles the new code.
const STALE_BUNDLES = ["dist", "index.cjs.js", "index.cjs.css"];
function purgeStaleBundles(buildDir) {
    for (const stale of STALE_BUNDLES) {
        fs.rmSync(path.join(buildDir, stale), { recursive: true, force: true });
    }
}

function bumpJson(file, version) {
    if (!fs.existsSync(file)) return;
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    json.version = version;
    fs.writeFileSync(file, JSON.stringify(json, null, 2));
}

function prepareUpdateBuild({
    sourcePath,
    buildDir,
    widgetName,
    componentCode,
    configCode,
}) {
    fs.cpSync(sourcePath, buildDir, { recursive: true });
    // The fresh build must be the bundle that loads (dist/ wins over the
    // root, and a stale root bundle would linger).
    purgeStaleBundles(buildDir);
    const widgetsDir = path.join(buildDir, "widgets");
    fs.mkdirSync(widgetsDir, { recursive: true });
    fs.writeFileSync(path.join(widgetsDir, `${widgetName}.js`), componentCode);
    fs.writeFileSync(
        path.join(widgetsDir, `${widgetName}.dash.js`),
        configCode
    );
    // Packaged copies of the config, when the package has them.
    const packaged = path.join(
        buildDir,
        "configs",
        "widgets",
        `${widgetName}.dash.js`
    );
    if (fs.existsSync(packaged)) fs.writeFileSync(packaged, configCode);
    const manifest = path.join(buildDir, "dash.json");
    const current = fs.existsSync(manifest)
        ? JSON.parse(fs.readFileSync(manifest, "utf8")).version
        : undefined;
    const version = bumpLocalVersion(current);
    bumpJson(manifest, version);
    bumpJson(path.join(buildDir, "package.json"), version);
    return { version };
}

async function installWithBackup({ packagePath, backupRoot, install }) {
    fs.mkdirSync(backupRoot, { recursive: true });
    const backup = path.join(backupRoot, `backup-${Date.now()}`);
    const had = fs.existsSync(packagePath);
    if (had) fs.cpSync(packagePath, backup, { recursive: true });
    try {
        const result = await install();
        fs.rmSync(backup, { recursive: true, force: true });
        return result;
    } catch (err) {
        if (had) {
            fs.rmSync(packagePath, { recursive: true, force: true });
            fs.cpSync(backup, packagePath, { recursive: true });
            fs.rmSync(backup, { recursive: true, force: true });
        }
        throw err;
    }
}

module.exports = {
    bumpLocalVersion,
    nextBuildVersion,
    installedVersion,
    purgeStaleBundles,
    prepareUpdateBuild,
    installWithBackup,
};
