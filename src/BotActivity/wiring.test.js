/**
 * Static wiring pins for Slice 7-Activity: the budget IPC handlers are
 * registered in electron.js and the Bot Activity panel is mounted in Dash.js.
 */
const fs = require("fs");
const path = require("path");

const electronSrc = fs.readFileSync(
    path.join(__dirname, "../../public/electron.js"),
    "utf8"
);
const dashSrc = fs.readFileSync(path.join(__dirname, "../Dash.js"), "utf8");

describe("Bot Factory budget IPC handlers (electron.js)", () => {
    const channels = [
        "BOTS_GET_BUDGETS",
        "BOTS_SET_BUDGET",
        "BOTS_GET_SPEND",
        "BOTS_RESUME_BUDGET",
    ];

    it("imports the 4 budget channel constants", () => {
        for (const c of channels) {
            expect(electronSrc).toMatch(new RegExp("\\b" + c + "\\b"));
        }
    });

    it("registers a handler for each budget channel", () => {
        for (const c of channels) {
            expect(electronSrc).toMatch(new RegExp("loggedHandle\\(" + c));
        }
        expect(electronSrc).toMatch(/botController\.getBudgets/);
        expect(electronSrc).toMatch(/botController\.resumeBudget/);
    });
});

describe("Bot Activity panel mount (AssistantDock)", () => {
    const dockSrc = fs.readFileSync(
        path.join(__dirname, "../AssistantDock/AssistantDock.js"),
        "utf8"
    );

    it("Dash.js mounts the dock as the stage's assistant", () => {
        expect(dashSrc).toMatch(/renderAiAssistant=\{<AssistantDock \/>\}/);
    });

    it("registers the spending-summary channel (US-019 slice B)", () => {
        expect(electronSrc).toMatch(
            /loggedHandle\(BOTS_SPENDING_SUMMARY, \(\) =>\s*botController\.spendingSummary\(\)\s*\)/
        );
    });

    it("registers the audit-log channel for Manage › Bots › Log (US-003 AC5)", () => {
        expect(electronSrc).toMatch(
            /loggedHandle\(BOTS_AUDIT_LOG, \(e, filters\) =>\s*botController\.auditLog\(filters \|\| \{\}\)\s*\)/
        );
    });

    it("registers the budget-status channel for the Bots panel (US-019)", () => {
        expect(electronSrc).toMatch(
            /loggedHandle\(BOTS_BUDGET_STATUS, \(\) =>\s*botController\.budgetStatus\(\)\s*\)/
        );
    });

    it("the panel registers the last-runs channel for the contacts (TEAM-015)", () => {
        expect(electronSrc).toMatch(
            /loggedHandle\(BOTS_LAST_RUNS, \(\) => botController\.lastRuns\(\)\)/
        );
    });

    it("the dock hosts the Bots panel — not the retired AI Assistant (5e-2c)", () => {
        expect(dockSrc).toMatch(/import \{ BotActivityPanel \}/);
        expect(dockSrc).toMatch(/<BotActivityPanel\s/);
        expect(dockSrc).not.toMatch(/AiAssistantPanel/);
        expect(dockSrc).toMatch(/onNeedsChange=\{onNeedsChange\}/);
    });

    it("the rail is Bots only; a folded plan still opens Create (Phase 2a)", () => {
        expect(dockSrc).not.toMatch(/railButton\("create"/);
        expect(dockSrc).toMatch(/railButton\(\s*"bots"/);
        expect(dockSrc).toMatch(
            /addEventListener\("dash:create-fold", onFold\)/
        );
        expect(dockSrc).toMatch(/<CreateDockPanel\s/);
    });
});

describe("Bots view popouts (Dash.js, TEAM-011 B3)", () => {
    it("passes the popout's view, bot and tab to the stage", () => {
        expect(dashSrc).toMatch(/useSearchParams/);
        expect(dashSrc).toMatch(/popoutView=\{search\.get\("view"\)\}/);
        expect(dashSrc).toMatch(/popoutBotId=\{search\.get\("bot"\)\}/);
        expect(dashSrc).toMatch(/popoutBotTab=\{search\.get\("tab"\)\}/);
    });
});

describe("Main window start-up (electron.js)", () => {
    it("opens on Dash's background, hidden until the page has painted", () => {
        expect(electronSrc).toMatch(
            /backgroundColor: "#0a0b10",\s+show: false,/
        );
        expect(electronSrc).toMatch(
            /shownWindow\.once\("ready-to-show", revealWindow\)/
        );
        expect(electronSrc).toMatch(/setTimeout\(revealWindow, 5000\)/);
    });
});

describe("Quitting with bots mid-run (electron.js, US-018 AC6)", () => {
    it("asks before quitting: stop them, quit when they finish, or cancel", () => {
        expect(electronSrc).toMatch(
            /function holdQuitForRunningBots\(quit, onCancel = null\)/
        );
        expect(electronSrc).toMatch(/botController\.listRunning\(\)/);
        expect(electronSrc).toMatch(
            /\["Stop them and quit", "Quit when they finish", "Cancel"\]/
        );
        expect(electronSrc).toMatch(/\.interruptAll\(\)/);
        expect(electronSrc).toMatch(/botController\.whenIdle\(\)/);
    });

    it("checks before any await in before-quit, and from the tray's Quit", () => {
        expect(electronSrc).toMatch(
            /app\.on\("before-quit", async \(e\) => \{\s+(\/\/[^\n]*\s+)*if \(!holdQuitForRunningBots\(\(\) => app\.quit\(\)\)\) \{\s+e\.preventDefault\(\);/
        );
        expect(electronSrc).toMatch(
            /if \(holdQuitForRunningBots\(quit\)\) quit\(\);/
        );
    });
});
