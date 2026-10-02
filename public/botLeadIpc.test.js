/**
 * Static pin: every team-lead IPC channel (bot-teams TEAM-002 / TEAM-003) has
 * a main-process handler wired to botController.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "electron.js"), "utf8");

const CHANNELS = {
    BOTS_ENSURE_LEAD: "botController.ensureLead(",
    BOTS_SET_LEAD_ENABLED: "botController.setLeadEnabled(",
    BOTS_GET_TEAM_SETTINGS: "botController.getTeamSettings(",
    BOTS_DISMISS_LEAD_INTRO: "botController.dismissLeadIntro(",
    BOTS_GET_SETTINGS: "botController.getBotSettings(",
    BOTS_SET_SETTINGS: "botController.setBotSettings(",
    BOTS_ASK_LEAD: "botController.askLead(",
};

describe("team lead IPC handlers", () => {
    for (const [channel, call] of Object.entries(CHANNELS)) {
        it(`${channel} → ${call}`, () => {
            const re = new RegExp(
                `loggedHandle\\(${channel},[\\s\\S]{0,240}${call.replace(
                    /[.(]/g,
                    "\\$&"
                )}`
            );
            assert.match(src, re);
        });
    }
});
