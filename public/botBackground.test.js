"use strict";

/**
 * botBackground.test.js — pure background-mode helpers (Slice 6b).
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { botsWantBackground, describeTrayState } = require("./botBackground");

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
