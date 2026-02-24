#!/bin/bash

# Dash Application Validation Script
# This script validates that the Dash application builds and runs correctly

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Validating Dash Application...${NC}\n"

# Step 1: Prettify
echo -e "${YELLOW}📝 Step 1/3: Running Prettier...${NC}"
if npm run prettify > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Code formatted successfully${NC}\n"
else
    echo -e "${RED}❌ Prettier failed${NC}"
    exit 1
fi

# Step 2: Check build (with timeout)
echo -e "${YELLOW}🏗️  Step 2/3: Checking React build...${NC}"
echo -e "${BLUE}   (This will take ~30 seconds)${NC}"

# Create temp log file
BUILD_LOG=$(mktemp)

# Start dev server in background
BROWSER=none npm start > "$BUILD_LOG" 2>&1 &
BUILD_PID=$!

# Wait for success or timeout (30 seconds)
SUCCESS=false
for i in {1..60}; do
    if grep -q "Compiled successfully" "$BUILD_LOG" 2>/dev/null; then
        SUCCESS=true
        break
    fi
    sleep 0.5
done

# Kill the dev server
kill $BUILD_PID 2>/dev/null || true
sleep 1

# Check for any remaining processes
pkill -P $BUILD_PID 2>/dev/null || true

if [ "$SUCCESS" = true ]; then
    echo -e "${GREEN}✅ Build successful - no errors detected${NC}\n"
else
    echo -e "${RED}❌ Build failed or timed out${NC}"
    echo -e "${YELLOW}Last 30 lines of build output:${NC}"
    tail -30 "$BUILD_LOG"
    rm "$BUILD_LOG"
    exit 1
fi

# Clean up log file
rm "$BUILD_LOG"

# Step 3: Validation summary
echo -e "${YELLOW}📋 Step 3/3: Validation Summary${NC}"
echo -e "${GREEN}✅ Code formatting: PASSED${NC}"
echo -e "${GREEN}✅ React build: PASSED${NC}"

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ All validations passed!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${BLUE}Next steps:${NC}"
echo -e "  • Build CSS if needed: ${YELLOW}npm run build:css${NC}"
echo -e "  • Run ${YELLOW}npm run dev${NC} to start the full Electron app"
echo -e "  • Check DevTools console for theme loading messages"
echo -e "  • Verify components render with correct colors\n"

exit 0
