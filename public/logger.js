/**
 * logger.js
 *
 * Local file-based logging for the Electron main process.
 * Writes JSONL (one JSON object per line) to {dataDirectory}/logs/YYYY-MM-DD.log.
 * All writes are wrapped in try/catch — logging failures never crash the app.
 *
 * Also provides a real-time broadcast pipeline for the Debug Console window.
 * When a debug window is connected, log entries are sent via IPC in addition
 * to being written to disk.
 */

const fs = require("fs");
const path = require("path");
const { ipcMain } = require("electron");
const { randomUUID } = require("crypto");
const { API_GROUPS } = require("@trops/dash-core/electron");

let _getDataDir = null;
let _dataDir = null;
let _userId = null;

// --- Debug broadcast state ---
let _debugWindow = null; // BrowserWindow reference, set by electron.js
const RING_BUFFER_MAX = 500;
const _ringBuffer = [];

// --- Handler registry for API Catalog ---
// Maps channel name → { api, callCount }
const _handlerRegistry = new Map();

// Sensitive field names to redact from broadcast payloads
const SENSITIVE_KEYS = new Set([
    "apiKey",
    "api_key",
    "token",
    "accessToken",
    "access_token",
    "refreshToken",
    "refresh_token",
    "secret",
    "password",
    "credential",
    "credentials",
    "authorization",
]);

/**
 * Reverse lookup: channel string → API group name.
 * Built once from dash-core's API_GROUPS so adding a new event constant
 * in dash-core automatically categorizes it here.
 */
const _channelToGroup = new Map();
for (const [group, channels] of Object.entries(API_GROUPS)) {
    for (const ch of channels) {
        _channelToGroup.set(ch, group);
    }
}

/**
 * Derive an API category from an IPC channel name.
 * First checks the auto-generated map from dash-core event constants,
 * then falls back to template-specific prefixes, then "system".
 */
function deriveApi(channel) {
    if (!channel) return "unknown";
    // Auto-derived from dash-core API_GROUPS
    const mapped = _channelToGroup.get(channel);
    if (mapped) return mapped;
    // Template-specific channels (not in dash-core events)
    const lower = channel.toLowerCase();
    if (lower.startsWith("popout") || lower.startsWith("widget-popout"))
        return "popout";
    if (lower.startsWith("widget")) return "widgets";
    if (lower.startsWith("debug")) return "debug";
    if (lower.startsWith("plugin")) return "plugins";
    return "system";
}

/**
 * Deep-redact sensitive fields from an object for safe broadcast.
 * Returns a new object (never mutates the original).
 */
function redact(obj, depth = 0) {
    if (depth > 5 || obj == null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map((v) => redact(v, depth + 1));
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (SENSITIVE_KEYS.has(k)) {
            out[k] = "[REDACTED]";
        } else if (v && typeof v === "object") {
            out[k] = redact(v, depth + 1);
        } else {
            out[k] = v;
        }
    }
    return out;
}

/**
 * Safely serialize args/result for broadcast.
 * Handles circular refs and limits size.
 */
function safeSummary(value) {
    try {
        if (value === undefined) return undefined;
        const redacted = redact(value);
        const json = JSON.stringify(redacted);
        if (json && json.length > 4096) {
            return { _truncated: true, preview: json.slice(0, 512) + "…" };
        }
        return redacted;
    } catch {
        return { _error: "could not serialize" };
    }
}

/**
 * Set the debug window reference. Called by electron.js when
 * the debug window is created or destroyed.
 */
function setDebugWindow(win) {
    _debugWindow = win;
}

/**
 * Get the current ring buffer contents (for sending on debug window open).
 */
function getRingBuffer() {
    return [..._ringBuffer];
}

/**
 * Broadcast a debug entry to the debug window (if open) and store in ring buffer.
 */
function broadcast(entry) {
    try {
        _ringBuffer.push(entry);
        if (_ringBuffer.length > RING_BUFFER_MAX) {
            _ringBuffer.shift();
        }
        if (
            _debugWindow &&
            !_debugWindow.isDestroyed() &&
            _debugWindow.webContents
        ) {
            _debugWindow.webContents.send("debug:log-entry", entry);
        }
    } catch {
        // Never crash the app due to debug broadcast
    }
}

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
 * Wraps ipcMain.handle() with timing, logging, and debug broadcast.
 * Logs: channel, timestamp, duration, success/error, userId.
 * Broadcasts enriched entries (with args/result) to the debug console.
 */
