#!/usr/bin/env node
/**
 * Pin: ci.sh must run scripts/check-untracked-sources.js BEFORE the
 * `git add -u` line so untracked new files in source directories never
 * silently get dropped from a release commit.
 *
 * Why this pin exists: in May 2026 we shipped v0.0.620, v0.0.621, and
 * v0.0.622 with public/electron.js requiring `./electronSecurity`,
 * but the helper file (and three regression-pin test scripts) were
 * never committed. ci.sh's `git add -u` skips untracked files. The
 * checker fails the release loudly when untracked sources exist.
 *
 * Pin enforces:
 *   1. scripts/check-untracked-sources.js exists.
 *   2. The checker references the source-dir list and the allowlist
 *      mechanism (so a refactor doesn't silently lose either).
 *   3. package.json has both `check:untracked` and `test:untracked-pin`
 *      scripts.
 *   4. ci.sh invokes the checker BEFORE the `git add -u` line —
 *      verified by line-number ordering.
 *
 * Pure file-read test — no actual git invocation, no fixture creation.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

// 1. Checker exists.
const checkerPath = path.join(
    repoRoot,
    "scripts",
    "check-untracked-sources.js"
);
assert.ok(
    fs.existsSync(checkerPath),
    "scripts/check-untracked-sources.js must exist"
);
const checkerSrc = fs.readFileSync(checkerPath, "utf8");

// 2. Structural references.
assert.ok(
    /git\s+status\s+--porcelain/.test(checkerSrc) ||
        /["']git["'][\s\S]{0,40}["']status["'][\s\S]{0,40}["']--porcelain["']/.test(
            checkerSrc
        ),
    "check-untracked-sources.js must invoke git status --porcelain (string or arg-array form)"
);
assert.ok(
    /\?\?\s/.test(checkerSrc) || /"\?\? "/.test(checkerSrc),
    "check-untracked-sources.js must filter on the `?? ` untracked marker"
);
assert.ok(
    /SOURCE_DIRS|sourceDirs|sourceDirectories/.test(checkerSrc),
    "check-untracked-sources.js must define a list of source directories to scan"
);
assert.ok(
    /ALLOWLIST|allowlist|allowList/.test(checkerSrc),
    "check-untracked-sources.js must define an allowlist mechanism for known carryover paths"
);
assert.ok(
    /process\.exit\(1\)/.test(checkerSrc),
    "check-untracked-sources.js must exit 1 when violations are found"
);

// 3. package.json scripts.
const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")
);
assert.ok(
    typeof pkg?.scripts?.["check:untracked"] === "string",
    "package.json must define `check:untracked` script"
);
assert.ok(
    typeof pkg?.scripts?.["test:untracked-pin"] === "string",
    "package.json must define `test:untracked-pin` script"
);

// 4. The checker runs before `git add -u` (DASH-48: the git workflow is in
// scripts/release.js). ci.sh must pass it as --pre-commit, and release.js
// must run --pre-commit before its `git add -u` — both checked by position.
const ciSh = fs.readFileSync(path.join(repoRoot, "scripts", "ci.sh"), "utf8");
const releaseCall =
    /node\s+scripts\/release\.js[\s\S]*?--pre-commit\s+(["'])([\s\S]*?)\1/.exec(
        ciSh
    );
assert.ok(
    releaseCall,
    'scripts/ci.sh must call `node scripts/release.js … --pre-commit "…"`'
);
assert.ok(
    /(npm\s+run\s+check:untracked\b|node\s+scripts\/check-untracked-sources\.js)/.test(
        releaseCall[2]
    ),
    "ci.sh's --pre-commit must run `npm run check:untracked` (or `node scripts/check-untracked-sources.js`)"
);

const releaseSrc = fs.readFileSync(
    path.join(repoRoot, "scripts", "release.js"),
    "utf8"
);
const preCommitAt = releaseSrc.search(
    /run\("bash",\s*\["-c",\s*opts\.preCommit\]\)/
);
const gitAddAt = releaseSrc.search(/run\("git",\s*\["add",\s*"-u"\]\)/);
assert.ok(preCommitAt !== -1, "release.js must run opts.preCommit");
assert.ok(
    gitAddAt !== -1,
    "release.js must contain `git add -u` (sanity check)"
);
assert.ok(
    preCommitAt < gitAddAt,
    "release.js must run --pre-commit BEFORE `git add -u`"
);

console.log(
    "PASS  untracked-sources gate: ci.sh passes it to release.js as --pre-commit, run before `git add -u`"
);
