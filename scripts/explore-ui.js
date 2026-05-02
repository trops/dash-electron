#!/usr/bin/env node
/**
 * UI exploration script.
 *
 * Launches the Electron app the same way `npm run test:e2e` does,
 * navigates to a named destination, and dumps the accessibility
 * tree snapshot to stdout. Used while authoring new e2e specs to
 * grab the exact button names / roles / containers up front,
 * instead of iterating through failed test runs to discover them.
 *
 * Prereqs:
 *   - The React dev server is running:  npm start  (port 3000)
 *
 * Usage:
 *   node scripts/explore-ui.js                   # opens app, dumps home state
 *   node scripts/explore-ui.js --to settings     # opens Settings modal
 *   node scripts/explore-ui.js --to settings.themes
 *   node scripts/explore-ui.js --to settings.themes.discover
 *   node scripts/explore-ui.js --to settings.themes.fromUrl
 *   node scripts/explore-ui.js --to settings.widgets
 *   node scripts/explore-ui.js --to settings.widgets.discover
 *   node scripts/explore-ui.js --to settings.dashboards
 *   node scripts/explore-ui.js --to settings.dashboards.discover
 *   node scripts/explore-ui.js --to settings.providers
 *   node scripts/explore-ui.js --to settings.account
 *
 * Flags:
 *   --to <path>           Destination (default: home)
 *   --hermetic            Use a fresh user-data dir (default: true). Pass
 *                         --no-hermetic to use the dev's actual install
 *                         (useful for inspecting real installed widgets).
 *   --screenshot <file>   Also save a PNG to <file>
 *   --output <file>       Write snapshot to <file> instead of stdout
 *   --help                Show this help
 *
 * Output is the YAML-shaped accessibility snapshot Playwright produces,
 * which mirrors what shows up in `error-context.md` during failed runs.
 */

const { _electron: electron } = require("playwright");
const path = require("path");
const fs = require("fs");
const os = require("os");

const ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
    const out = { to: "home", hermetic: true };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--help" || a === "-h") {
            out.help = true;
        } else if (a === "--to") {
            out.to = argv[++i];
        } else if (a === "--hermetic") {
            out.hermetic = true;
        } else if (a === "--no-hermetic") {
            out.hermetic = false;
        } else if (a === "--screenshot") {
            out.screenshot = argv[++i];
        } else if (a === "--output") {
            out.output = argv[++i];
        }
    }
    return out;
}

