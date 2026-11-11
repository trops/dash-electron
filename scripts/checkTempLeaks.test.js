/**
 * checkTempLeaks.test.js — the CI temp-leak guard fails on new test-named
 * entries in os.tmpdir() and passes when a command cleans up after itself.
 *
 * Each guard run gets a private temp dir (TMPDIR, which os.tmpdir()
 * follows): `node --test` runs test files at the same time, and their
 * zz-* folders in the shared temp dir would otherwise look like leaks to
 * the inner guard.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { isTestEntry, newLeaks } = require("./checkTempLeaks");

const GUARD = path.join(__dirname, "checkTempLeaks.js");

// Runs the guard around `node -e <code>` with its own temp dir; `code`
// gets the dir as process.env.TMPDIR / os.tmpdir().
function runGuard(code) {
    const privateTmp = fs.mkdtempSync(
        path.join(os.tmpdir(), "zz-leakcheck-tmp-")
    );
    try {
        const res = spawnSync(
            process.execPath,
            [GUARD, "--", process.execPath, "-e", code],
            {
                encoding: "utf8",
                env: { ...process.env, TMPDIR: privateTmp },
            }
        );
        return { ...res, tmp: privateTmp };
    } finally {
        fs.rmSync(privateTmp, { recursive: true, force: true });
    }
}

describe("checkTempLeaks", () => {
    it("knows the test prefixes", () => {
        assert.ok(isTestEntry("zz-gate-abc123"));
        assert.ok(isTestEntry("skill-123.md"));
        assert.ok(isTestEntry("dash-ai-build-Foo-1700000000000"));
        assert.ok(isTestEntry("dash-ai-update-Foo-1700000000000"));
        assert.ok(isTestEntry("dash-validate-widget-abc123"));
        assert.ok(isTestEntry("dash-widget-update-backups"));
        assert.ok(isTestEntry("dash-widget-update-backup-abc123"));
        assert.ok(!isTestEntry("com.apple.launchd.xyz"));
        assert.ok(!isTestEntry("playwright-artifacts-abc"));
    });

    it("newLeaks ignores entries that were there before", () => {
        const name = `zz-leakcheck-old-${process.pid}`;
        const p = path.join(os.tmpdir(), name);
        fs.mkdirSync(p);
        try {
            const before = new Set([name]);
            assert.deepEqual(
                newLeaks(os.tmpdir(), before, Date.now() - 5000).filter(
                    (n) => n === name
                ),
                []
            );
        } finally {
            fs.rmSync(p, { recursive: true, force: true });
        }
    });

    it("fails, naming the entry, when the command leaves one behind", () => {
        const name = `zz-leakcheck-${process.pid}-${Date.now()}`;
        const res = runGuard(
            `const fs = require("fs"), os = require("os"), path = require("path");
             fs.mkdirSync(path.join(os.tmpdir(), ${JSON.stringify(name)}));`
        );
        assert.equal(res.status, 1, res.stderr);
        assert.match(res.stderr, new RegExp(name));
        assert.ok(res.stderr.includes(res.tmp), res.stderr);
    });

    it("passes when the command cleans up, and passes its exit code through", () => {
        const ok = runGuard(
            `const fs = require("fs"), os = require("os"), path = require("path");
             const p = path.join(os.tmpdir(), "zz-leakcheck-clean");
             fs.mkdirSync(p);
             fs.rmSync(p, { recursive: true });`
        );
        assert.equal(ok.status, 0, ok.stderr);
        assert.equal(runGuard("process.exit(3)").status, 3);
    });
});
