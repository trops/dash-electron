/**
 * Electron security hardening helpers.
 *
 * Two pieces:
 *
 *   1. applyWindowHardening(win) — call once per BrowserWindow. Installs
 *      a same-origin `will-navigate` guard and a `setWindowOpenHandler`
 *      that denies in-app window creation. Cross-origin http(s) URLs
 *      are handed off to shell.openExternal so legitimate "open in
 *      browser" links still work; everything else is dropped.
 *
 *   2. applySessionHardening(session) — call once on the default
 *      Electron session at app-ready time. Installs a permission
 *      request handler that allows only an explicit allowlist
 *      (currently: 'notifications') and denies everything else.
 *
 * Mitigates the LIMIT_NAVIGATION_GLOBAL_CHECK and
 * PERMISSION_REQUEST_HANDLER_GLOBAL_CHECK findings raised by
 * @doyensec/electronegativity. scanWindow in electron.js is exempt — it
 * has its own scan-specific will-navigate handler and bypasses these
 * helpers intentionally.
 */
"use strict";

const { shell } = require("electron");

// Permissions the app legitimately needs. Anything not in this set is
// denied — keep the list short and add only when a real feature
// surfaces a need so we can audit the addition.
const ALLOWED_PERMISSIONS = new Set(["notifications"]);

function getOrigin(url) {
    try {
        return new URL(url).origin;
    } catch (_e) {
        return null;
    }
}

function isHttpUrl(url) {
    return (
        typeof url === "string" &&
        (url.startsWith("http://") || url.startsWith("https://"))
    );
}

function applyWindowHardening(win) {
    if (!win || !win.webContents) return;
    const wc = win.webContents;

    wc.on("will-navigate", (event, url) => {
        const currentOrigin = getOrigin(
            typeof wc.getURL === "function" ? wc.getURL() : ""
        );
        const targetOrigin = getOrigin(url);
        if (currentOrigin && targetOrigin && currentOrigin === targetOrigin) {
            // Same-origin navigation — allow. Covers SPA full-reloads
            // and dev-server HMR.
            return;
        }
        event.preventDefault();
        if (isHttpUrl(url)) {
            shell.openExternal(url).catch(() => {});
        }
    });

    wc.setWindowOpenHandler(({ url }) => {
        if (isHttpUrl(url)) {
            shell.openExternal(url).catch(() => {});
        }
        return { action: "deny" };
    });
}

function applySessionHardening(session) {
    if (!session || typeof session.setPermissionRequestHandler !== "function") {
        return;
    }
    session.setPermissionRequestHandler((webContents, permission, callback) => {
        callback(ALLOWED_PERMISSIONS.has(permission));
    });
}

module.exports = {
    applyWindowHardening,
    applySessionHardening,
    ALLOWED_PERMISSIONS,
};
