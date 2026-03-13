#!/bin/bash
set -euo pipefail

# ============================================================================
# Setup Sibling Repos
# Clones dash-core, dash-react, and dash-registry as siblings of dash-electron,
# installs dependencies, and writes a .dash-repos config file.
#
# Usage:
#   ./scripts/setup-repos.sh
#
# Expected layout after running:
#   parent_dir/
#     dash-electron/    ← this repo
#     dash-core/        ← cloned by this script
#     dash-react/       ← cloned by this script
#     dash-registry/    ← cloned by this script
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PARENT_DIR="$(cd "$PROJECT_DIR/.." && pwd)"

GITHUB_ORG="https://github.com/trops"
SIBLING_REPOS=("dash-core" "dash-react" "dash-registry")

echo "Setting up sibling repos in: $PARENT_DIR"
echo ""

for REPO in "${SIBLING_REPOS[@]}"; do
    REPO_DIR="$PARENT_DIR/$REPO"
    if [[ -d "$REPO_DIR" ]]; then
        echo "Skip: $REPO already exists at $REPO_DIR"
    else
        echo "Cloning $REPO..."
        git clone "$GITHUB_ORG/$REPO.git" "$REPO_DIR"
    fi
done

echo ""
echo "Installing dependencies in each repo..."

for REPO in "${SIBLING_REPOS[@]}"; do
    REPO_DIR="$PARENT_DIR/$REPO"
    echo ""
    echo "--- npm install in $REPO ---"
    (cd "$REPO_DIR" && npm install)
done

# Write .dash-repos config
CONFIG_FILE="$PROJECT_DIR/.dash-repos"

echo ""
echo "Writing config to $CONFIG_FILE"

node -e "
var config = {};
config['dash-electron'] = process.argv[1];
config['dash-core'] = process.argv[2];
config['dash-react'] = process.argv[3];
config['dash-registry'] = process.argv[4];
require('fs').writeFileSync(process.argv[5], JSON.stringify(config, null, 2) + '\n');
" "$PROJECT_DIR" "$PARENT_DIR/dash-core" "$PARENT_DIR/dash-react" "$PARENT_DIR/dash-registry" "$CONFIG_FILE"

echo ""
echo "Done. Sibling repos are set up and .dash-repos config written."
echo "You can now use: npm run link-core / npm run link-react"
