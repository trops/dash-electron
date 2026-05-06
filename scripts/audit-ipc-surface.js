#!/usr/bin/env node
/**
 * audit-ipc-surface.js
 *
 * Inventory of widget-exposed IPC channels and how (or whether) each
 * one is gated. This is a dev-time audit, not a CI gate (yet) — it
 * reads the linked `@trops/dash-core` source plus
 * `dash-electron/public/electron.js` and emits a classified
 * markdown table.
 *
 * Classification (heuristic — surface candidates, not absolute truth):
 *
 *   gated            — invoke + handler + handler body or its delegate
 *                      controller function references a known gate
 *                      identifier (gateToolCall, gateFsCall, _runFsGate).
 *   widget-passthru  — invoke + handler + widgetId is plumbed through,
 *                      but no gate ref found in the handler or its
 *                      delegate. Most dangerous shape — looks scoped,
 *                      isn't. Always lands on the manual-review pile.
 *   system           — invoke + handler, no widgetId. Settings/admin/
 *                      registry/dashboard channels that are intentionally
 *                      not per-widget. Spot-check confirms intent.
 *   dead             — invoke present in dash-core api/, no matching
 *                      handler in dash-electron public/electron.js.
 *                      Renderer calls go nowhere; usually a code-rot
 *                      signal worth removing (cf. the
 *                      `secureStore.{saveData, getData}` cleanup in
 *                      dash-core 0.1.503).
 *   phantom          — handler in public/electron.js, no invoke side.
 *                      Admin flows, popout, internal IPC.
 *
 * Gate-ref detection looks in two places:
 *   1. The handler body itself (`logger.loggedHandle(CHANNEL, (e, m) =>
 *      _runFsGate(...))`) — direct gate.
 *   2. The body of the delegate function the handler hands off to
 *      (e.g. `mcpController.callTool` in dash-core). Required because
 *      handler bodies in dash-electron are usually thin pass-throughs;
 *      the actual gate lives in the controller.
 *
 * Requires linked `@trops/dash-core` source (the published package
 * ships only `dist/`). Errors clearly if dash-core source dir isn't
 * found.
 *
 * Usage:
 *   node scripts/audit-ipc-surface.js          # markdown table to stdout
 *   node scripts/audit-ipc-surface.js --json   # JSON for further tooling
 */
"use strict";

const fs = require("fs");
const path = require("path");

// Channel arguments accept three forms:
//   - ALL_CAPS constant identifier (e.g. THEME_LIST)
//   - Double-quoted string literal (e.g. "theme-list")
//   - Single-quoted string literal (e.g. 'theme-list')
// Each pattern captures into one of three groups so the parser can
// tell which form was used. The constant form's VALUE is then
// resolved via the constant map; literal forms are their own value.
const INVOKE_RE =
    /ipcRenderer\.invoke\(\s*(?:([A-Z_][A-Z0-9_]*)|"([^"]*)"|'([^']*)')\s*[,)]/g;
const HANDLER_RE =
    /(?:logger\.loggedHandle|ipcMain\.handle)\(\s*(?:([A-Z_][A-Z0-9_]*)|"([^"]*)"|'([^']*)')\s*,/g;
// const NAME = "value" or const NAME = 'value' — used to build the
// constant map from electron/events/*.js.
const CONST_DECL_RE =
    /const\s+([A-Z_][A-Z0-9_]*)\s*=\s*(?:"([^"]*)"|'([^']*)')\s*;?/g;

const GATE_REFS = [
    "gateToolCall",
    "gateFsCall",
    "_runFsGate",
    "gateNetworkCall",
    "_runNetworkGate",
];

