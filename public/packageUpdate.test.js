/**
 * packageUpdate.test.js — "Update original" on a widget from one of the
 * user's own packages rebuilds that package: a full copy with the edited
 * widget, a local version bump, and the installed package kept safe until
 * the new one is in (Widget Builder edit fixes).
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
    bumpLocalVersion,
    nextBuildVersion,
    installedVersion,
    prepareUpdateBuild,
    installWithBackup,
} = require("./lib/packageUpdate.cjs");
const { tempDir } = require("../scripts/testUtils/tempDir");

// Removed when the test process exits.
const tmp = (p) => tempDir(p);

function installedPackage() {
    const dir = tmp("zz-pkg-");
    fs.mkdirSync(path.join(dir, "widgets"));
    fs.mkdirSync(path.join(dir, "configs", "widgets"), { recursive: true });
    fs.writeFileSync(path.join(dir, "widgets", "AlgoliaHits.js"), "old hits");
    fs.writeFileSync(
        path.join(dir, "widgets", "AlgoliaHits.dash.js"),
        "old cfg"
    );
    fs.writeFileSync(
        path.join(dir, "configs", "widgets", "AlgoliaHits.dash.js"),
        "old cfg"
    );
    fs.writeFileSync(
        path.join(dir, "widgets", "AlgoliaPagination.dash.js"),
        "pg cfg"
    );
    fs.writeFileSync(
        path.join(dir, "widgets", "algoliaProviderConfig.js"),
        "shared"
    );
    fs.writeFileSync(path.join(dir, "index.cjs.js"), "old bundle");
    fs.mkdirSync(path.join(dir, "dist"));
    fs.writeFileSync(path.join(dir, "dist", "index.cjs.js"), "old dist");
    fs.writeFileSync(
        path.join(dir, "dash.json"),
        JSON.stringify({ name: "algolia-search", version: "0.0.911" })
    );
    return dir;
}

describe("bumpLocalVersion", () => {
    it("a published version gets the next patch, marked local", () => {
        assert.equal(bumpLocalVersion("0.0.911"), "0.0.912-local.1");
        assert.equal(bumpLocalVersion("1.4.0"), "1.4.1-local.1");
    });
    it("a local version counts up", () => {
        assert.equal(bumpLocalVersion("0.0.912-local.1"), "0.0.912-local.2");
        assert.equal(bumpLocalVersion("0.0.912-local.9"), "0.0.912-local.10");
    });
    it("no or odd version starts at 1.0.1-local.1", () => {
        assert.equal(bumpLocalVersion(undefined), "1.0.1-local.1");
        assert.equal(bumpLocalVersion("latest"), "1.0.1-local.1");
    });
});

describe("nextBuildVersion (every @ai-built install is a new version)", () => {
    it("first install 1.0.0, then each install one more", () => {
        assert.equal(nextBuildVersion(null), "1.0.0");
        assert.equal(nextBuildVersion("1.0.0"), "1.0.1");
        assert.equal(nextBuildVersion("2.3.9"), "2.3.10");
        assert.equal(nextBuildVersion("1.0.4-local.2"), "1.0.5");
    });

    it("reads the installed version from dash.json, else package.json", () => {
        const dir = tmp("dash-ver-");
        assert.equal(installedVersion(dir), null);
        fs.writeFileSync(
            path.join(dir, "package.json"),
            JSON.stringify({ version: "1.0.2" })
        );
        assert.equal(installedVersion(dir), "1.0.2");
        fs.writeFileSync(
            path.join(dir, "dash.json"),
            JSON.stringify({ version: "1.0.3" })
        );
        assert.equal(installedVersion(dir), "1.0.3");
        assert.equal(installedVersion(null), null);
    });

    it("the higher of dash.json and package.json, so the next never goes back", () => {
        const dir = tmp("zz-ver-");
        fs.writeFileSync(
            path.join(dir, "dash.json"),
            JSON.stringify({ version: "1.0.0" })
        );
        fs.writeFileSync(
            path.join(dir, "package.json"),
            JSON.stringify({ version: "1.0.4-local.1" })
        );
        assert.equal(installedVersion(dir), "1.0.4-local.1");
        assert.equal(nextBuildVersion(installedVersion(dir)), "1.0.5");
    });
});

describe("prepareUpdateBuild", () => {
    it("copies the whole package, writes the edited widget, drops old bundles, bumps the version", () => {
        const src = installedPackage();
        const build = path.join(tmp("zz-build-"), "pkg");
        try {
            const res = prepareUpdateBuild({
                sourcePath: src,
                buildDir: build,
                widgetName: "AlgoliaHits",
                componentCode: "new hits",
                configCode: "new cfg",
            });
            assert.equal(res.version, "0.0.912-local.1");
            const read = (...p) =>
                fs.readFileSync(path.join(build, ...p), "utf8");
            assert.equal(read("widgets", "AlgoliaHits.js"), "new hits");
            assert.equal(read("widgets", "AlgoliaHits.dash.js"), "new cfg");
            assert.equal(
                read("configs", "widgets", "AlgoliaHits.dash.js"),
                "new cfg"
            );
            // The rest of the package is kept: other widgets, shared files.
            assert.equal(
                read("widgets", "AlgoliaPagination.dash.js"),
                "pg cfg"
            );
            assert.equal(read("widgets", "algoliaProviderConfig.js"), "shared");
            // Old bundles go, so the fresh build is the one loaded.
            assert.equal(fs.existsSync(path.join(build, "dist")), false);
            assert.equal(
                fs.existsSync(path.join(build, "index.cjs.js")),
                false
            );
            assert.equal(
                JSON.parse(read("dash.json")).version,
                "0.0.912-local.1"
            );
            assert.equal(JSON.parse(read("dash.json")).name, "algolia-search");
            // The installed package itself is untouched.
            assert.equal(
                fs.readFileSync(
                    path.join(src, "widgets", "AlgoliaHits.js"),
                    "utf8"
                ),
                "old hits"
            );
        } finally {
            fs.rmSync(src, { recursive: true, force: true });
            fs.rmSync(path.dirname(build), { recursive: true, force: true });
        }
    });

    it("bumps package.json too when the package has one", () => {
        const src = installedPackage();
        fs.writeFileSync(
            path.join(src, "package.json"),
            JSON.stringify({
                name: "@trops/algolia-search",
                version: "0.0.911",
            })
        );
        const build = path.join(tmp("zz-build-"), "pkg");
        try {
            prepareUpdateBuild({
                sourcePath: src,
                buildDir: build,
                widgetName: "AlgoliaHits",
                componentCode: "c",
                configCode: "d",
            });
            const pj = JSON.parse(
                fs.readFileSync(path.join(build, "package.json"), "utf8")
            );
            assert.equal(pj.version, "0.0.912-local.1");
        } finally {
            fs.rmSync(src, { recursive: true, force: true });
            fs.rmSync(path.dirname(build), { recursive: true, force: true });
        }
    });
});

describe("installWithBackup", () => {
    it("backs up into its own folder; on success the folder is removed", async () => {
        const pkg = installedPackage();
        const backups = tmp("zz-bak-");
        try {
            let during = null;
            const res = await installWithBackup({
                packagePath: pkg,
                backupRoot: backups,
                install: async () => {
                    during = fs.readdirSync(backups);
                    assert.equal(
                        fs.readFileSync(
                            path.join(
                                backups,
                                during[0],
                                "package",
                                "widgets",
                                "AlgoliaHits.js"
                            ),
                            "utf8"
                        ),
                        "old hits"
                    );
                    return { ok: true };
                },
            });
            assert.deepEqual(res, { ok: true });
            assert.equal(during.length, 1);
            assert.match(during[0], /^dash-widget-update-backup-/);
            assert.deepEqual(fs.readdirSync(backups), []);
        } finally {
            fs.rmSync(pkg, { recursive: true, force: true });
            fs.rmSync(backups, { recursive: true, force: true });
        }
    });

    it("on failure the installed package is put back as it was", async () => {
        const pkg = installedPackage();
        const backups = tmp("zz-bak-");
        try {
            await assert.rejects(
                installWithBackup({
                    packagePath: pkg,
                    backupRoot: backups,
                    install: async () => {
                        // The installer removes the old folder first, then fails.
                        fs.rmSync(pkg, { recursive: true, force: true });
                        throw new Error("copy failed");
                    },
                }),
                /copy failed/
            );
            assert.equal(
                fs.readFileSync(
                    path.join(pkg, "widgets", "AlgoliaHits.js"),
                    "utf8"
                ),
                "old hits"
            );
            assert.deepEqual(fs.readdirSync(backups), []);
        } finally {
            fs.rmSync(pkg, { recursive: true, force: true });
            fs.rmSync(backups, { recursive: true, force: true });
        }
    });

    it("with no package installed yet, install runs and nothing is left", async () => {
        const backups = tmp("zz-bak-");
        const missing = path.join(backups, "not-installed");
        try {
            await assert.rejects(
                installWithBackup({
                    packagePath: missing,
                    backupRoot: backups,
                    install: async () => {
                        throw new Error("nope");
                    },
                }),
                /nope/
            );
            assert.equal(fs.existsSync(missing), false);
            assert.deepEqual(fs.readdirSync(backups), []);
        } finally {
            fs.rmSync(backups, { recursive: true, force: true });
        }
    });

    it("backs up under os.tmpdir() by default and removes the folder", async () => {
        const pkg = installedPackage();
        const root = tmp("zz-bak-default-");
        const saved = process.env.TMPDIR;
        // os.tmpdir() follows TMPDIR, so the default root is this folder.
        process.env.TMPDIR = root;
        try {
            let during = null;
            await installWithBackup({
                packagePath: pkg,
                install: async () => {
                    during = fs.readdirSync(root);
                },
            });
            assert.equal(during.length, 1);
            assert.match(during[0], /^dash-widget-update-backup-/);
            assert.deepEqual(fs.readdirSync(root), []);
        } finally {
            if (saved === undefined) delete process.env.TMPDIR;
            else process.env.TMPDIR = saved;
            fs.rmSync(pkg, { recursive: true, force: true });
            fs.rmSync(root, { recursive: true, force: true });
        }
    });
});
