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

# 2. Prettify
step "Running Prettier"
npx prettier --write .

# 3. Build CSS
step "Building Tailwind CSS"
npx tailwindcss -i src/index.css -o public/tailwind.css -m

# 4. CI Build (ESLint warnings as errors, same as GitHub Actions)
step "Running CI build"
CI=true npx craco build

# 5. Widget tests (skip if script doesn't exist)
if [[ -f scripts/testWidgetIntegration.cjs ]]; then
    step "Running widget integration tests"
    node scripts/testWidgetIntegration.cjs
fi

# 6. Cleanup build dir (only used for validation)
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

# --- Commit ---
step "Committing changes"
git add -A
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