// Strip block (`/* … */`) and line (`// …`) comments. Documentation
// strings often include example handler/invoke calls (e.g.
// `ipcMain.handle("my-channel", …)` in JSDoc) and the parser would
// pick those up, polluting the audit. This is a coarse strip — it
// does not preserve string literals containing comment-like
// substrings — but it is sufficient for source files in this repo.
function _stripComments(source) {
    let out = "";
    let i = 0;
    const n = source.length;
    while (i < n) {
        const c = source[i];
        const next = source[i + 1];
        // Block comment
        if (c === "/" && next === "*") {
            const end = source.indexOf("*/", i + 2);
            i = end === -1 ? n : end + 2;
            continue;
        }
        // Line comment
        if (c === "/" && next === "/") {
            const end = source.indexOf("\n", i + 2);
            i = end === -1 ? n : end;
            continue;
        }
        // String — copy through verbatim so e.g.
        // `"// not a comment"` is preserved.
        if (c === '"' || c === "'" || c === "`") {
            const quote = c;
            out += c;
            i++;
            while (i < n) {
                const ch = source[i];
                out += ch;
                if (ch === "\\" && i + 1 < n) {
                    out += source[i + 1];
                    i += 2;
                    continue;
                }
                i++;
                if (ch === quote) break;
            }
            continue;
        }
        out += c;
        i++;
    }
    return out;
}

