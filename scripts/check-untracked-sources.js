#!/usr/bin/env node
/**
 * Fail fast if there are untracked files in source directories at
 * commit time.
 *
 * Why: ci.sh stages with `git add -u`, which only picks up modified
 * tracked files. Brand-new files (e.g. a freshly-added helper module)
 * stay untracked and silently get dropped from the release commit. We
 * shipped this exact bug as v0.0.620–622 (public/electronSecurity.js
 * referenced by electron.js but never committed). This checker prevents
 * the recurrence by aborting the release if anything matching the
 * source pattern is untracked.
 *
 * The fix path on a hit is intentionally explicit: stage the file with
 * `git add <path>`, OR add it to ALLOWLIST below with a comment, OR
 * delete it. No automatic staging — automatic staging is what got us
 * here.
 */
"use strict";

const { execFileSync } = require("child_process");
const path = require("path");

// Directories considered "source" — anything new in these paths needs
// either an explicit `git add` or an allowlist entry.
const SOURCE_DIRS = ["public/", "src/", "scripts/", "e2e/", "test/", "assets/"];

// Known carryover paths that pre-date this checker. Each entry must
// have a brief reason — if a reason becomes stale, drop the entry.
const ALLOWLIST = new Set([
    // Local debug scripts that have lived untracked across many sessions;
    // not part of any feature work. If they ever become load-bearing,
    // commit them properly and remove from this allowlist.
    "scripts/inspect-dash-core.js",
    "scripts/verify-publish.js",
]);

function getUntrackedFiles() {
    let out;
    try {
        out = execFileSync("git", ["status", "--porcelain"], {
            cwd: path.join(__dirname, ".."),
            encoding: "utf8",
        });
    } catch (e) {
        // ci.sh runs only in a git context (`gh auth setup-git` is part
        // of the same flow). If `git status` fails here, something is
        // genuinely wrong (corrupt repo, broken git install,
        // permissions). Hard-fail so the gate doesn't silently turn
        // into a no-op exactly when something is already off — the
        // exact failure mode this script exists to prevent.
        console.error(
            "check-untracked-sources: git status failed (" + e.message + ")"
        );
        process.exit(1);
    }

    return out
        .split("\n")
        .filter((line) => line.startsWith("?? "))
        .map((line) => line.slice(3).trim());
}

function isInSourceDir(filePath) {
    return SOURCE_DIRS.some((dir) => filePath.startsWith(dir));
}

function main() {
    const untracked = getUntrackedFiles();
    const violations = untracked.filter(
        (p) => isInSourceDir(p) && !ALLOWLIST.has(p)
    );

    if (violations.length === 0) {
        console.log(
            "OK  no untracked source files (allowlist size: " +
                ALLOWLIST.size +
                ")"
        );
        process.exit(0);
    }

    console.error("");
    console.error("✗ Untracked source files detected:");
    violations.forEach((p) => console.error("    " + p));
    console.error("");
    console.error(
        "ci.sh's `git add -u` only stages tracked-modified files, not new files."
    );
    console.error("Either:");
    console.error("    - Stage them explicitly:  git add <file>");
    console.error(
        "    - Add to ALLOWLIST in scripts/check-untracked-sources.js (with a reason)"
    );
    console.error("    - Delete them if they're not part of this PR");
    console.error("");
    console.error(
        "Aborting before commit to prevent shipping a broken release."
    );
    process.exit(1);
}

main();
