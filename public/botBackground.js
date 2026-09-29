"use strict";

/**
 * botBackground.js — pure helpers for Bot Factory background mode (Slice 6b,
 * US-018 / FR-016).
 *
 * Intentionally free of any `require("electron")` so it loads + unit-tests
 * under plain Node (mirrors dash-core's NFR-006 core/boundary split). The
 * Electron-coupled bits (Tray, powerSaveBlocker, notifications) live in
 * botTray.js and consume these functions.
 */

/**
 * Does any bot have at least one cron schedule? This is the signal that Dash
 * should stay resident in the tray after the last window closes so scheduled
 * runs still fire (and can drive the login item / powerSaveBlocker).
 *
 * @param {Array<{schedules?: Array<{cron?: string}>}>} bots
 * @returns {boolean}
 */
function botsWantBackground(bots) {
    if (!Array.isArray(bots)) return false;
    return bots.some(
        (b) =>
            b &&
            Array.isArray(b.schedules) &&
            b.schedules.some(
                (s) => s && typeof s.cron === "string" && s.cron.trim()
            )
    );
}

/**
 * Derive the tray's display strings from live counts. Pure so the label/badge
 * logic is testable without an Electron Tray.
 *
 * @param {{running?: Array, approvals?: Array, paused?: boolean}} state
 * @returns {{summary: string, pauseLabel: string, badge: string}}
 */
function describeTrayState(state = {}) {
    const running = Array.isArray(state.running) ? state.running : [];
    const approvals = Array.isArray(state.approvals) ? state.approvals : [];
    const paused = Boolean(state.paused);

    const summary = paused
        ? "Bots paused"
        : `${running.length} running · ${approvals.length} pending`;
    const pauseLabel = paused ? "Resume all bots" : "Pause all bots";
    // Pending approvals are the actionable signal — surface their count as the
    // menu-bar badge (macOS); empty string clears it.
    const badge = approvals.length > 0 ? String(approvals.length) : "";

    return { summary, pauseLabel, badge };
}

module.exports = { botsWantBackground, describeTrayState };
