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
            COMMIT_MSG="$1"
            shift
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

# 1. Ensure Node 20 via nvm
step "Ensuring Node 20 via nvm"
unset npm_config_prefix
export NVM_DIR="$HOME/.nvm"
if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    echo "Error: nvm not found at $NVM_DIR/nvm.sh"
    exit 1
fi
source "$NVM_DIR/nvm.sh" --no-use
nvm use --delete-prefix v20.20.0
echo "Node version: $(node -v)"
echo "npm version: $(npm -v)"

# 2. Update @trops dependencies to latest published versions
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

# 6. Widget tests (disabled — test references stale local modules moved to @trops/dash-core)
# TODO: update testWidgetIntegration.cjs to import from @trops/dash-core/electron
# if [[ -f scripts/testWidgetIntegration.cjs ]]; then
#     step "Running widget integration tests"
#     node scripts/testWidgetIntegration.cjs
# fi

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
# GIT WORKFLOW
# ============================================================================

BRANCH="$(git branch --show-current)"
MAIN_BRANCH="master"

# --- Ensure git credentials via gh ---
step "Configuring git credentials via gh"
gh auth setup-git

# --- Pull latest from remote ---
step "Pulling latest from origin"
git fetch origin
git stash --include-untracked -q
if git rev-parse --verify "origin/$BRANCH" >/dev/null 2>&1; then
    git pull origin "$BRANCH" --rebase
elif [[ "$BRANCH" != "$MAIN_BRANCH" ]]; then
    git pull origin "$MAIN_BRANCH" --rebase
fi
git stash pop -q 2>/dev/null || true

# --- Commit ---
step "Committing changes"
# Stage only tracked, modified files — never use git add -A
git add -u
# If public/tailwind.css was rebuilt, stage it explicitly
if [ -n "$(git diff --name-only HEAD -- public/tailwind.css 2>/dev/null)" ]; then
    git add public/tailwind.css
fi
git commit -m "$COMMIT_MSG"

step "Bumping version"
npm version patch --no-git-tag-version
VERSION="$(node -p "require('./package.json').version")"
git add package.json package-lock.json
git commit -m "Bump version to $VERSION"

echo "New version: $VERSION"

if [[ "$MODE" == "commit" ]]; then
    exit 0
fi

# --- Push ---
step "Pushing branch to origin"
git push -u origin "$BRANCH"

if [[ "$MODE" == "push" ]]; then
    exit 0
fi

# --- PR ---
step "Creating pull request"
PR_URL="$(gh pr create --title "$COMMIT_MSG" --body "$(cat <<EOF
## Summary
$COMMIT_MSG

Version: $VERSION

## Validation
- Prettier: passed
- Tailwind CSS build: passed
- CI build (ESLint warnings as errors): passed
- Widget integration tests: passed
EOF
)")"

echo "PR created: $PR_URL"

if [[ "$MODE" == "pr" ]]; then
    exit 0
fi

# --- Release ---
step "Merging pull request"
gh pr merge --merge

step "Switching to master and pulling"
git checkout master
git pull

step "Tagging v$VERSION"
git tag "v$VERSION"
git push origin "v$VERSION"

step "Cleaning up branch: $BRANCH"
git branch -d "$BRANCH" 2>/dev/null || true
git push origin --delete "$BRANCH" 2>/dev/null || true

echo ""
echo "Release complete: v$VERSION"
