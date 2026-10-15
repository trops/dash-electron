"use strict";

/**
 * botNotify.js — sends dash-core's bot notices (botNotices.js) as OS
 * notifications (bot-factory US-019 AC3, US-018 AC5).
 *
 * Budget notices always notify — they're rare. A failure only notifies while
 * no Dash window is focused; otherwise the Bots dock already shows it.
 * Clicking any of them opens the bot in the dock, reopening Dash if its
 * window was closed. Settings → Notifications (on/off, Do Not Disturb)
 * applies through notificationController.
 */

/**
 * @param {{
 *   notificationController: { send: (win: any, payload: object) => object },
 *   isDashFocused: () => boolean,
 *   openBot: (botId: string) => void,
 * }} deps
 * @returns {(notice: object) => void}
 */
function createBotNotifier({ notificationController, isDashFocused, openBot }) {
    return function notify(notice) {
        if (!notice || !notice.botId || !notice.kind) return;
        if (notice.kind === "failed" && isDashFocused()) return;
        notificationController.send(null, {
            widgetId: "@bots",
            widgetName: "Bot Factory",
            type: `bot-${notice.kind}`,
            title: notice.title,
            body: notice.body,
            data: { botId: notice.botId },
            onClick: () => openBot(notice.botId),
        });
    };
}

module.exports = { createBotNotifier };