function helpText() {
    const src = fs.readFileSync(__filename, "utf8");
    const m = src.match(/\/\*\*[\s\S]*?\*\//);
    return m
        ? m[0].replace(/^\s*\*\s?/gm, "").replace(/^\/\*\*|\*\/$/g, "")
        : "";
}

async function dismissAutoModal(win) {
    const done = win.getByText("Done", { exact: true });
    if (await done.isVisible().catch(() => false)) {
        await done.click();
        await win.waitForTimeout(500);
    }
}

async function openSettingsModal(win) {
    const sidebar = win.locator("aside");
    await sidebar.getByText("Account", { exact: true }).click();
    await win.waitForTimeout(500);
    await win
        .getByRole("button", { name: "Settings", exact: true })
        .first()
        .click();
    await win.waitForTimeout(1000);
}

async function clickSection(win, sectionName) {
    // Scope to the Settings dialog so we don't accidentally hit the
    // app-sidebar "Account" button (which toggles the popover, not
    // navigates inside the modal).
    await win
        .getByRole("dialog")
        .getByRole("button", { name: sectionName, exact: true })
        .first()
        .click();
    await win.waitForTimeout(500);
}

const destinations = {
    home: async (_win) => {},
    newDashboard: async (win) => {
        // Click "New Dashboard" in sidebar Dashboards group, then dump
        // whatever modal/picker opens.
        await win.locator("aside").getByText("New Dashboard").first().click();
        await win.waitForTimeout(1000);
    },
    "newDashboard.blank": async (win) => {
        // Click sidebar "New Dashboard" → dialog "New Dashboard"
        // (start from a blank template) → dump next state.
        await win.locator("aside").getByText("New Dashboard").first().click();
        await win.waitForTimeout(1000);
        // The dialog has its own "New Dashboard" button — distinguish via
        // role + name. Use second `New Dashboard` since the first is the
        // sidebar button. The dialog button has a fuller name.
        await win
            .getByRole("button", { name: /New Dashboard.*blank template/ })
            .click();
        await win.waitForTimeout(1000);
    },
    settings: async (win) => {
        await openSettingsModal(win);
    },
    "settings.themes": async (win) => {
        await openSettingsModal(win);
        await clickSection(win, "Themes");
    },
    "settings.themes.discover": async (win) => {
        await openSettingsModal(win);
        await clickSection(win, "Themes");
        await win.getByText("New Theme", { exact: true }).click();
        await win.waitForTimeout(500);
        await win.getByText("Search Marketplace", { exact: true }).click();
        await win.waitForTimeout(1000);
    },
    "settings.themes.fromUrl": async (win) => {
        await openSettingsModal(win);
        await clickSection(win, "Themes");
        await win.getByText("New Theme", { exact: true }).click();
        await win.waitForTimeout(500);
        await win.getByText("From Website", { exact: true }).click();
        await win.waitForTimeout(500);
    },
    "settings.widgets": async (win) => {
        await openSettingsModal(win);
        await clickSection(win, "Widgets");
    },
    "settings.widgets.installPicker": async (win) => {
        // After clicking "Install Widgets" — shows the picker with
        // registry / file / folder install options.
        await openSettingsModal(win);
        await clickSection(win, "Widgets");
        await win.getByText("Install Widgets", { exact: true }).click();
        await win.waitForTimeout(1000);
    },
    "settings.widgets.discover": async (win) => {
        await openSettingsModal(win);
        await clickSection(win, "Widgets");
        const installBtn = win.getByText("Install Widgets", { exact: true });
        if (await installBtn.isVisible().catch(() => false)) {
            await installBtn.click();
            await win.waitForTimeout(500);
        }
        const search = win.getByText("Search for Widgets", { exact: true });
        if (await search.isVisible().catch(() => false)) {
            await search.click();
            await win.waitForTimeout(1000);
        }
    },
    "settings.dashboards": async (win) => {
        await openSettingsModal(win);
        await clickSection(win, "Dashboards");
    },
    "settings.dashboards.discover": async (win) => {
        await openSettingsModal(win);
        await clickSection(win, "Dashboards");
        const discover = win.getByText("Discover", { exact: true }).first();
        if (await discover.isVisible().catch(() => false)) {
            await discover.click();
            await win.waitForTimeout(1000);
        }
    },
    "settings.folders": async (win) => {
        await openSettingsModal(win);
        await clickSection(win, "Folders");
    },
    "settings.folders.new": async (win) => {
        await openSettingsModal(win);
        await clickSection(win, "Folders");
        await win.getByText("New Folder", { exact: true }).click();
        await win.waitForTimeout(500);
    },
    "settings.providers": async (win) => {
        await openSettingsModal(win);
        await clickSection(win, "Providers");
    },
    "settings.notifications": async (win) => {
        await openSettingsModal(win);
        await clickSection(win, "Notifications");
    },
    "settings.mcpServer": async (win) => {
        await openSettingsModal(win);
        await clickSection(win, "MCP Server");
    },
    "settings.aiAssistant": async (win) => {
        await openSettingsModal(win);
        await clickSection(win, "AI Assistant");
    },
    "settings.general": async (win) => {
        await openSettingsModal(win);
        await clickSection(win, "General");
    },
    "settings.providers.new": async (win) => {
        await openSettingsModal(win);
        await clickSection(win, "Providers");
        await win.getByText("New Provider", { exact: true }).click();
        await win.waitForTimeout(1000);
    },
    "settings.providers.newCredential": async (win) => {
        await openSettingsModal(win);
        await clickSection(win, "Providers");
        await win.getByText("New Provider", { exact: true }).click();
        await win.waitForTimeout(500);
        await win.getByRole("button", { name: /Credential.*API key/ }).click();
        await win.waitForTimeout(500);
    },
    "settings.account": async (win) => {
        await openSettingsModal(win);
        await clickSection(win, "Account");
    },
    "settings.dashboards.section": async (win) => {
        await openSettingsModal(win);
        await clickSection(win, "Dashboards");
    },
};

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log(helpText());
        process.exit(0);
    }

    const dest = destinations[args.to];
    if (!dest) {
        console.error(`Unknown destination: ${args.to}`);
        console.error(`Known: ${Object.keys(destinations).join(", ")}`);
        process.exit(1);
    }

    const launchArgs = [path.join(ROOT, "public/electron.js")];
    let tempUserData = null;
    if (args.hermetic) {
        tempUserData = fs.mkdtempSync(path.join(os.tmpdir(), "dash-explore-"));
        launchArgs.push(`--user-data-dir=${tempUserData}`);
    }

    process.stderr.write(
        `[explore-ui] launching (${
            args.hermetic ? "hermetic" : "real-data"
        }) → ${args.to}\n`
    );

    const app = await electron.launch({
        args: launchArgs,
        cwd: ROOT,
        env: {
            ...process.env,
            NODE_ENV: "development",
            DASH_E2E: "1",
        },
    });

    const win = await app.firstWindow();
    await win.waitForSelector("#root > *", { timeout: 30000 });
    await win.waitForTimeout(2000);
    await dismissAutoModal(win);

    try {
        await dest(win);
    } catch (e) {
        process.stderr.write(
            `[explore-ui] navigation failed at "${args.to}": ${e.message}\n`
        );
        process.stderr.write(
            "[explore-ui] dumping snapshot at the point of failure anyway\n"
        );
    }

    await win.waitForTimeout(500);

    // Dump the accessibility tree (same shape as failure-trace
    // error-context.md). Use ariaSnapshot which returns the YAML form
    // we've been reading.
    const snapshot = await win.locator("body").ariaSnapshot();
    const out = `# Page snapshot — destination: ${args.to}\n\n\`\`\`yaml\n${snapshot}\n\`\`\`\n`;

    if (args.output) {
        fs.writeFileSync(args.output, out);
        process.stderr.write(
            `[explore-ui] snapshot written to ${args.output}\n`
        );
    } else {
        process.stdout.write(out);
    }

    if (args.screenshot) {
        await win.screenshot({ path: args.screenshot, fullPage: true });
        process.stderr.write(
            `[explore-ui] screenshot written to ${args.screenshot}\n`
        );
    }

    await app.close();
    if (tempUserData) {
        try {
            fs.rmSync(tempUserData, { recursive: true, force: true });
        } catch (_) {}
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
