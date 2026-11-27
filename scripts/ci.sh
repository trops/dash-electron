#!/bin/bash
set -euo pipefail

# ============================================================================
# Local CI Script
# Runs the full validation pipeline and optionally handles git workflow.
#
# Usage:
#   ./scripts/ci.sh                           # validate only (changes no files)
#   ./scripts/ci.sh --update-deps             # validate with npm's latest @trops deps
#   ./scripts/ci.sh --commit -m "message"     # validate + commit + bump
#   ./scripts/ci.sh --push -m "message"       # above + push
#   ./scripts/ci.sh --pr -m "message"         # above + create PR
#   ./scripts/ci.sh --release -m "message"    # above + merge + tag + cleanup
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# --- Parse arguments ---
MODE="validate"
COMMIT_MSG=""
UPDATE_DEPS=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --commit) MODE="commit"; shift ;;
        --push)   MODE="push";   shift ;;
        --pr)     MODE="pr";     shift ;;
        --release) MODE="release"; shift ;;
        --update-deps) UPDATE_DEPS=1; shift ;;
        -m)
            shift
            COMMIT_MSG="$*"
            break
            ;;
        *)
            echo "Unknown argument: $1"
            exit 1
            ;;
    esac
done

if [[ "$MODE" != "validate" && -z "$COMMIT_MSG" ]]; then
    echo "Error: -m \"message\" is required with --commit, --push, --pr, or --release"
    exit 1
fi

# DASH-154: plain validate never changes a file. Only a release (--commit and
# up) or --update-deps (the bump-deps workflow) installs npm's latest
# @trops/dash-core and @trops/dash-react into package.json and the lockfile.
if [[ "$MODE" != "validate" ]]; then
    UPDATE_DEPS=1
fi

# --- Helper ---
step() {
    echo ""
    echo "=====> $1"
    echo ""
}

# A fingerprint of the working tree: tracked changes plus untracked,
# not-ignored files. Validation must leave it as it found it (DASH-154).
tree_fingerprint() {
    { git diff HEAD --binary; git ls-files --others --exclude-standard; } | git hash-object --stdin
}
TREE_BEFORE="$(tree_fingerprint)"

# ============================================================================
# VALIDATION STEPS
# ============================================================================

# 1. Ensure Node 20 via nvm (on GitHub Actions the workflow sets up Node)
if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
    step "Using the runner's Node (GitHub Actions)"
else
    step "Ensuring Node 20 via nvm"
    unset npm_config_prefix
    export NVM_DIR="$HOME/.nvm"
    if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
        echo "Error: nvm not found at $NVM_DIR/nvm.sh"
        exit 1
    fi
    source "$NVM_DIR/nvm.sh" --no-use
    nvm use --delete-prefix v20.20.0
fi
echo "Node version: $(node -v)"
echo "npm version: $(npm -v)"

# 1b. IPC surface audit regression gate. Runs BEFORE the @trops
# dependency update because the audit needs `electron/api/*.js` source
# files from dash-core, which only exist in the linked-symlink form
# (the published package ships only `dist/`). After `npm install
# @trops/dash-core@...` runs at step 2, the link is gone for the rest
# of the pipeline, so the audit must run here. Soft-skips with a
# notice when the link isn't present (remote CI without dash-core
# linked).
step "Auditing IPC surface (regression gate)"
node --test scripts/audit-ipc-surface.test.js
node scripts/audit-ipc-surface.js --check

# The node:test runs below go through scripts/checkTempLeaks.js: it fails
# the step, listing each entry, when a test leaves zz-*, skill-*,
# dash-ver-*, dash-ai-build-* … behind in the OS temp dir. Tests make
# temp folders with scripts/testUtils/tempDir.js.

# Every node:test file in src/, public/ and scripts/ (DASH-158: found by
# scripts/list-tests.js, not a hand-kept list).
step "Running node:test unit tests (src/, public/, scripts/)"
npm run test:node

# 2. Update @trops dependencies to the latest published versions, only for
# a release or --update-deps (plain validate uses the lockfile as it is).
# First wait until npm has what dash-core's master and dash-react's main say
# was released (DASH-48): a merge publishes a few minutes later, and
# installing before then quietly takes the version before it.
if [[ "$UPDATE_DEPS" == "1" ]]; then
    step "Waiting for npm to have the released @trops versions"
    node scripts/wait-for-npm.js \
        @trops/dash-core=trops/dash-core@master \
        @trops/dash-react=trops/dash-react@main

    step "Updating @trops dependencies"
    CORE_LATEST="$(npm view @trops/dash-core version)"
    REACT_LATEST="$(npm view @trops/dash-react version)"
    echo "Latest @trops/dash-core: $CORE_LATEST"
    echo "Latest @trops/dash-react: $REACT_LATEST"
    npm install "@trops/dash-core@^${CORE_LATEST}" "@trops/dash-react@^${REACT_LATEST}" --save
    echo "Updated dependencies installed"
    # The install is the one change validation may make.
    TREE_BEFORE="$(tree_fingerprint)"
