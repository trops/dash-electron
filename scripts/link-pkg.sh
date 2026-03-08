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

if [[ "$ACTION" == "link" ]]; then
    PKG_PATH="${3:?Usage: link-pkg.sh link <package> <path-to-local-repo>}"

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
