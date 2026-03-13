#!/bin/bash
set -euo pipefail

# Usage:
#   ./scripts/link-pkg.sh link   @trops/dash-core  /path/to/dash-core
#   ./scripts/link-pkg.sh link   @trops/dash-react /path/to/dash-react
#   ./scripts/link-pkg.sh unlink @trops/dash-core
#   ./scripts/link-pkg.sh unlink @trops/dash-react

ACTION="${1:?Usage: link-pkg.sh <link|unlink> <package> [path]}"
PKG="${2:?Usage: link-pkg.sh <link|unlink> <package> [path]}"

# Convert @trops/dash-core → node_modules/@trops/dash-core
PKG_DIR="node_modules/${PKG}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ "$ACTION" == "link" ]]; then
    # If no path provided, auto-resolve from .dash-repos config or sibling convention
    if [[ -z "${3:-}" ]]; then
        # Derive short name from package (e.g. @trops/dash-core → dash-core)
        SHORT_NAME="${PKG##*/}"
        REPOS_FILE="$PROJECT_DIR/.dash-repos"

        if [[ -f "$REPOS_FILE" ]]; then
            # Read path from .dash-repos JSON config
            PKG_PATH="$(node -p "JSON.parse(require('fs').readFileSync('$REPOS_FILE','utf8'))['$SHORT_NAME'] || ''")"
        fi

        # Fallback: sibling directory convention
        if [[ -z "${PKG_PATH:-}" || ! -d "${PKG_PATH:-}" ]]; then
            PKG_PATH="$(cd "$PROJECT_DIR/../$SHORT_NAME" 2>/dev/null && pwd || echo "")"
        fi

        if [[ -z "$PKG_PATH" || ! -d "$PKG_PATH" ]]; then
            echo "Error: Could not find $SHORT_NAME. Pass the path explicitly or run scripts/setup-repos.sh."
            exit 1
        fi
    else
        PKG_PATH="${3}"
    fi

    # Resolve to absolute path
    PKG_PATH="$(cd "$PKG_PATH" && pwd)"

    echo "Building ${PKG} at ${PKG_PATH}..."
    (cd "$PKG_PATH" && npm run build)

    echo "Linking ${PKG} → ${PKG_PATH}"
    rm -rf "$PKG_DIR"
    ln -s "$PKG_PATH" "$PKG_DIR"

    echo "Done. Verify: ls -la $PKG_DIR"

elif [[ "$ACTION" == "unlink" ]]; then
    echo "Unlinking ${PKG}, restoring from npm..."
    rm -rf "$PKG_DIR"
    npm install
    echo "Done. Restored published version."

else
    echo "Unknown action: $ACTION (use 'link' or 'unlink')"
    exit 1
fi
