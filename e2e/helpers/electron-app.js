const { _electron: electron } = require("playwright");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");

/**
 * Launch the Electron app in development mode.
 * Expects the React dev server to already be running at http://localhost:3000.
 *
 * @returns {{ electronApp: import('playwright').ElectronApplication, window: import('playwright').Page }}
 */
async function launchApp() {
    const electronApp = await electron.launch({
        args: [path.join(ROOT, "public/electron.js")],
        cwd: ROOT,
        env: {
            ...process.env,
            NODE_ENV: "development",
        },
    });

    // Wait for the first BrowserWindow to open
    const window = await electronApp.firstWindow();

    // Wait for React to mount
    await window.waitForSelector("#root > *", { timeout: 30000 });

    // Wait for the app to settle (sidebar, modals, etc.)
    await window.waitForTimeout(2000);

    // Dismiss the settings modal if it auto-opened (happens when no folders exist)
    const doneButton = window.getByText("Done", { exact: true });
    if (await doneButton.isVisible().catch(() => false)) {
        await doneButton.click();
        await window.waitForTimeout(500);
    }

    return { electronApp, window };
}

/**
 * Close the Electron app cleanly.
 * @param {import('playwright').ElectronApplication} electronApp
 */
async function closeApp(electronApp) {
    if (electronApp) {
        await electronApp.close();
    }
}

module.exports = { launchApp, closeApp };
