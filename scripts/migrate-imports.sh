#!/bin/bash
# migrate-imports.sh
# Replace @dash/ alias imports with relative paths in migrated files

cd "$(dirname "$0")/../src"

echo "Starting import migration..."

# Function to replace imports in a file
replace_imports() {
    local file=$1
    
    # Replace @dash/Common with @trops/dash-react (UI components stay in package)
    sed -i.bak 's|from "@dash/Common|from "@trops/dash-react|g' "$file"
    sed -i.bak 's|import "@dash/Common|import "@trops/dash-react|g' "$file"
    
    # Note: For other @dash/ imports, we need context-aware replacement
    # which is complex. Will handle these manually or with a more sophisticated script.
    
    rm -f "${file}.bak"
}

# Find all JS/TS files in migrated folders
find Components Context Api Models Widget hooks Mock -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \) | while read file; do
    if grep -q "@dash/" "$file" 2>/dev/null; then
        echo "Processing: $file"
        replace_imports "$file"
    fi
done

# Also process ComponentManager.js
if [ -f "ComponentManager.js" ]; then
    if grep -q "@dash/" "ComponentManager.js" 2>/dev/null; then
        echo "Processing: ComponentManager.js"
        replace_imports "ComponentManager.js"
    fi
fi

echo "Phase 1 complete: @dash/Common -> @trops/dash-react"
echo "Note: Other @dash/ imports need manual conversion to relative paths"
