#!/usr/bin/env node
/**
 * Pin: dash-electron's CI must run @doyensec/electronegativity against
 * the main-process source tree (`public/`) and fail on MEDIUM-severity
 * findings, with a small explicit suppression list for findings we've
 * accepted as architectural / mitigated upstream.
 *
 * Why: in v0.0.620 we shipped applyWindowHardening + applySessionHardening
 * to mitigate LIMIT_NAVIGATION_GLOBAL_CHECK (HIGH) and
 * PERMISSION_REQUEST_HANDLER_GLOBAL_CHECK (MEDIUM). v0.0.627 (this
 * change) tightens the gate from HIGH to MEDIUM after triaging the
 * MEDIUM findings: AUXCLICK is fixed at the source via
 * `disableBlinkFeatures: 'Auxclick'`; SANDBOX/PRELOAD/OPEN_EXTERNAL/CSP
 * are suppressed by check name with explicit rationale. This pin
 * enforces:
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
 *   3. The audit script gates on `--severity medium` (or `-s medium`).
 *      Loosening back to `high` would mean re-allowing new MEDIUM
 *      classes (DEV_TOOLS, HTTP_RESOURCES, INSECURE_CONTENT, etc.) to
 *      slip in unnoticed — which is the whole point of tightening.
 *   4. The audit script excludes the four accepted finding classes:
 *        - SANDBOX_JS_CHECK: enabling renderer sandbox breaks our
 *          preload IPC bridge + pluggable-electron's widget loader.
 *        - PRELOAD_JS_CHECK: review-required only; preload is the
 *          correct IPC boundary (vs nodeIntegration: true).
 *        - OPEN_EXTERNAL_JS_CHECK: shell.openExternal calls in
 *          electronSecurity.js are mitigated upstream by dash-core's
 *          mainApi scheme validator.
 *        - CSP_GLOBAL_CHECK: separate deferred plan; tightening
 *          requires production-build verification of widget-builder
 *          eval paths.
 *   5. scripts/ci.sh runs `audit:electron` as part of the validation
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

// 3. Severity gate is MEDIUM (tightened from HIGH in v0.0.627).
assert.ok(
    /(--severity|-s)\s+medium\b/.test(auditScript),
    `audit:electron must use --severity medium (or -s medium). Got: "${auditScript}"`
);

// 4. Excluded check classes — accepted findings that must not silently
// drop from the suppression list. Names are lowercased class names
// (electronegativity normalizes to lowercase), not the upper-snake
// rule IDs that appear in scan output.
const REQUIRED_EXCLUSIONS = [
    // Renderer sandbox: enabling breaks our preload IPC bridge +
    // pluggable-electron's widget loader. Architectural rewrite, not a
    // triage decision.
    "sandboxjscheck",
    // Preload: review-required only; preload is the correct IPC
    // boundary (vs nodeIntegration: true).
    "preloadjscheck",
    // shell.openExternal calls in electronSecurity.js are mitigated
    // upstream by dash-core's mainApi scheme validator.
    "openexternaljscheck",
    // CSP global + atomic checks: separate deferred plan; tightening
    // requires production-build verification of widget-builder eval
    // paths.
    "cspglobalcheck",
    "csphtmlcheck",
    "cspjscheck",
    // Remote module: removed-by-default in Electron 14+. We're on 39
    // and don't install @electron/remote. Setting `enableRemoteModule`
    // would emit "Unknown webPreferences key" warnings on modern
    // Electron. The check is stale.
    "remotemodulejscheck",
];
const exclusionsMatch = auditScript.match(/(?:--exclude-checks|-x)\s+([^\s]+)/);
assert.ok(
    exclusionsMatch,
    `audit:electron must pass --exclude-checks (or -x) for the accepted finding classes. Got: "${auditScript}"`
);
const exclusionsList = exclusionsMatch[1].split(",").map((s) => s.trim());
for (const required of REQUIRED_EXCLUSIONS) {
    assert.ok(
        exclusionsList.includes(required),
        `audit:electron exclusions must include "${required}" (with rationale documented in this file). Got exclusions: ${exclusionsList.join(
            ", "
        )}`
    );
}

// 5. ci.sh wires it in.
const ciSh = fs.readFileSync(path.join(repoRoot, "scripts", "ci.sh"), "utf8");
assert.ok(
    /npm\s+run\s+audit:electron\b/.test(ciSh),
    `scripts/ci.sh must call \`npm run audit:electron\` as part of the validation sweep`
);

console.log(
    `PASS  electronegativity gate: pinned at ${npxMatch[1]} via npx, audit:electron scopes to public/ at --severity medium with ${exclusionsList.length} accepted exclusions, ci.sh runs it`
);
