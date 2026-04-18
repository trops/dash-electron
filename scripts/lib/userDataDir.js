/**
 * userDataDir.js
 *
 * Resolve the user-data directory where the Dash Electron app stores
 * widgets, dashboards, providers, etc. Mirrors Electron's
 * `app.getPath("userData")` without requiring the Electron runtime —
 * usable from plain Node.js scripts.
 *
 * See: https://www.electronjs.org/docs/latest/api/app#appgetpathname
 *   macOS   -> ~/Library/Application Support/Dash
 *   Windows -> %APPDATA%/Dash   (normally: %USERPROFILE%/AppData/Roaming/Dash)
 *   Linux   -> $XDG_CONFIG_HOME/Dash  (defaults to ~/.config/Dash)
 */
const path = require("path");
const os = require("os");

const APP_NAME = "Dash";

function getUserDataDir() {
    const home = os.homedir();
    switch (process.platform) {
        case "darwin":
            return path.join(home, "Library", "Application Support", APP_NAME);
        case "win32":
            return path.join(
                process.env.APPDATA || path.join(home, "AppData", "Roaming"),
                APP_NAME
            );
        default:
            return path.join(
                process.env.XDG_CONFIG_HOME || path.join(home, ".config"),
                APP_NAME
            );
    }
}

module.exports = { getUserDataDir };