// Pulled from a handler body: returns the first identifier called via
// either a bareword or `module.method` form. Examples:
//   saveToFile(args)              → "saveToFile"
//   mcpController.callTool(args)  → "callTool"
//   getSenderWindow(e)            → "getSenderWindow"  (skipped — see DELEGATE_SKIP)
// Returns null if nothing call-shaped is found.
const DELEGATE_SKIP = new Set([
    "getSenderWindow",
    // JS reserved words / common syntactic prefixes that the regex
    // would otherwise pick up before the real call site (e.g.
    // `(e, message) => async (...)` was misidentifying `async` as the
    // delegate). These are never function names worth recording.
    "async",
    "await",
    "function",
    "return",
    "if",
    "for",
    "while",
    "switch",
    "case",
    "new",
    "typeof",
    "void",
]);
function _extractDelegate(body) {
    const re = /\b([A-Za-z_$][\w$]*)\s*(?:\.\s*([A-Za-z_$][\w$]*)\s*)?\(/g;
    let m;
    while ((m = re.exec(body)) !== null) {
        const name = m[2] || m[1];
        if (DELEGATE_SKIP.has(name)) continue;
        return name;
    }
    return null;
}

function classifyEvent({
    hasInvoke,
    hasHandler,
    handlerHasWidgetId,
    handlerHasGateRef,
    delegateHasGateRef,
}) {
    if (hasHandler && !hasInvoke) return "phantom";
    if (hasInvoke && !hasHandler) return "dead";
    if (hasInvoke && hasHandler) {
        const isGated = handlerHasGateRef || delegateHasGateRef;
        if (handlerHasWidgetId && isGated) return "gated";
        if (handlerHasWidgetId) return "widget-passthru";
        return "system";
    }
    return "unknown";
}

function parseConstantDeclarations(source) {
    source = _stripComments(source);
    const map = new Map();
    CONST_DECL_RE.lastIndex = 0;
    let m;
    while ((m = CONST_DECL_RE.exec(source)) !== null) {
        const name = m[1];
        const value = m[2] !== undefined ? m[2] : m[3];
        if (typeof name === "string" && typeof value === "string") {
            map.set(name, value);
        }
    }
    return map;
}

// Returns array of { displayName, value, isLiteral }. `displayName`
// is the constant name when one was used (preferred for table
// readability), or the literal string otherwise. `value` is the
// resolved channel string used for cross-referencing across api
// files and handler registrations. `isLiteral` is true when the
// invoke used an inline string rather than a constant.
function parseInvokes(source, constantMap) {
    source = _stripComments(source);
    const seen = new Map(); // value → entry
    INVOKE_RE.lastIndex = 0;
    let m;
    while ((m = INVOKE_RE.exec(source)) !== null) {
        const constName = m[1];
        const dbl = m[2];
        const sgl = m[3];
        let displayName;
        let value;
        let isLiteral;
        if (constName) {
            displayName = constName;
            value =
                constantMap && constantMap.has(constName)
                    ? constantMap.get(constName)
                    : null;
            isLiteral = false;
        } else {
            displayName = dbl !== undefined ? dbl : sgl;
            value = displayName;
            isLiteral = true;
        }
        if (!seen.has(displayName)) {
            seen.set(displayName, { displayName, value, isLiteral });
        }
    }
    return [...seen.values()];
}

function _extractHandlerBody(source, startIdx) {
    let depth = 1;
    let i = startIdx;
    while (i < source.length && depth > 0) {
        const ch = source[i];
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        if (depth === 0) break;
        i++;
    }
    return source.slice(startIdx, i);
}

function parseHandlers(source, constantMap) {
    source = _stripComments(source);
    const out = [];
    HANDLER_RE.lastIndex = 0;
    let m;
    while ((m = HANDLER_RE.exec(source)) !== null) {
        const constName = m[1];
        const dbl = m[2];
        const sgl = m[3];
        let displayName;
        let value;
        let isLiteral;
        if (constName) {
            displayName = constName;
            value =
                constantMap && constantMap.has(constName)
                    ? constantMap.get(constName)
                    : null;
            isLiteral = false;
        } else {
            displayName = dbl !== undefined ? dbl : sgl;
            value = displayName;
            isLiteral = true;
        }
        const bodyStart = HANDLER_RE.lastIndex;
        const body = _extractHandlerBody(source, bodyStart);
        out.push({
            // legacy alias kept for any caller referring to .channel; new
            // code should read .displayName
            channel: displayName,
            displayName,
            value,
            isLiteral,
            handlerHasWidgetId: /\bwidgetId\b/.test(body),
            handlerHasGateRef: GATE_REFS.some((id) =>
                new RegExp("\\b" + id + "\\b").test(body)
            ),
            delegate: _extractDelegate(body),
        });
    }
    return out;
}

// When an invoke side references a constant and the handler side uses
// an inline string with the same value, prefer the constant name in
// the audit table — `THEME_LIST` is more readable than `theme-list`
// and matches the codebase's convention.
function resolveChannel(invokeEntry, handlerEntry) {
    const candidates = [invokeEntry, handlerEntry].filter(Boolean);
    const constantHit = candidates.find((c) => c && c.isLiteral === false);
    const literalHit = candidates.find((c) => c && c.isLiteral === true);
    return {
        displayName: (constantHit || literalHit || candidates[0]).displayName,
        value: (candidates[0] || {}).value,
    };
}

// Walk every dash-core controller file and return a Set<string> of
// function/method names whose body references a known gate identifier.
// We check at function-declaration sites (`function foo(`) and at
// object-literal method shorthands (`foo: async (` / `foo(`). A function
// is "gated" if a gate ref appears anywhere within ~80 lines after its
// declaration (rough proxy for "in this function's scope"). Loose, but
// it converts the audit's signal-to-noise from useless to useful.
function _collectGatedDelegates(dashCoreRoot) {
    const out = new Set();
    const dir = path.join(dashCoreRoot, "electron", "controller");
    if (!fs.existsSync(dir)) return out;

    // function declaration OR object-literal method shorthand
    const decl =
        /(?:^|\W)(?:function\s+([A-Za-z_$][\w$]*)\s*\(|([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?(?:function\s*)?\()/g;

    for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith(".js") || file.endsWith(".test.js")) continue;
        const src = fs.readFileSync(path.join(dir, file), "utf8");
        const lines = src.split("\n");
        decl.lastIndex = 0;
        let m;
        while ((m = decl.exec(src)) !== null) {
            const name = m[1] || m[2];
            if (!name) continue;
            const startLine = src.slice(0, m.index).split("\n").length - 1;
            const window = lines.slice(startLine, startLine + 80).join("\n");
            if (
                GATE_REFS.some((id) =>
                    new RegExp("\\b" + id + "\\b").test(window)
                )
            ) {
                out.add(name);
            }
        }
    }
    return out;
}

function _findDashCoreSourceRoot(startFromDir) {
    let pkgMain;
    try {
        pkgMain = require.resolve("@trops/dash-core", {
            paths: [startFromDir],
        });
    } catch (_) {
        return null;
    }
    let dir = path.dirname(pkgMain);
    while (dir !== path.dirname(dir)) {
        const candidate = path.join(dir, "electron", "api");
        if (fs.existsSync(candidate)) return dir;
        dir = path.dirname(dir);
    }
    return null;
}

function _readApiSources(dashCoreRoot) {
    const apiDir = path.join(dashCoreRoot, "electron", "api");
    const out = [];
    for (const file of fs.readdirSync(apiDir)) {
        if (!file.endsWith(".js")) continue;
        if (file.endsWith(".test.js")) continue;
        const full = path.join(apiDir, file);
        out.push({ file, source: fs.readFileSync(full, "utf8") });
    }
    return out;
}

// Build the constant-name → string-value map from
// `dash-core/electron/events/*Events.js`. Required so the audit can
// resolve `ipcRenderer.invoke(THEME_LIST, …)` to its actual channel
// value `"theme-list"`, which is how the handler side identifies the
// channel when it uses an inline string.
function loadConstantMap(dashCoreRoot) {
    const map = new Map();
    const eventsDir = path.join(dashCoreRoot, "electron", "events");
    if (!fs.existsSync(eventsDir)) return map;
    for (const file of fs.readdirSync(eventsDir)) {
        if (!file.endsWith(".js")) continue;
        const src = fs.readFileSync(path.join(eventsDir, file), "utf8");
        for (const [name, value] of parseConstantDeclarations(src)) {
            map.set(name, value);
        }
    }
    return map;
}

// Walk all .js files under `dash-core/electron/` (skipping node_modules,
// dist, *.test.js) and aggregate handler registrations. dash-core
// declares some handlers in utility modules (e.g.
// `electron/utils/clientCache.js`'s `setupCacheHandlers`) that the
// dash-electron-only handler scan would miss.
function _walkJs(dir, out, skipDirs) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (skipDirs.has(entry.name)) continue;
            _walkJs(full, out, skipDirs);
        } else if (
            entry.isFile() &&
            entry.name.endsWith(".js") &&
            !entry.name.endsWith(".test.js")
        ) {
            out.push(full);
        }
    }
}

