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

// Lead drafts (TEAM-005) are gone — the lead hands off to the Dash team
// (consolidation Phase 2c-2).
it("has no drafts IPC", () => {
    assert.doesNotMatch(
        src,
        /BOTS_LIST_DRAFTS|BOTS_DISMISS_DRAFT|botController\.(listDrafts|dismissDraft)/
    );
});

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

// Lead-workspace release 5: the asking conversation reaches botController
// (its bots record it on their runs) — a short string only.
describe("team lead IPC — the asking conversation", () => {
    it("BOTS_ASK_LEAD passes the asking conversation", () => {
        assert.match(
            src,
            /loggedHandle\(BOTS_ASK_LEAD,[\s\S]{0,900}conversationId:\s*msg &&\s*typeof msg\.conversationId === "string" &&\s*msg\.conversationId\.length <= 128/
        );
    });
});

// Bots view backend (bot-teams TEAM-011 / B1).
describe("Bots view IPC handlers", () => {
    it("BOTS_GET_RUNS → botController.getRuns(botId, { limit })", () => {
        assert.match(
            src,
            /loggedHandle\(\s*BOTS_GET_RUNS,[\s\S]{0,200}botController\.getRuns\([\s\S]{0,80}limit/
        );
    });

    it("BOTS_RUN passes continueConversation (reply to continue)", () => {
        assert.match(
            src,
            /loggedHandle\(\s*BOTS_RUN,[\s\S]{0,400}botController\.run\([\s\S]{0,120}continueConversation/
        );
    });
    it("BOTS_RUN passes planId (a Dash team run inside a Create plan, 4e-1)", () => {
        assert.match(
            src,
            /\{ botId, prompt, continueConversation, planId \}[\s\S]{0,400}planId: planId \|\| null/
        );
    });
});
