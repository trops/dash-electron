#!/bin/bash

# Fix imports in Components directory for deeply nested files

cd "$(dirname "$0")/../src"

echo "Fixing imports in GridItem directory..."
# GridItem is at Components/Layout/Builder/GridItem, so:
# - Widget is at ../../../Widget (go up 4 levels from GridItem, then into Widget)
# - Layout is at ../../ (go up 2 levels to Builder, then Layout)
# - utils is at ../../../../utils
# - Utils should be ../../../../utils (case fix)
# - Models is at ../../../../Models

find Components/Layout/Builder/GridItem -name "*.js" -type f -exec sed -i '' \
  -e 's|from "../Widget"|from "../../../../Widget"|g' \
  -e 's|from "../Layout"|from "../../"|g' \
  -e 's|from "../../utils"|from "../../../../../utils"|g' \
  -e 's|from "../../../Utils"|from "../../../../../utils"|g' \
  -e 's|from "../../Models"|from "../../../../../Models"|g' \
  -e 's|from "@dash"|from "../../../../../"|g' \
  {} \;

echo "Fixing utils/objects imports in Dashboard..."
find Components/Dashboard -name "*.js" -type f -exec sed -i '' \
  -e 's|from "../utils/objects"|from "../../utils/objects"|g' \
  -e 's|from "../../utils"|from "../../../utils"|g' \
  {} \;

echo "Fixing Common, Layout, Menu, Models imports in Dashboard/Panel..."
find Components/Dashboard/Panel -name "*.js" -type f -exec sed -i '' \
  -e 's|from "../../Common"|from "@trops/dash-react"|g' \
  -e 's|from "../Layout"|from "../../Layout"|g' \
  -e 's|from "../Menu"|from "../../Menu"|g' \
  -e 's|from "../../Models"|from "../../../Models"|g' \
  {} \;

echo "Fixing @dash imports..."
find Components -name "*.js" -type f -exec sed -i '' \
  -e 's|from "@dash"|from "../../"|g' \
  {} \;

echo "Done!"
