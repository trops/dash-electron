"use strict";

/**
 * botTray.js — Bot Factory background mode (Slice 6b, US-018 / FR-016).
 *
 * Owns the system tray (the app has none otherwise), the powerSaveBlocker held
 * while bots are running, and OS notifications for pending approvals. All
 * Electron + botController collaborators are injected by public/electron.js so
 * this stays a thin main-process adapter over the pure helpers in
 * botBackground.js.
 *
 * The main process does not receive the renderer-bound BOT_RUN_ACTIVE /
 * BOT_APPROVAL_PENDING broadcasts, so the tray refreshes from botController's
 * in-memory state on a light interval (and on demand via updateBotTray()).
 */

const path = require("path");
const { Tray, Menu, nativeImage, powerSaveBlocker } = require("electron");
const { describeTrayState } = require("./botBackground");

const REFRESH_MS = 4000;

let tray = null;
let refreshTimer = null;
let blockerId = null;
let deps = null;
const notifiedApprovals = new Set();

function trayIcon() {
    const img = nativeImage.createFromPath(
        path.join(__dirname, "..", "assets", "icons", "icon-256.png")
    );
    if (img.isEmpty()) return img;
    const small = img.resize({ width: 18, height: 18 });
    // Template image adapts to light/dark menu bars on macOS.
    if (process.platform === "darwin") small.setTemplateImage(true);
    return small;
}

/**
 * Create the tray (idempotent). Returns the Tray, or null if creation failed —
 * a tray failure must never take down the app.
 *
 * @param {{
 *   botController: object,
 *   notificationController: object,
 *   getMainWindow: () => (Electron.BrowserWindow|null),
 *   openDash: () => void,
 *   onQuit: () => void,
 * }} injected
 */
function createBotTray(injected) {
    if (tray) return tray;
    deps = injected;
    try {
        tray = new Tray(trayIcon());
    } catch (err) {
        console.error(
            "[botTray] failed to create tray:",
            (err && err.message) || err
        );
        tray = null;
        return null;
    }
    tray.setToolTip("Dash — Bot Factory");
    updateBotTray();
    refreshTimer = setInterval(updateBotTray, REFRESH_MS);
    return tray;
}

/** Refresh menu, badge, powerSaveBlocker, and approval notifications. */
function updateBotTray() {
    if (!deps) return;
    const { botController, notificationController, getMainWindow } = deps;

    let running = [];
    let approvals = [];
    let paused = false;
    try {
        running = botController.listRunning() || [];
        approvals = botController.listApprovals() || [];
        paused = botController.isGloballyPaused();
    } catch (_e) {
        // Controller not ready yet — leave defaults.
    }

    syncPowerBlocker(running.length > 0);
    notifyApprovals(approvals, notificationController, getMainWindow);

    if (!tray) return;
    const { summary, pauseLabel, badge } = describeTrayState({
        running,
        approvals,
        paused,
    });
    if (process.platform === "darwin") tray.setTitle(badge);

    const template = [{ label: summary, enabled: false }];
    if (running.length) {
        template.push({ type: "separator" });
        for (const b of running.slice(0, 10)) {
            template.push({ label: `● ${b.name}`, enabled: false });
        }
    }
    template.push(
        { type: "separator" },
        { label: "Open Dash", click: () => deps.openDash() },
        {
            label: pauseLabel,
            click: () => {
                try {
                    if (paused) botController.resumeAll();
                    else botController.pauseAll();
                } catch (_e) {
                    // ignore — refresh below reflects real state
                }
                updateBotTray();
            },
        },
        { type: "separator" },
        { label: "Quit Dash", click: () => deps.onQuit() }
    );
    tray.setContextMenu(Menu.buildFromTemplate(template));
}

function syncPowerBlocker(active) {
    try {
        if (active && blockerId == null) {
            blockerId = powerSaveBlocker.start("prevent-app-suspension");
        } else if (!active && blockerId != null) {
            powerSaveBlocker.stop(blockerId);
            blockerId = null;
        }
    } catch (_e) {
        // powerSaveBlocker is best-effort.
    }
}

function notifyApprovals(approvals, notificationController, getMainWindow) {
    if (!notificationController || !notificationController.send) return;
    for (const a of approvals) {
        if (!a || !a.id || notifiedApprovals.has(a.id)) continue;
        notifiedApprovals.add(a.id);
        const req = a.request || {};
        const win = getMainWindow ? getMainWindow() : null;
        notificationController.send(win, {
            widgetId: "@bots",
            widgetName: "Bot Factory",
            type: "bot-approval",
            title: "Bot needs approval",
            body:
                (req.botName ? `${req.botName}: ` : "") +
                (req.toolName || "A bot action") +
                " is waiting for your approval.",
            data: { approvalId: a.id },
        });
    }
    // Drop ids for approvals that have been resolved so the set can't grow
    // unbounded over a long-running background session.
    const live = new Set(approvals.map((a) => a && a.id));
    for (const id of [...notifiedApprovals]) {
        if (!live.has(id)) notifiedApprovals.delete(id);
    }
}

function destroyBotTray() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
    syncPowerBlocker(false);
    if (tray) {
        tray.destroy();
        tray = null;
    }
    deps = null;
    notifiedApprovals.clear();
}

module.exports = { createBotTray, updateBotTray, destroyBotTray };
