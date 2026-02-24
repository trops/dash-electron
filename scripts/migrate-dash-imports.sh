#!/bin/bash
# migrate-dash-imports.sh
# Replace all @dash/ imports with proper relative or absolute paths from src/

cd "$(dirname "$0")/../src"

echo "Migrating @dash/ imports to local paths..."

# Find all JS/TS/JSX/TSX files
find Components Context Api Models Widget hooks Mock -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" \) -exec sed -i.bak \
    -e 's|from "@dash/Api"|from "../Api"|g' \
    -e 's|from "@dash/Context/App/AppContext"|from "../Context/App/AppContext"|g' \
    -e 's|from "@dash/Context/DashboardContext"|from "../Context/DashboardContext"|g' \
    -e 's|from "@dash/Context/ThemeContext"|from "../Context/ThemeContext"|g' \
    -e 's|from "@dash/Context/WidgetContext"|from "../Context/WidgetContext"|g' \
    -e 's|from "@dash/Context/WorkspaceContext"|from "../Context/WorkspaceContext"|g' \
    -e 's|from "@dash/Context"|from "../Context"|g' \
    -e 's|from "@dash/Dashboard"|from "../Dashboard"|g' \
    -e 's|from "@dash/Layout/Builder/LayoutBuilderWidgetConfigPanel"|from "../Layout/Builder/LayoutBuilderWidgetConfigPanel"|g' \
    -e 's|from "@dash/Layout/Builder/Modal"|from "../Layout/Builder/Modal"|g' \
    -e 's|from "@dash/Layout/Builder"|from "../Layout/Builder"|g' \
    -e 's|from "@dash/Layout"|from "../Layout"|g' \
    -e 's|from "@dash/Menu"|from "../Menu"|g' \
    -e 's|from "@dash/Models/ContextModel"|from "../Models/ContextModel"|g' \
    -e 's|from "@dash/Models/ThemeModel"|from "../Models/ThemeModel"|g' \
    -e 's|from "@dash/Models"|from "../Models"|g' \
    -e 's|from "@dash/Provider"|from "../Provider"|g' \
    -e 's|from "@dash/Theme"|from "../Theme"|g' \
    -e 's|from "@dash/Utils/colors"|from "../utils/colors"|g' \
    -e 's|from "@dash/Utils/layout"|from "../utils/layout"|g' \
    -e 's|from "@dash/Utils/objects"|from "../utils/objects"|g' \
    -e 's|from "@dash/Utils/themeObjects"|from "../utils/themeObjects"|g' \
    -e 's|from "@dash/Utils"|from "../utils"|g' \
    -e 's|from "@dash/Widget"|from "../Widget"|g' \
    -e 's|from "@dash/ComponentManager"|from "../ComponentManager"|g' \
    -e 's|from "@dash/index"|from "../index"|g' \
    {} \;

# Process ComponentManager.js
if [ -f "ComponentManager.js" ]; then
    sed -i.bak \
        -e 's|from "@dash/Utils"|from "./utils"|g' \
        -e 's|from "@dash/Widget"|from "./Widget"|g' \
        -e 's|from "@dash/Models"|from "./Models"|g' \
        ComponentManager.js
fi

# Clean up backup files
find Components Context Api Models Widget hooks Mock -name "*.bak" -delete
rm -f ComponentManager.js.bak

echo "Migration complete! All @dash/ imports updated to relative paths."
echo "Note: You may need to adjust some paths based on actual file locations."