else
    step "Using the @trops versions in package-lock.json (no update)"
    echo "Run with --update-deps (or a release) to take npm's latest."
fi

# 3. Formatting: check only. Fix with `npm run prettify`, then commit.
step "Checking formatting (Prettier)"
if ! npx prettier --check .; then
    echo ""
    echo "Error: the files above aren't formatted. Run \`npm run prettify\` and commit the result."
    exit 1
fi

# 4. Tailwind: no new classes outside the safelist in src/, and the CSS
# always builds (public/tailwind.css is ignored by git, so this changes
# nothing tracked).
step "Checking Tailwind classes against the safelist"
node --test scripts/lib/findTailwindViolations.test.js
node scripts/check-tailwind-safelist.js

step "Building Tailwind CSS"
npx tailwindcss -i src/index.css -o public/tailwind.css -m

# 5. CI Build (ESLint warnings as errors, same as GitHub Actions)
step "Running CI build"
CI=true npx craco build

# 5b. Security hardening regression-pin
step "Validating Electron security hardening"
npm run test:security

# 5b1. Electron version regression-pin
step "Validating Electron runtime version (HIGH advisories closed)"
npm run test:electron-pin

# 5b2. Untracked-sources gate regression-pin
step "Validating untracked-sources gate config"
npm run test:untracked-pin

# 5b3. Main-process must not require the dash-core renderer bundle.
# A bare `require("@trops/dash-core")` in public/electron.js pulls the
# renderer bundle (which assumes window/document) into the main process
# and throws "ReferenceError: window is not defined" at startup.
step "Validating main-process imports of dash-core"
npm run test:no-renderer-in-main

# 5c. Electronegativity gate — fails on HIGH-severity Electron findings.
# The audit-pin test enforces config (devDep present, scope = public/,
# severity = high). The audit itself runs the scanner.
step "Pinning electronegativity gate config"
npm run test:audit-pin

step "Auditing Electron-specific security (electronegativity)"
npm run audit:electron

# 5d. Every jest test file in src/, public/ and scripts/ (DASH-158: found by
# scripts/list-tests.js; the node:test ones ran above).
step "Running jest unit tests (src/, public/, scripts/)"
npm run test:jest
# The main-process copy of the Widget Builder's checks (the Dash team's
# Checker) must match src/AiAssistant.
node scripts/build-widget-checks.js --check

# 6. The widget loader/registry integration suite runs in dash-core's CI
#    (scripts/testWidgetIntegration.cjs there, since v0.1.819).

# 7. Cleanup build dir (only used for validation)
step "Cleaning up build directory"
rm -rf build/

# 8. Validation changed nothing (DASH-154)
step "Checking that validation changed no files"
if [[ "$(tree_fingerprint)" != "$TREE_BEFORE" ]]; then
    echo "Error: validation changed files in the working tree:"
    git status --short
    echo "A step (a test, a build or a script) wrote into the repo. Make it write"
    echo "somewhere ignored or temporary instead."
    exit 1
fi
echo "No files changed."

echo ""
echo "All validation steps passed."

# If validate-only, we're done
if [[ "$MODE" == "validate" ]]; then
    exit 0
fi

# ============================================================================
# GIT WORKFLOW (DASH-48: scripts/release.js)
# ============================================================================
# Resumable: after --pr, run --release on the same branch to merge, tag and
# clean up. Safe to run again. Works in a git worktree (the v* tag goes on the
# PR's merge commit; Release App builds from it). Before committing:
# check:untracked (`git add -u` only stages tracked files) and stage a
# rebuilt public/tailwind.css.

export RELEASE_PR_BODY="## Summary
$COMMIT_MSG

Version: {{VERSION}}

## Validation
- Prettier: passed
- Tailwind CSS build: passed
- CI build (ESLint warnings as errors): passed
- Widget integration tests: passed"

node scripts/release.js --mode "$MODE" -m "$COMMIT_MSG" --main master \
    --pre-commit 'npm run check:untracked && if [ -n "$(git diff --name-only HEAD -- public/tailwind.css 2>/dev/null)" ]; then git add public/tailwind.css; fi'
