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

// 4. ci.sh integration + ordering: checker invocation must come BEFORE
// the `git add -u` line.
const ciShPath = path.join(repoRoot, "scripts", "ci.sh");
const ciShLines = fs.readFileSync(ciShPath, "utf8").split("\n");

let checkerLine = -1;
let gitAddLine = -1;
ciShLines.forEach((line, idx) => {
    if (
        checkerLine === -1 &&
        /(npm\s+run\s+check:untracked\b|node\s+scripts\/check-untracked-sources\.js)/.test(
            line
        )
    ) {
        checkerLine = idx;
    }
    if (gitAddLine === -1 && /^\s*git\s+add\s+-u\b/.test(line)) {
        gitAddLine = idx;
    }
});

assert.ok(
    checkerLine !== -1,
    "scripts/ci.sh must invoke `npm run check:untracked` (or `node scripts/check-untracked-sources.js`)"
);
assert.ok(
    gitAddLine !== -1,
    "scripts/ci.sh must contain a `git add -u` line (sanity check)"
);
assert.ok(
    checkerLine < gitAddLine,
    `Checker must run BEFORE 'git add -u'. Got checker at line ${
        checkerLine + 1
    }, git add -u at line ${gitAddLine + 1}.`
);

console.log(
    `PASS  untracked-sources gate: checker exists at line ${
        checkerLine + 1
    }, before \`git add -u\` at line ${gitAddLine + 1}`
);
