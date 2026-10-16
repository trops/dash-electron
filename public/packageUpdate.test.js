/**
 * packageUpdate.test.js — "Update original" on a widget from one of the
 * user's own packages rebuilds that package: a full copy with the edited
 * widget, a local version bump, and the installed package kept safe until
 * the new one is in (Widget Builder edit fixes).
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
    bumpLocalVersion,
    prepareUpdateBuild,
    installWithBackup,
} = require("./lib/packageUpdate.cjs");

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

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
    it("on success the backup is removed", async () => {
        const pkg = installedPackage();
        const backups = tmp("zz-bak-");
        try {
            const res = await installWithBackup({
                packagePath: pkg,
                backupRoot: backups,
                install: async () => ({ ok: true }),
            });
            assert.deepEqual(res, { ok: true });
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
});
