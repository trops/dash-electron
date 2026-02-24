#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

// Get feature name from arguments
const featureName = process.argv[2];
const isDryRun = process.argv.includes("--dry-run");

if (!featureName) {
    console.error("❌ Error: Feature name is required");
    console.log('Usage: npm run prdize "Feature Name"');
    console.log('Example: npm run prdize "Widget Marketplace"');
    process.exit(1);
}

// Generate filename
const filename = featureName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const templatePath = path.join(
    __dirname,
    "../docs/requirements/PRD-TEMPLATE.md"
);
const prdDir = path.join(__dirname, "../docs/requirements/prd");
const outputPath = path.join(prdDir, `${filename}.md`);
const readmePath = path.join(__dirname, "../docs/requirements/README.md");

// Check if PRD already exists
if (fs.existsSync(outputPath)) {
    console.error(`❌ Error: PRD already exists at ${outputPath}`);
    console.log("\nTo edit existing PRD:");
    console.log(`  code ${outputPath}`);
    process.exit(1);
}

// Dry run - just show what would happen
if (isDryRun) {
    console.log("🔍 Dry run - no files will be created\n");
    console.log("Would create:");
    console.log(`  📄 ${outputPath}`);
    console.log(`  ✏️  Update: ${readmePath}`);
    console.log(`\nFeature: ${featureName}`);
    console.log(`Filename: ${filename}.md`);
    process.exit(0);
}

console.log(`📝 Creating PRD for: ${featureName}\n`);

// Create prd directory if it doesn't exist
if (!fs.existsSync(prdDir)) {
    fs.mkdirSync(prdDir, { recursive: true });
    console.log("✅ Created prd directory");
}

// Read template
if (!fs.existsSync(templatePath)) {
    console.error(`❌ Error: Template not found at ${templatePath}`);
    console.log("\nPlease ensure PRD-TEMPLATE.md exists in docs/requirements/");
    process.exit(1);
}

let content = fs.readFileSync(templatePath, "utf8");

// Replace placeholders
const today = new Date().toISOString().split("T")[0];
content = content.replace(/\[Feature Name\]/g, featureName);
content = content.replace(/YYYY-MM-DD/g, today);

// Write PRD file
fs.writeFileSync(outputPath, content);
console.log(`✅ Created: ${outputPath}`);

// Update README index
if (fs.existsSync(readmePath)) {
    let readme = fs.readFileSync(readmePath, "utf8");
    const newEntry = `- **[${featureName}](./prd/${filename}.md)** - Status: Draft - ${today}\n`;

    // Find "## Existing PRDs" section and add entry
    if (readme.includes("## Existing PRDs")) {
        // Add after the "## Existing PRDs" header and any existing entries
        readme = readme.replace(/(## Existing PRDs\n\n)/, `$1${newEntry}`);
        fs.writeFileSync(readmePath, readme);
        console.log(`✅ Updated: ${readmePath}`);
    } else {
        console.warn(
            '⚠️  Warning: Could not find "## Existing PRDs" section in README'
        );
        console.log("   Please manually add the following entry to README.md:");
        console.log(`   ${newEntry}`);
    }
} else {
    console.warn("⚠️  Warning: README.md not found at", readmePath);
}

// Summary
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("✅ PRD created successfully!");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
console.log("Next steps:");
console.log("1. Edit the PRD file and fill in the sections");
console.log("2. Define user personas and their pain points");
console.log("3. Write user stories with acceptance criteria");
console.log("4. Document user workflows with concrete examples");
console.log("5. Link to relevant technical documentation");
console.log(`\n📝 Open PRD: code ${outputPath}`);

// Optionally open in editor
if (process.env.EDITOR || process.env.VISUAL) {
    const editor = process.env.EDITOR || process.env.VISUAL;
    exec(`${editor} "${outputPath}"`, (err) => {
        if (err) {
            console.log("\n⚠️  Could not open editor automatically");
            console.log(
                "   You can manually open the file with your preferred editor"
            );
        }
    });
} else {
    console.log("\nTip: Set $EDITOR environment variable to auto-open files");
}
