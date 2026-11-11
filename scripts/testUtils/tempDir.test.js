/**
 * tempDir.test.js — the test temp-folder helper makes folders in the OS
 * temp dir and removes them all, both on demand and when the process exits.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { tempDir, tempFile, cleanupTempDirs } = require("./tempDir");

describe("tempDir helper", () => {
    it("tempDir makes an empty folder in os.tmpdir() with the prefix", () => {
        const dir = tempDir("zz-helper-");
        assert.equal(path.dirname(dir), os.tmpdir());
        assert.ok(path.basename(dir).startsWith("zz-helper-"));
        assert.deepEqual(fs.readdirSync(dir), []);
        cleanupTempDirs();
        assert.equal(fs.existsSync(dir), false);
    });

    it("tempFile gives a writable path inside a remembered folder", () => {
        const file = tempFile("skill-", ".md");
        assert.ok(file.endsWith(".md"));
        fs.writeFileSync(file, "# x");
        const dir = path.dirname(file);
        assert.ok(path.basename(dir).startsWith("skill-"));
        cleanupTempDirs();
        assert.equal(fs.existsSync(dir), false);
    });

    it("removes everything when the process exits", () => {
        const helper = require.resolve("./tempDir");
        const out = execFileSync(
            process.execPath,
            [
                "-e",
                `const { tempDir, tempFile } = require(${JSON.stringify(
                    helper
                )});` +
                    `const fs = require("fs");` +
                    `const d = tempDir("zz-exit-");` +
                    `fs.mkdirSync(require("path").join(d, "a", "b"), { recursive: true });` +
                    `const f = tempFile("zz-exit-", ".txt");` +
                    `fs.writeFileSync(f, "x");` +
                    `console.log(JSON.stringify([d, require("path").dirname(f)]));`,
            ],
            { encoding: "utf8" }
        );
        const dirs = JSON.parse(out.trim());
        assert.equal(dirs.length, 2);
        for (const d of dirs) assert.equal(fs.existsSync(d), false, d);
    });
});
