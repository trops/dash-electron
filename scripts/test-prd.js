#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const prdName = process.argv[2];
const showChecklist = process.argv.includes("--checklist");

if (!prdName) {
    console.error("❌ Error: PRD name is required");
    console.log("Usage: npm run test:prd [prd-name]");
    console.log("Example: npm run test:prd layout-builder-hybrid");
    console.log("\nOptions:");
    console.log("  --checklist  Show manual verification checklist");
    process.exit(1);
}

const prdPath = path.join(__dirname, `../docs/requirements/prd/${prdName}.md`);

if (!fs.existsSync(prdPath)) {
    console.error(`❌ Error: PRD not found at ${prdPath}`);
    console.log("\nAvailable PRDs:");

    const prdDir = path.join(__dirname, "../docs/requirements/prd");
    if (fs.existsSync(prdDir)) {
        const files = fs.readdirSync(prdDir).filter((f) => f.endsWith(".md"));
        if (files.length > 0) {
            files.forEach((file) => {
                console.log(`  - ${file.replace(".md", "")}`);
            });
        } else {
            console.log("  (No PRDs found)");
        }
    }

    process.exit(1);
}

const content = fs.readFileSync(prdPath, "utf8");

// Parse user stories and acceptance criteria
const userStories = [];
let currentStory = null;
let currentPriority = null;

const lines = content.split("\n");
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match priority section headers (e.g., "### Must-Have (P0)")
    const priorityMatch = line.match(
        /^###\s+(Must-Have|Should-Have|Nice-to-Have)\s+\(P(\d+)\)/
    );
    if (priorityMatch) {
        currentPriority = {
            label: priorityMatch[1],
            level: `P${priorityMatch[2]}`,
        };
        continue;
    }

    // Match user story (e.g., "**US-001: Story Title**")
    const storyMatch = line.match(/^\*\*US-(\d+):\s*(.+?)\*\*/);
    if (storyMatch) {
        if (currentStory) {
            userStories.push(currentStory);
        }
        currentStory = {
            id: storyMatch[1],
            title: storyMatch[2],
            priority: currentPriority,
            acceptanceCriteria: [],
            edgeCases: [],
            technicalNotes: "",
            exampleScenario: "",
        };
        continue;
    }

    // Match acceptance criteria (e.g., "- [ ] AC1: ...")
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

// Display results
console.log(`\n📋 Testing PRD: ${prdName}.md`);
console.log(`Found ${userStories.length} user stories\n`);

let totalACs = 0;
let completedACs = 0;

userStories.forEach((story) => {
    const acCount = story.acceptanceCriteria.length;
    const completedCount = story.acceptanceCriteria.filter(
        (ac) => ac.completed
    ).length;
    totalACs += acCount;
    completedACs += completedCount;

    const priorityLabel = story.priority ? `${story.priority.level}` : "";
    const completionPct =
        acCount > 0 ? Math.round((completedCount / acCount) * 100) : 0;

    console.log(`US-${story.id}: ${story.title} ${priorityLabel}`);

    if (acCount > 0) {
        console.log(
            `  Progress: ${completedCount}/${acCount} (${completionPct}%)`
        );
    }

    story.acceptanceCriteria.forEach((ac, idx) => {
        const checkbox = ac.completed ? "✓" : " ";
        console.log(`  [${checkbox}] ${ac.text}`);
    });
    console.log("");
});

console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Total Acceptance Criteria: ${totalACs}`);
console.log(`Completed: ${completedACs}`);
console.log(`Remaining: ${totalACs - completedACs}`);

if (totalACs > 0) {
    const overallPct = Math.round((completedACs / totalACs) * 100);
    console.log(`Overall Progress: ${overallPct}%`);
}

console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

if (showChecklist) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📝 Manual Verification Checklist");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("Steps to verify acceptance criteria:\n");
    console.log("1. Start development server");
    console.log("   npm run dev\n");
    console.log("2. Navigate to feature in browser");
    console.log("   Open the dashboard or component being tested\n");
    console.log("3. Verify each acceptance criterion");
    console.log("   Follow the steps described in each AC\n");
    console.log("4. Update PRD file to mark completed criteria");
    console.log(`   code ${prdPath}`);
    console.log("   Change [ ] to [x] for verified criteria\n");
    console.log("5. Re-run this script to see updated progress");
    console.log(`   npm run test:prd ${prdName}\n`);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💡 Tips:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("- Test in multiple browsers (Chrome, Firefox, Safari)");
    console.log("- Test keyboard navigation for accessibility");
    console.log("- Test edge cases documented in PRD");
    console.log("- Take screenshots of successful tests");
    console.log("- Document any issues or deviations from expected behavior\n");
}

// Exit with error code if there are incomplete ACs (useful for CI/CD)
const hasIncomplete = totalACs > completedACs;
if (hasIncomplete) {
    console.log("⚠️  Some acceptance criteria are not yet completed");
    process.exit(0); // Don't fail CI, just inform
} else if (totalACs > 0) {
    console.log("✅ All acceptance criteria completed!");
    process.exit(0);
} else {
    console.log("ℹ️  No acceptance criteria found in this PRD");
    process.exit(0);
}
