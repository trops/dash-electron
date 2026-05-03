#!/usr/bin/env node
/**
 * Pin: dash-electron's CI must run @doyensec/electronegativity against
 * the main-process source tree (`public/`) and fail on HIGH-severity
 * findings.
 *
 * Why: in v0.0.620 we shipped applyWindowHardening + applySessionHardening
 * to mitigate LIMIT_NAVIGATION_GLOBAL_CHECK (HIGH) and
 * PERMISSION_REQUEST_HANDLER_GLOBAL_CHECK (MEDIUM, but its absence
 * effectively gates a HIGH-class privilege auto-grant). Without a CI
 * gate, those mitigations can be silently removed in a future PR. This
 * pin enforces:
 *
 *   1. The audit:electron script invokes electronegativity via npx
 *      with a pinned version. Why npx and not a direct devDep: v1.10.3
 *      requires commander@5 API but doesn't declare commander as a
 *      dependency, so the hoisted commander@11 (pulled in by
 *      @electron-forge/cli) breaks `program.input` resolution. npx
 *      isolates the dep tree; a pinned version keeps it reproducible.
 *   2. The audit script targets `public/` only (not `src/`) — passing
 *      both directories triggers a scanner artifact where global checks
 *      falsely re-fire on the renderer-only tree.
 *   3. The audit script gates on `--severity high` (or `-s high`).
 *      Loosening to `medium` would conflate this regression-pin with
 *      a triage of pre-existing review-required findings; tighten only
 *      via a deliberate plan.
 *   4. scripts/ci.sh runs `audit:electron` as part of the validation
 *      sweep so every PR is checked.
 *
 * Pure JSON + string read — no jest, no jsdom.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

const pkg = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")
);

// 1. audit:electron script present.
const auditScript = pkg?.scripts?.["audit:electron"];
assert.ok(
    typeof auditScript === "string" && auditScript.length > 0,
    `package.json must define an "audit:electron" script. Got: ${auditScript}`
);

// 1a. Invoked via npx with a pinned version (commander conflict
// workaround — see header comment).
const npxMatch = auditScript.match(
    /npx\s+(?:-y\s+)?@doyensec\/electronegativity@(\d+\.\d+\.\d+)\b/
);
assert.ok(
    npxMatch,
    `audit:electron must invoke electronegativity via npx with a pinned version (e.g. "npx -y @doyensec/electronegativity@1.10.3 ..."). Got: "${auditScript}"`
);

// 2. Scope: targets `public/` and NOT `src/`. The multi-input scan
// causes the global checks to falsely re-fire on the renderer tree
// (which has no main-process navigation handlers by design).
assert.ok(
    /-i\s+public(\b|\/)/.test(auditScript),
    `audit:electron must scan public/. Got: "${auditScript}"`
);
assert.ok(
    !/-i\s+src(\b|\/)/.test(auditScript),
    `audit:electron must NOT pass "-i src" — that triggers a scanner artifact where global checks falsely re-fire on the renderer tree. Got: "${auditScript}"`
);

// 3. Severity gate is HIGH.
assert.ok(
    /(--severity|-s)\s+high\b/.test(auditScript),
    `audit:electron must use --severity high (or -s high). Got: "${auditScript}"`
);

// 4. ci.sh wires it in.
const ciSh = fs.readFileSync(path.join(repoRoot, "scripts", "ci.sh"), "utf8");
assert.ok(
    /npm\s+run\s+audit:electron\b/.test(ciSh),
    `scripts/ci.sh must call \`npm run audit:electron\` as part of the validation sweep`
);

console.log(
    `PASS  electronegativity gate: pinned at ${npxMatch[1]} via npx, audit:electron scopes to public/ at --severity high, ci.sh runs it`
);
