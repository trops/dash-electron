"use strict";

/**
 * botNotify.test.js — bot notices as OS notifications (bot-factory US-019 AC3,
 * US-018 AC5): failures only while Dash isn't focused, budget always, and a
 * click opens the bot.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { createBotNotifier } = require("./botNotify");

function setup({ focused = false } = {}) {
    const sent = [];
    const opened = [];
    const notify = createBotNotifier({
        notificationController: {
            send: (win, payload) => {
                sent.push({ win, payload });
                return { success: true };
            },
        },
        isDashFocused: () => focused,
        openBot: (botId) => opened.push(botId),
    });
    return { notify, sent, opened };
}

const failed = {
    kind: "failed",
    botId: "b1",
    title: "Bot failed",
    body: "Writer: API key rejected",
};
const warn = {
    kind: "budget-warn",
    botId: "b1",
    title: "Bot budget at 80%",
    body: "Writer has used 80% of its $5.00 monthly budget.",
};

describe("createBotNotifier", () => {
    it("sends a notice as a Bot Factory notification", () => {
        const { notify, sent } = setup();
        notify(failed);
        assert.equal(sent.length, 1);
        const p = sent[0].payload;
        assert.equal(p.widgetId, "@bots");
        assert.equal(p.widgetName, "Bot Factory");
        assert.equal(p.type, "bot-failed");
        assert.equal(p.title, "Bot failed");
        assert.equal(p.body, "Writer: API key rejected");
        assert.deepEqual(p.data, { botId: "b1" });
    });

    it("a failure while Dash is focused doesn't notify — the dock shows it", () => {
        const { notify, sent } = setup({ focused: true });
        notify(failed);
        assert.equal(sent.length, 0);
    });

    it("budget notices notify even while Dash is focused", () => {
        const { notify, sent } = setup({ focused: true });
        notify(warn);
        notify({ ...warn, kind: "budget-exceeded" });
        assert.deepEqual(
            sent.map((s) => s.payload.type),
            ["bot-budget-warn", "bot-budget-exceeded"]
        );
    });

    it("clicking opens the bot", () => {
        const { notify, sent, opened } = setup();
        notify(warn);
        sent[0].payload.onClick();
        assert.deepEqual(opened, ["b1"]);
    });

    it("ignores empty notices", () => {
        const { notify, sent } = setup();
        notify(null);
        notify({ kind: "failed" });
        assert.equal(sent.length, 0);
    });
});

describe("electron.js / botTray.js wiring (US-018 AC5, US-019 AC3)", () => {
    const fs = require("fs");
    const path = require("path");
    const electronSrc = fs.readFileSync(
        path.join(__dirname, "electron.js"),
        "utf8"
    );
    const traySrc = fs.readFileSync(path.join(__dirname, "botTray.js"), "utf8");

    it("botController gets the notifier", () => {
        assert.match(
            electronSrc,
            /botController\.init\(\{[\s\S]{0,200}notify: createBotNotifier\(\{\s+notificationController,\s+isDashFocused: \(\) => !!BrowserWindow\.getFocusedWindow\(\),\s+openBot: openBotFromNotification,/
        );
    });

    it("opening a bot asks the dock, then brings Dash up", () => {
        assert.match(
            electronSrc,
            /function openBotFromNotification\(botId\) \{\s+try \{\s+botController\.requestOpen\(botId\);[\s\S]{0,120}showMainWindow\(\);/
        );
        assert.match(
            electronSrc,
            /loggedHandle\(BOTS_TAKE_OPEN_REQUEST, \(\) =>\s+botController\.takeOpenRequest\(\)\s+\)/
        );
    });

    it("approval notifications open their bot too", () => {
        assert.match(
            electronSrc,
            /openBot: openBotFromNotification,\s+onQuit:/
        );
        assert.match(
            traySrc,
            /onClick: \(\) => \{\s+if \(deps && deps\.openBot && req\.botId\) deps\.openBot\(req\.botId\);/
        );
    });
});
