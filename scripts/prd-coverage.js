#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const prdName = process.argv[2];

if (!prdName) {
    console.error("❌ Error: PRD name is required");
    console.log("Usage: npm run prd:coverage [prd-name]");
    console.log("Example: npm run prd:coverage layout-builder-hybrid");
    process.exit(1);
}

const prdPath = path.join(__dirname, `../docs/requirements/prd/${prdName}.md`);

if (!fs.existsSync(prdPath)) {
    console.error(`❌ Error: PRD not found at ${prdPath}`);
    process.exit(1);
}

const content = fs.readFileSync(prdPath, "utf8");

// Parse user stories and acceptance criteria
const userStories = [];
let currentStory = null;

const lines = content.split("\n");
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match user story
    const storyMatch = line.match(/^\*\*US-(\d+):\s*(.+?)\*\*/);
    if (storyMatch) {
        if (currentStory) {
            userStories.push(currentStory);
        }
        currentStory = {
            id: storyMatch[1],
            title: storyMatch[2],
            acceptanceCriteria: [],
        };
        continue;
    }

    // Match acceptance criteria
    const acMatch = line.match(/^-\s*\[\s*([x ])\s*\]\s*(.+)/);
    if (acMatch && currentStory) {
        currentStory.acceptanceCriteria.push({
            text: acMatch[2],
            completed: acMatch[1] === "x",
        });
    }
}

if (currentStory) {
    userStories.push(currentStory);
}

// Check for test files (basic implementation)
const testDir = path.join(__dirname, "../tests/prd");
const testFile = path.join(testDir, `${prdName}.test.js`);
const hasTestFile = fs.existsSync(testFile);

console.log(`\n📊 PRD Coverage Report: ${prdName}.md`);
console.log(`${"=".repeat(60)}\n`);

if (hasTestFile) {
    console.log(`✅ Test file found: tests/prd/${prdName}.test.js\n`);
} else {
    console.log(`⚠️  No test file found at: tests/prd/${prdName}.test.js`);
    console.log(`   Create this file to track automated test coverage\n`);
}

let totalACs = 0;
let automatedACs = 0;

userStories.forEach((story) => {
    const acCount = story.acceptanceCriteria.length;
    totalACs += acCount;

    // For now, we'll mark completed ACs as "automated" (placeholder)
    // In a full implementation, this would analyze test files
    const automatedCount = story.acceptanceCriteria.filter(
        (ac) => ac.completed
    ).length;
    automatedACs += automatedCount;

    const coverage =
        acCount > 0 ? Math.round((automatedCount / acCount) * 100) : 0;

    console.log(`US-${story.id}: ${story.title}`);

    story.acceptanceCriteria.forEach((ac) => {
        const status = ac.completed ? "✅" : "⚠️ ";
        const label = ac.completed ? "verified" : "manual only";
        console.log(`  ${status} ${ac.text.substring(0, 60)}... (${label})`);
    });

    console.log(
        `  Coverage: ${coverage}% (${automatedCount}/${acCount} verified)\n`
    );
});

console.log(`${"=".repeat(60)}`);

if (totalACs > 0) {
    const overallCoverage = Math.round((automatedACs / totalACs) * 100);
    console.log(
        `\nOverall Coverage: ${overallCoverage}% (${automatedACs}/${totalACs} verified)`
    );
    console.log(`Acceptance Criteria Verified: ${automatedACs}`);
    console.log(`Acceptance Criteria Not Verified: ${totalACs - automatedACs}`);
} else {
    console.log("\nNo acceptance criteria found in this PRD");
}

console.log("");

if (!hasTestFile) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💡 Next Steps:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log(`1. Create test file: tests/prd/${prdName}.test.js`);
    console.log("2. Write tests for each acceptance criterion");
    console.log("3. Mark criteria as verified ([x]) when tests pass");
    console.log("4. Re-run this script to see updated coverage\n");
}

console.log("Note: This is a basic coverage report.");
console.log("In the future, this script will analyze test files to determine");
console.log("which acceptance criteria have automated tests.\n");

process.exit(0);
