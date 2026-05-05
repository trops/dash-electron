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

const INVOKE_RE = /ipcRenderer\.invoke\(\s*([A-Z_][A-Z0-9_]*)\s*[,)]/g;
const HANDLER_RE =
    /(?:logger\.loggedHandle|ipcMain\.handle)\(\s*([A-Z_][A-Z0-9_]*)\s*,/g;

const GATE_REFS = ["gateToolCall", "gateFsCall", "_runFsGate"];

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

function parseInvokes(source) {
    const seen = new Set();
    for (const m of source.matchAll(INVOKE_RE)) {
        seen.add(m[1]);
    }
    return [...seen];
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

function parseHandlers(source) {
    const out = [];
    HANDLER_RE.lastIndex = 0;
    let m;
    while ((m = HANDLER_RE.exec(source)) !== null) {
        const channel = m[1];
        const bodyStart = HANDLER_RE.lastIndex;
        const body = _extractHandlerBody(source, bodyStart);
        out.push({
            channel,
            handlerHasWidgetId: /\bwidgetId\b/.test(body),
            handlerHasGateRef: GATE_REFS.some((id) =>
                new RegExp("\\b" + id + "\\b").test(body)
            ),
            delegate: _extractDelegate(body),
        });
    }
    return out;
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

function buildAuditTable(dashElectronRoot, dashCoreRoot) {
    const electronJsPath = path.join(dashElectronRoot, "public", "electron.js");
    const electronSrc = fs.readFileSync(electronJsPath, "utf8");
    const handlers = parseHandlers(electronSrc);
    const handlerByChannel = new Map();
    for (const h of handlers) handlerByChannel.set(h.channel, h);

    const gatedDelegates = _collectGatedDelegates(dashCoreRoot);

    const invokes = new Map();
    for (const { file, source } of _readApiSources(dashCoreRoot)) {
        for (const ch of parseInvokes(source)) {
            const entry = invokes.get(ch) || { files: new Set() };
            entry.files.add(file);
            invokes.set(ch, entry);
        }
    }

    const allChannels = new Set([
        ...invokes.keys(),
        ...handlerByChannel.keys(),
    ]);
    const rows = [];
    for (const channel of allChannels) {
        const inv = invokes.get(channel);
        const h = handlerByChannel.get(channel);
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
            channel,
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

function main() {
    const dashElectronRoot = path.resolve(__dirname, "..");
    const dashCoreRoot = _findDashCoreSourceRoot(dashElectronRoot);
    if (!dashCoreRoot) {
        console.error(
            "audit-ipc-surface: linked @trops/dash-core source not found. " +
                "Run `npm run link-core -- <path/to/dash-core>` first — the " +
                "audit needs to read electron/api/*.js, which only exists in " +
                "the source repo (the published package ships only dist/)."
        );
        process.exit(1);
    }
    const rows = buildAuditTable(dashElectronRoot, dashCoreRoot);
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
    buildAuditTable,
    rowsToMarkdown,
};