function _collectHandlersFromDashCore(dashCoreRoot, constantMap) {
    const electronDir = path.join(dashCoreRoot, "electron");
    if (!fs.existsSync(electronDir)) return [];
    const skipDirs = new Set(["node_modules", "dist", "test"]);
    const files = [];
    _walkJs(electronDir, files, skipDirs);
    const handlers = [];
    for (const file of files) {
        const src = fs.readFileSync(file, "utf8");
        // Cheap pre-filter so we don't slice every handler body in
        // every controller.
        if (
            !/(?:logger\.loggedHandle|ipcMain\.handle)\s*\(/.test(src) ||
            !/(?:logger\.loggedHandle|ipcMain\.handle)\(\s*(?:[A-Z_][A-Z0-9_]*|"[^"]*"|'[^']*')\s*,/.test(
                src
            )
        ) {
            continue;
        }
        for (const h of parseHandlers(src, constantMap)) {
            handlers.push(h);
        }
    }
    return handlers;
}

function buildAuditTable(dashElectronRoot, dashCoreRoot) {
    const constantMap = loadConstantMap(dashCoreRoot);
    const electronJsPath = path.join(dashElectronRoot, "public", "electron.js");
    const electronSrc = fs.readFileSync(electronJsPath, "utf8");
    const preloadJsPath = path.join(dashElectronRoot, "public", "preload.js");
    const preloadSrc = fs.existsSync(preloadJsPath)
        ? fs.readFileSync(preloadJsPath, "utf8")
        : "";

    // Aggregate handlers from BOTH dash-electron's main script AND
    // dash-core's electron/ tree. The latter catches setup helpers
    // like `clientCache.setupCacheHandlers()` that register inline
    // handlers from inside dash-core.
    const allHandlers = [
        ...parseHandlers(electronSrc, constantMap),
        ..._collectHandlersFromDashCore(dashCoreRoot, constantMap),
    ];

    // Cross-reference is keyed by channel VALUE (the resolved string),
    // so a constant-form invoke matches an inline-string handler with
    // the same value.
    const handlerByValue = new Map();
    for (const h of allHandlers) {
        if (typeof h.value !== "string") continue;
        // First handler wins; with both dash-electron and dash-core
        // registering, the dash-electron one is parsed first and is
        // generally the more specific delegate target.
        if (!handlerByValue.has(h.value)) handlerByValue.set(h.value, h);
    }

    const gatedDelegates = _collectGatedDelegates(dashCoreRoot);

    // Invokes keyed by value. Each entry remembers the apiFiles it
    // appeared in plus its preferred displayName (constant form
    // wins over inline literal).
    const invokesByValue = new Map();
    const recordInvoke = (inv, file) => {
        if (typeof inv.value !== "string") return;
        let entry = invokesByValue.get(inv.value);
        if (!entry) {
            entry = {
                value: inv.value,
                displayName: inv.displayName,
                isLiteral: inv.isLiteral,
                files: new Set(),
            };
            invokesByValue.set(inv.value, entry);
        }
        // Prefer the constant form's displayName for readability.
        if (entry.isLiteral && !inv.isLiteral) {
            entry.displayName = inv.displayName;
            entry.isLiteral = false;
        }
        entry.files.add(file);
    };
    for (const { file, source } of _readApiSources(dashCoreRoot)) {
        for (const inv of parseInvokes(source, constantMap)) {
            recordInvoke(inv, file);
        }
    }
    // Also scan dash-electron's preload.js — it exposes some
    // namespaces (clientCache, responseCache, etc.) directly via
    // inline-string `ipcRenderer.invoke(...)` calls without going
    // through dash-core's api/* wrappers. Without this scan those
    // channels would falsely classify as `phantom` (handler exists,
    // no invoke side).
    if (preloadSrc) {
        for (const inv of parseInvokes(preloadSrc, constantMap)) {
            recordInvoke(inv, "preload.js");
        }
    }

    const allValues = new Set([
        ...invokesByValue.keys(),
        ...handlerByValue.keys(),
    ]);
    const rows = [];
    for (const value of allValues) {
        const inv = invokesByValue.get(value);
        const h = handlerByValue.get(value);
        const display = resolveChannel(inv, h);
        const delegateHasGateRef =
            h && h.delegate ? gatedDelegates.has(h.delegate) : false;
        const classification = classifyEvent({
            hasInvoke: !!inv,
            hasHandler: !!h,
            handlerHasWidgetId: h ? h.handlerHasWidgetId : false,
            handlerHasGateRef: h ? h.handlerHasGateRef : false,
            delegateHasGateRef,
        });
        rows.push({
            channel: display.displayName,
            classification,
            apiFiles: inv ? [...inv.files].sort().join(", ") : "—",
            delegate: h && h.delegate ? h.delegate : "—",
            handlerWidgetId: h ? (h.handlerHasWidgetId ? "yes" : "no") : "—",
            gateRef: h
                ? h.handlerHasGateRef
                    ? "in handler"
                    : delegateHasGateRef
                    ? "in delegate"
                    : "no"
                : "—",
        });
    }
    rows.sort(
        (a, b) =>
            a.classification.localeCompare(b.classification) ||
            a.channel.localeCompare(b.channel)
    );
    return rows;
}

function rowsToMarkdown(rows) {
    const counts = rows.reduce((acc, r) => {
        acc[r.classification] = (acc[r.classification] || 0) + 1;
        return acc;
    }, {});
    const summary = Object.entries(counts)
        .sort()
        .map(([k, v]) => `- **${k}**: ${v}`)
        .join("\n");

    const header =
        "| Channel | Classification | API file(s) | Delegate | widgetId | gate ref |";
    const sep = "|---|---|---|---|---|---|";
    const body = rows
        .map(
            (r) =>
                `| \`${r.channel}\` | ${r.classification} | ${r.apiFiles} | ${r.delegate} | ${r.handlerWidgetId} | ${r.gateRef} |`
        )
        .join("\n");

    return `# IPC surface audit\n\nGenerated by \`scripts/audit-ipc-surface.js\`. Do not hand-edit the table — re-run the script. Hand-written notes go in **Findings & next slices** below.\n\n## Summary\n\n${summary}\n\n## Channels\n\n${header}\n${sep}\n${body}\n`;
}

// Concerning classes — the only ones the regression gate checks. New
// `system` / `gated` rows don't trip the gate (most ordinary feature
// work mints `system` channels; gating those would generate constant
// noise without any security signal).
const CONCERNING = ["dead", "widget-passthru", "phantom"];

const ALLOWLIST_PATH_REL = "scripts/audit-ipc-surface.allowlist.json";

/**
 * Diff current audit rows against an allowlist of accepted concerning
 * entries. One-directional: new concerning entries are findings; stale
 * allowlist entries (channel reclassified to gated/system, or removed)
 * are warnings.
 *
 * @param {Array<{channel, classification}>} rows
 * @param {{[cls: string]: string[]}} allowlist
 * @returns {{
 *   newFindings: Array<{channel, classification}>,
 *   staleAllowlist: Array<{channel, allowlistedAs, nowClassifiedAs}>
 * }}
 */
function runCheck(rows, allowlist) {
    const newFindings = [];
    const staleAllowlist = [];

    // Build a map of channel → current classification.
    const currentByChannel = new Map();
    for (const r of rows) currentByChannel.set(r.channel, r.classification);

    // Find new concerning entries not in their class's allowlist.
    for (const r of rows) {
        if (!CONCERNING.includes(r.classification)) continue;
        const allowed = (allowlist && allowlist[r.classification]) || [];
        if (!allowed.includes(r.channel)) {
            newFindings.push({
                channel: r.channel,
                classification: r.classification,
            });
        }
    }

    // Find stale allowlist entries: channel listed under class X but
    // current state has it as something else (or absent).
    for (const cls of CONCERNING) {
        const allowed = (allowlist && allowlist[cls]) || [];
        for (const channel of allowed) {
            const now = currentByChannel.get(channel);
            if (now !== cls) {
                staleAllowlist.push({
                    channel,
                    allowlistedAs: cls,
                    nowClassifiedAs: now == null ? null : now,
                });
            }
        }
    }

    return { newFindings, staleAllowlist };
}

function _readAllowlist(dashElectronRoot) {
    const p = path.join(dashElectronRoot, ALLOWLIST_PATH_REL);
    if (!fs.existsSync(p)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(p, "utf8"));
    } catch (e) {
        throw new Error(
            `audit-ipc-surface: failed to parse allowlist at ${p}: ${e.message}`
        );
    }
}

