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

    it("the dock hosts the Bot monitor panel and the AI Assistant", () => {
        expect(dockSrc).toMatch(/import \{ BotActivityPanel \}/);
        expect(dockSrc).toMatch(/<BotActivityPanel\s/);
        expect(dockSrc).toMatch(/<AiAssistantPanel\s/);
        expect(dockSrc).toMatch(/onApprovalsCount=\{setApprovals\}/);
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
