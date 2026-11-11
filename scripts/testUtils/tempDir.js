/**
 * tempDir.js — test-only helper for scratch folders in the OS temp dir.
 *
 * Every folder made here is remembered and removed when the process exits,
 * so tests stop leaving zz-*, skill-*, dash-ver-* … behind in os.tmpdir().
 * Not used by the app — never require it from public/ or src/ app code.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const made = new Set();

/** A new empty folder in os.tmpdir() (name starts with `prefix`). */
function tempDir(prefix = "dash-test-") {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    made.add(dir);
    return dir;
}

/** A path (not yet created) for a file inside a new remembered temp folder. */
function tempFile(prefix = "dash-test-", ext = "") {
    const base = String(prefix).replace(/[-_.]+$/, "") || "file";
    return path.join(tempDir(prefix), `${base}${ext}`);
}

/** Remove every folder made so far. Errors are ignored. */
function cleanupTempDirs() {
    for (const dir of made) {
        try {
            fs.rmSync(dir, { recursive: true, force: true });
        } catch (_) {
            // best effort
        }
        made.delete(dir);
    }
}

process.on("exit", cleanupTempDirs);

module.exports = { tempDir, tempFile, cleanupTempDirs };
