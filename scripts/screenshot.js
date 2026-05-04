const { _electron: electron } = require("playwright");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

async function main() {
    const args = process.argv.slice(2);
    let outputPath = "/tmp/dash-review.png";
    let screenshotSelector = null;
    const navSteps = []; // ordered list of { type, value }
    let stepsFile = null;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--click" && args[i + 1]) {
            navSteps.push({ type: "text", value: args[++i] });
        } else if (args[i] === "--click-selector" && args[i + 1]) {
            navSteps.push({ type: "selector", value: args[++i] });
        } else if (args[i] === "--selector" && args[i + 1]) {
            screenshotSelector = args[++i];
        } else if (args[i] === "--steps" && args[i + 1]) {
            stepsFile = args[++i];
        } else if (!args[i].startsWith("--")) {
            outputPath = args[i];
        }
    }

    const electronApp = await electron.launch({
        args: [path.join(ROOT, "public/electron.js")],
        cwd: ROOT,
        env: {
            ...process.env,
            NODE_ENV: "development",
            // Mirror `npm run dev` / `npm run electron`: when dash-core or
            // dash-react is symlinked via `link-core` / `link-react`,
            // require() must resolve from the symlink path so transitive
            // deps (electron-store, etc.) are found in dash-electron's
            // node_modules instead of failing inside the linked repo.
            NODE_OPTIONS: "--preserve-symlinks",
        },
    });

    const window = await electronApp.firstWindow();
    await window.waitForSelector("#root > *", { timeout: 30000 });
    await window.waitForTimeout(2000);

    // Dismiss settings modal if present
    const doneButton = window.getByText("Done", { exact: true });
    if (await doneButton.isVisible().catch(() => false)) {
        await doneButton.click();
        await window.waitForTimeout(500);
    }

    // Run steps file first
    if (stepsFile) {
        const navigate = require(path.resolve(stepsFile));
        await navigate(window);
    }

    // Run sequential click navigation
    for (const step of navSteps) {
        if (step.type === "text") {
            await window.getByText(step.value, { exact: true }).click();
        } else {
            await window.locator(step.value).click();
        }
        await window.waitForTimeout(500);
    }

    // Take screenshot
    if (screenshotSelector) {
        await window
            .locator(screenshotSelector)
            .screenshot({ path: outputPath });
    } else {
        await window.screenshot({ path: outputPath });
    }

    console.log("Screenshot saved to", outputPath);
    await electronApp.close();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
