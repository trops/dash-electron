#!/bin/bash
set -euo pipefail

# ============================================================================
# Local CI Script
# Runs the full validation pipeline and optionally handles git workflow.
#
# Usage:
#   ./scripts/ci.sh                           # validate only
#   ./scripts/ci.sh --commit -m "message"     # validate + commit + bump
#   ./scripts/ci.sh --push -m "message"       # above + push
#   ./scripts/ci.sh --pr -m "message"         # above + create PR
#   ./scripts/ci.sh --release -m "message"    # above + merge + tag + cleanup
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# Tools ci.sh and scripts/release.js call (gh, git, …) must be found even when
# PATH is the Mac app's bare one, as it is for Dash's bots: add Homebrew's
# folders. Node comes from nvm below.
for _dir in /opt/homebrew/bin /usr/local/bin; do
    if [[ -d "$_dir" && ":$PATH:" != *":$_dir:"* ]]; then
        PATH="$_dir:$PATH"
    fi
done
export PATH

# --- Parse arguments ---
MODE="validate"
COMMIT_MSG=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --commit) MODE="commit"; shift ;;
        --push)   MODE="push";   shift ;;
        --pr)     MODE="pr";     shift ;;
        --release) MODE="release"; shift ;;
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

# --- Helper ---
step() {
    echo ""
    echo "=====> $1"
    echo ""
}

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

# Phase 5A regression pins — IPC payload validation + warn-only bundle lint
step "Running Phase 5A unit tests (IPC validators + bundle lint)"
node scripts/checkTempLeaks.js -- node --test scripts/ipcValidators.test.js scripts/testUtils/tempDir.test.js scripts/checkTempLeaks.test.js
node scripts/checkTempLeaks.js -- node --test scripts/bundleSecurityLint.test.js scripts/libraryImports.test.js scripts/indexHtmlErrors.test.js

# Release pipeline (DASH-48): the resumable git workflow and the npm wait
step "Testing the release scripts"
node scripts/checkTempLeaks.js -- node --test scripts/release.test.js scripts/wait-for-npm.test.js

# Bot Factory background-mode helpers (Slice 6b): pure tray/login-item logic
step "Running Bot Factory background-mode tests (Slice 6b)"
node scripts/checkTempLeaks.js -- node --test public/botBackground.test.js public/appIdentifier.test.js public/widgetEventRelay.test.js public/botLeadIpc.test.js public/popoutRoute.test.js public/widgetConfigType.test.js public/widgetImportFixes.test.js public/teamWidgetTools.test.js public/teamWidgetToolsEdit.test.js public/installGate.test.js public/assistantDock.test.js public/botNotify.test.js public/widgetDrafts.test.cjs public/packageUpdate.test.js public/updateCheckError.test.js public/loggerFailed.test.js public/providerCallChecks.test.js

# 2. Update @trops dependencies to latest published versions. First wait
# until npm has what dash-core's master and dash-react's main say was
# released (DASH-48): a merge publishes a few minutes later, and installing
# before then quietly takes the version before it.
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

# 3. Prettify
step "Running Prettier"
npx prettier --write .

# 4. Build CSS (only if CSS source files have changed)
CSS_CHANGED=$(git diff --name-only HEAD -- src/index.css tailwind.config.js 'src/**/*.css' 2>/dev/null || true)
if [ -n "$CSS_CHANGED" ]; then
    step "Building Tailwind CSS (source changes detected)"
    npx tailwindcss -i src/index.css -o public/tailwind.css -m
else
    step "Skipping Tailwind CSS build (no source changes)"
    echo "No changes in src/index.css or tailwind.config.js — skipping rebuild."
fi

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

# 5d. AI Widget Builder unit tests (src/AiAssistant). Jest for the React /
# source-pin suites; the two node:test suites run under node --test.
step "Running AI Widget Builder unit tests"
npm run test:ai
node scripts/checkTempLeaks.js -- npm run test:ai-node
# The main-process copy of the Widget Builder's checks (the Dash team's
# Checker) must match src/AiAssistant.
node scripts/build-widget-checks.js --check

# 6. The widget loader/registry integration suite runs in dash-core's CI
#    (scripts/testWidgetIntegration.cjs there, since v0.1.819).

# 7. Cleanup build dir (only used for validation)
step "Cleaning up build directory"
rm -rf build/

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
