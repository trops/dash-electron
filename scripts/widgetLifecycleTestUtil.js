// widgetLifecycleTestUtil.js
// Utility to scaffold, zip, and move test widgets for lifecycle/integration testing

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const PROJECT_ROOT = process.cwd();
const WIDGETS_DIR = path.join(PROJECT_ROOT, "src/Widgets");
const USER_WIDGETS_DIR = path.join(PROJECT_ROOT, "user-widgets"); // Standardized location

function runWidgetize(widgetName) {
    console.log(`\n[widgetize] Scaffolding widget: ${widgetName}`);
    execSync(`npm run widgetize -- --name ${widgetName}`, { stdio: "inherit" });
}

function zipWidget(widgetName) {
    const widgetDir = path.join(WIDGETS_DIR, widgetName);
    const zipPath = path.join(USER_WIDGETS_DIR, `${widgetName}.zip`);
    if (!fs.existsSync(USER_WIDGETS_DIR))
        fs.mkdirSync(USER_WIDGETS_DIR, { recursive: true });
    // Use system zip command for simplicity
    execSync(`cd ${WIDGETS_DIR} && zip -r ${zipPath} ${widgetName}`, {
        stdio: "inherit",
    });
    return zipPath;
}

function cleanupWidget(widgetName) {
    const widgetDir = path.join(WIDGETS_DIR, widgetName);
    if (fs.existsSync(widgetDir)) {
        fs.rmSync(widgetDir, { recursive: true, force: true });
        console.log(`[cleanup] Removed widget directory: ${widgetDir}`);
    }
}

function main() {
    const widgetName = process.argv[2] || "MyFirstWidget";
    runWidgetize(widgetName);
    const zipPath = zipWidget(widgetName);
    cleanupWidget(widgetName);
    console.log(`\n[done] Widget zip created at: ${zipPath}`);
    console.log(`[info] User widgets directory: ${USER_WIDGETS_DIR}`);
    console.log("[info] You can now test dynamic loading from this directory.");
}

if (require.main === module) {
    main();
}
