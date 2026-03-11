/**
 * logger.js
 *
 * Local file-based logging for the Electron main process.
 * Writes JSONL (one JSON object per line) to {dataDirectory}/logs/YYYY-MM-DD.log.
 * All writes are wrapped in try/catch — logging failures never crash the app.
 */

const fs = require("fs");
const path = require("path");
const { ipcMain } = require("electron");

let _getDataDir = null;
let _dataDir = null;
let _userId = null;

/**
 * Initialize the logger with a function that returns the data directory path.
 * Must be called once at startup after app is ready.
 */
function init(getDataDirFn) {
    _getDataDir = getDataDirFn;
}

/**
 * Returns the logs directory, creating it if needed.
 */
function getLogDir() {
    try {
        if (!_dataDir && _getDataDir) {
            _dataDir = _getDataDir();
        }
        if (!_dataDir) return null;

        const logDir = path.join(_dataDir, "logs");
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        return logDir;
    } catch {
        return null;
    }
}

/**
 * Get today's date string as YYYY-MM-DD.
 */
function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Append a log entry (object) as a JSONL line to today's log file.
 */
function log(entry) {
    try {
        const logDir = getLogDir();
        if (!logDir) return;

        const logFile = path.join(logDir, `${todayStr()}.log`);
        const line = JSON.stringify(entry) + "\n";
        fs.appendFileSync(logFile, line, "utf8");
    } catch {
        // Never crash the app due to logging
    }
}

/**
 * Wraps ipcMain.handle() with timing and logging.
 * Logs: channel, timestamp, duration, success/error, userId.
 * Does NOT log payloads (privacy).
 */
function loggedHandle(channel, handler) {
    ipcMain.handle(channel, async (e, ...args) => {
        const start = Date.now();
        try {
            const result = await handler(e, ...args);
            log({
                ts: new Date().toISOString(),
                level: "info",
                event: "ipc",
                channel,
                durationMs: Date.now() - start,
                success: true,
                userId: _userId,
            });
            return result;
        } catch (err) {
            log({
                ts: new Date().toISOString(),
                level: "error",
                event: "ipc",
                channel,
                durationMs: Date.now() - start,
                success: false,
                error: err?.message || String(err),
                userId: _userId,
            });
            throw err;
        }
    });
}

/**
 * Log an app lifecycle event (e.g. app-ready, window-created).
 */
function logLifecycle(action, details) {
    log({
        ts: new Date().toISOString(),
        level: "info",
        event: "lifecycle",
        action,
        ...details,
    });
}

/**
 * Set the cached userId (called after auth).
 */
function setUserId(id) {
    _userId = id || null;
}

/**
 * Get the cached userId.
 */
function getUserId() {
    return _userId;
}

/**
 * Delete log files older than maxAgeDays.
 */
function cleanOldLogs(maxAgeDays = 30) {
    try {
        const logDir = getLogDir();
        if (!logDir) return;

        const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
        const files = fs.readdirSync(logDir);

        for (const file of files) {
            if (!file.endsWith(".log")) continue;
            const filePath = path.join(logDir, file);
            const stat = fs.statSync(filePath);
            if (stat.mtimeMs < cutoff) {
                fs.unlinkSync(filePath);
            }
        }
    } catch {
        // Never crash the app due to log cleanup
    }
}

module.exports = {
    init,
    getLogDir,
    log,
    loggedHandle,
    logLifecycle,
    setUserId,
    getUserId,
    cleanOldLogs,
};
