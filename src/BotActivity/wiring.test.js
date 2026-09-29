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

describe("Bot Activity panel mount (Dash.js)", () => {
    it("imports and mounts BotActivityPanel alongside AiAssistantPanel", () => {
        expect(dashSrc).toMatch(/import \{ BotActivityPanel \}/);
        expect(dashSrc).toMatch(/<BotActivityPanel \/>/);
        expect(dashSrc).toMatch(/<AiAssistantPanel \/>/);
    });
});