function _writeAllowlist(dashElectronRoot, rows) {
    const out = {
        _comment:
            "Allowlist for IPC surface audit's --check mode. Lists currently-accepted entries in concerning classes (dead / widget-passthru / phantom). New entries that aren't on this list fail CI; stale entries (channel reclassified or removed) just warn. Refresh by running `node scripts/audit-ipc-surface.js --write-allowlist` after a deliberate change. Do not hand-edit casually — every entry is a security-stack acknowledgement that this surface is acceptable as-is.",
    };
    for (const cls of CONCERNING) out[cls] = [];
    for (const r of rows) {
        if (CONCERNING.includes(r.classification)) {
            out[r.classification].push(r.channel);
        }
    }
    for (const cls of CONCERNING) out[cls].sort();
    const p = path.join(dashElectronRoot, ALLOWLIST_PATH_REL);
    fs.writeFileSync(p, JSON.stringify(out, null, 2) + "\n", "utf8");
}

function main() {
    const dashElectronRoot = path.resolve(__dirname, "..");
    const dashCoreRoot = _findDashCoreSourceRoot(dashElectronRoot);
    const isCheck = process.argv.includes("--check");
    const isWriteAllowlist = process.argv.includes("--write-allowlist");

    if (!dashCoreRoot) {
        if (isCheck) {
            // Soft-skip in environments that haven't linked dash-core
            // (e.g. remote CI runs against the published package).
            // Local dev's `npm run ci` will still enforce the gate
            // because `npm run link-core` is part of that workflow.
            console.error(
                "audit-ipc-surface --check: skipped (linked @trops/dash-core " +
                    "source not found; only enforced in environments with the " +
                    "source repo linked)."
            );
            process.exit(0);
        }
        console.error(
            "audit-ipc-surface: linked @trops/dash-core source not found. " +
                "Run `npm run link-core -- <path/to/dash-core>` first — the " +
                "audit needs to read electron/api/*.js, which only exists in " +
                "the source repo (the published package ships only dist/)."
        );
        process.exit(1);
    }
    const rows = buildAuditTable(dashElectronRoot, dashCoreRoot);

    if (isWriteAllowlist) {
        _writeAllowlist(dashElectronRoot, rows);
        process.stdout.write(
            `audit-ipc-surface: allowlist written to ${ALLOWLIST_PATH_REL}\n`
        );
        return;
    }

    if (isCheck) {
        const allowlist = _readAllowlist(dashElectronRoot);
        if (!allowlist) {
            console.error(
                `audit-ipc-surface --check: allowlist not found at ${ALLOWLIST_PATH_REL}. ` +
                    "Generate it once with `node scripts/audit-ipc-surface.js --write-allowlist`."
            );
            process.exit(1);
        }
        const { newFindings, staleAllowlist } = runCheck(rows, allowlist);
        if (staleAllowlist.length > 0) {
            console.error(
                "audit-ipc-surface --check: stale allowlist entries:"
            );
            for (const s of staleAllowlist) {
                console.error(
                    `  - ${s.channel} (was ${s.allowlistedAs}, now ${
                        s.nowClassifiedAs ?? "absent"
                    })`
                );
            }
            console.error(
                "  Refresh with `node scripts/audit-ipc-surface.js --write-allowlist`."
            );
        }
        if (newFindings.length > 0) {
            console.error(
                "audit-ipc-surface --check: NEW entries in concerning classes:"
            );
            for (const f of newFindings) {
                console.error(`  - [${f.classification}] ${f.channel}`);
            }
            console.error(
                "  Either fix the surface (preferred) or run " +
                    "`node scripts/audit-ipc-surface.js --write-allowlist` to " +
                    "acknowledge it. See docs/security/ipc-surface-audit.md."
            );
            process.exit(1);
        }
        process.stdout.write("audit-ipc-surface --check: no new findings.\n");
        return;
    }

    if (process.argv.includes("--json")) {
        process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
    } else {
        process.stdout.write(rowsToMarkdown(rows));
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    classifyEvent,
    parseInvokes,
    parseHandlers,
    parseConstantDeclarations,
    resolveChannel,
    loadConstantMap,
    buildAuditTable,
    rowsToMarkdown,
    runCheck,
    CONCERNING,
};