function loggedHandle(channel, handler) {
    const api = deriveApi(channel);
    _handlerRegistry.set(channel, { api, callCount: 0 });

    ipcMain.handle(channel, async (e, ...args) => {
        const start = Date.now();
        _handlerRegistry.get(channel).callCount++;
        try {
            const result = await handler(e, ...args);
            const durationMs = Date.now() - start;

            // File log (no payloads — privacy)
            log({
                ts: new Date().toISOString(),
                level: "info",
                event: "ipc",
                channel,
                durationMs,
                success: true,
                userId: _userId,
            });

            // Debug broadcast (with redacted payloads)
            broadcast({
                id: randomUUID(),
                ts: new Date().toISOString(),
                level: "info",
                event: "ipc",
                channel,
                api,
                method: channel,
                durationMs,
                success: true,
                args: safeSummary(args.length === 1 ? args[0] : args),
                result: safeSummary(result),
            });

            return result;
        } catch (err) {
            const durationMs = Date.now() - start;

            log({
                ts: new Date().toISOString(),
                level: "error",
                event: "ipc",
                channel,
                durationMs,
                success: false,
                error: err?.message || String(err),
                userId: _userId,
            });

            broadcast({
                id: randomUUID(),
                ts: new Date().toISOString(),
                level: "error",
                event: "ipc",
                channel,
                api,
                method: channel,
                durationMs,
                success: false,
                error: err?.message || String(err),
            });

            throw err;
        }
    });
}

/**
 * Log an app lifecycle event (e.g. app-ready, window-created).
 */
function logLifecycle(action, details) {
    const entry = {
        ts: new Date().toISOString(),
        level: "info",
        event: "lifecycle",
        action,
        ...details,
    };
    log(entry);
    broadcast({
        id: randomUUID(),
        ...entry,
        api: "lifecycle",
        method: action,
        channel: action,
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
 * Log an info-level message.
 */
function info(message, ...details) {
    const entry = {
        ts: new Date().toISOString(),
        level: "info",
        event: "log",
        message: typeof message === "string" ? message : String(message),
    };
    if (details.length > 0) entry.details = details;
    log(entry);
    broadcast({
        id: randomUUID(),
        ...entry,
        api: "system",
        method: "log",
        channel: "log",
    });
}

/**
 * Log a warn-level message.
 */
function warn(message, ...details) {
    const entry = {
        ts: new Date().toISOString(),
        level: "warn",
        event: "log",
        message: typeof message === "string" ? message : String(message),
    };
    if (details.length > 0) entry.details = details;
    log(entry);
    broadcast({
        id: randomUUID(),
        ...entry,
        api: "system",
        method: "log",
        channel: "log",
    });
}

/**
 * Log an error-level message.
 */
function error(message, ...details) {
    const entry = {
        ts: new Date().toISOString(),
        level: "error",
        event: "log",
        message: typeof message === "string" ? message : String(message),
    };
    if (details.length > 0) entry.details = details;
    log(entry);
    broadcast({
        id: randomUUID(),
        ...entry,
        api: "system",
        method: "log",
        channel: "log",
    });
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

/**
 * Return the API catalog: all registered handlers grouped by namespace,
 * with call counts.
 */
function getApiCatalog() {
    const groups = {};
    for (const [channel, { api, callCount }] of _handlerRegistry) {
        if (!groups[api]) {
            groups[api] = { namespace: api, channels: [] };
        }
        groups[api].channels.push({ channel, callCount });
    }
    // Sort groups alphabetically, channels within groups alphabetically
    const sorted = Object.values(groups).sort((a, b) =>
        a.namespace.localeCompare(b.namespace)
    );
    for (const group of sorted) {
        group.channels.sort((a, b) => a.channel.localeCompare(b.channel));
    }
    return sorted;
}

module.exports = {
    init,
    getLogDir,
    log,
    info,
    warn,
    error,
    loggedHandle,
    logLifecycle,
    setUserId,
    getUserId,
    cleanOldLogs,
    setDebugWindow,
    getRingBuffer,
    broadcast,
    getApiCatalog,
};
