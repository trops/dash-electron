"use strict";

/**
 * botBackground.test.js — pure background-mode helpers (Slice 6b).
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
    botsWantBackground,
    describeTrayState,
    backgroundPlan,
    approvalMenuItems,
} = require("./botBackground");

describe("botsWantBackground", () => {
    it("is true when any bot has a non-empty cron schedule", () => {
        assert.equal(
            botsWantBackground([
                { id: "a", schedules: [] },
                { id: "b", schedules: [{ cron: "0 9 * * *" }] },
            ]),
            true
        );
    });

    it("is false when no bot has a usable schedule", () => {
        assert.equal(botsWantBackground([]), false);
        assert.equal(botsWantBackground([{ id: "a" }]), false);
        assert.equal(
            botsWantBackground([{ id: "a", schedules: [{ cron: "  " }] }]),
            false
        );
        assert.equal(
            botsWantBackground([{ id: "a", schedules: [{ prompt: "hi" }] }]),
            false
        );
    });

    it("tolerates non-array input", () => {
        assert.equal(botsWantBackground(null), false);
        assert.equal(botsWantBackground(undefined), false);
        assert.equal(botsWantBackground("bots"), false);
    });
});

describe("describeTrayState", () => {
    it("summarizes running + pending counts and pause label/badge", () => {
        assert.deepEqual(
            describeTrayState({
                running: [{ id: "a" }],
                approvals: [{ id: "x" }, { id: "y" }],
                paused: false,
            }),
            {
                summary: "1 running · 2 pending",
                pauseLabel: "Pause all bots",
                badge: "2",
            }
        );
    });

    it("reflects the paused state and clears the badge when nothing pends", () => {
        assert.deepEqual(describeTrayState({ paused: true }), {
            summary: "Bots paused",
            pauseLabel: "Resume all bots",
            badge: "",
        });
    });

    it("defaults cleanly with no argument", () => {
        assert.deepEqual(describeTrayState(), {
            summary: "0 running · 0 pending",
            pauseLabel: "Pause all bots",
            badge: "",
        });
    });
});

describe("backgroundPlan — the background-mode settings (US-018 AC1-AC4)", () => {
    const scheduled = [{ id: "a", schedules: [{ cron: "0 9 * * *" }] }];
    const defaults = { background: true, startAtLogin: true, keepAwake: false };

    it("defaults: a scheduled bot keeps Dash in the tray and starts it at login", () => {
        assert.deepEqual(
            backgroundPlan({ bots: scheduled, settings: defaults }),
            { stayInTray: true, openAtLogin: true, keepAwake: false }
        );
    });

    it("missing settings read as the defaults", () => {
        assert.deepEqual(backgroundPlan({ bots: scheduled, settings: null }), {
            stayInTray: true,
            openAtLogin: true,
            keepAwake: false,
        });
    });

    it("no scheduled bot: nothing", () => {
        assert.deepEqual(
            backgroundPlan({
                bots: [{ id: "a" }],
                settings: { ...defaults, keepAwake: true },
            }),
            { stayInTray: false, openAtLogin: false, keepAwake: false }
        );
    });

    it("background off turns all three off", () => {
        assert.deepEqual(
            backgroundPlan({
                bots: scheduled,
                settings: {
                    background: false,
                    startAtLogin: true,
                    keepAwake: true,
                },
            }),
            { stayInTray: false, openAtLogin: false, keepAwake: false }
        );
    });

    it("start at login off keeps the tray but not the login item", () => {
        assert.deepEqual(
            backgroundPlan({
                bots: scheduled,
                settings: { ...defaults, startAtLogin: false },
            }),
            { stayInTray: true, openAtLogin: false, keepAwake: false }
        );
    });

    it("keep awake only when plugged in", () => {
        const settings = { ...defaults, keepAwake: true };
        assert.equal(
            backgroundPlan({ bots: scheduled, settings, onBattery: false })
                .keepAwake,
            true
        );
        assert.equal(
            backgroundPlan({ bots: scheduled, settings, onBattery: true })
                .keepAwake,
            false
        );
    });
});

describe("approvalMenuItems — waiting approvals in the tray (US-018 AC2)", () => {
    const approval = (id, botName, toolName) => ({
        id,
        request: { botId: "b-" + id, botName, toolName },
    });

    it("names the bot and the tool, and opens that bot", () => {
        assert.deepEqual(
            approvalMenuItems([approval("1", "Writer", "send_email")]),
            [{ label: "Writer wants send_email", botId: "b-1" }]
        );
    });

    it("shows five, then how many more", () => {
        const many = ["1", "2", "3", "4", "5", "6", "7"].map((i) =>
            approval(i, "Bot " + i, "t")
        );
        const items = approvalMenuItems(many);
        assert.equal(items.length, 6);
        assert.deepEqual(items[5], { label: "2 more waiting", botId: null });
    });

    it("tolerates missing names and bad input", () => {
        assert.deepEqual(approvalMenuItems([{ id: "x", request: {} }, null]), [
            { label: "A bot wants to use a tool", botId: null },
        ]);
        assert.deepEqual(approvalMenuItems(null), []);
    });
});
