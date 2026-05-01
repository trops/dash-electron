/**
 * widgetCodeTransforms — pure string transforms that sync the
 * Configure tab's Events / Event Handlers sections with the actual
 * widget JS code.
 *
 * The Configure tab edits the .dash.js declaration; these helpers
 * apply the matching change to the widget .js file. All transforms:
 *   - Use the props.X form (props.publishEvent, props.listen,
 *     props.listeners) so we don't have to manipulate destructuring
 *     patterns — works regardless of whether the widget destructures
 *     or uses (props) directly.
 *   - Are idempotent: running the same op twice is a no-op the
 *     second time.
 *   - Are shape-tolerant: if the source doesn't match the expected
 *     shape, return the input unchanged. Brittle code in the
 *     transform layer is worse than the user manually editing —
 *     fall through gracefully.
 *
 * Brittleness notes:
 *   - The listen-block detection assumes a flat object literal
 *     `props.listen(props.listeners, { ... })` with no nested
 *     braces. Multi-line bodies with `{` inside fall outside the
 *     regex; in that case the transform is a no-op and the user
 *     can edit manually.
 *   - publishEvent removal is line-based (assumes the call is on
 *     a single source line). Multi-line publishEvent calls are
 *     no-op.
 *
 * No React, no electron — testable from node:test.
 */
// Anchor: every transform requires the widget to have a default
// function export. Without that, the file isn't a recognizable
// widget shape and we bail.
const HAS_FUNCTION_EXPORT = /export\s+default\s+function\s+\w+\s*\(/;

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findFunctionBodyStart(code) {
    // Locate the opening `{` of the default-exported function body.
    const match = code.match(
        /export\s+default\s+function\s+\w+\s*\([^)]*\)\s*\{/
    );
    if (!match) return -1;
    return match.index + match[0].length;
}

// ── publishEvent ──────────────────────────────────────────────────

export function addPublishEventStub(code, eventName, widgetName) {
    if (!HAS_FUNCTION_EXPORT.test(code)) return code;
    if (!eventName) return code;
    // Idempotent: if the TODO comment already references this event,
    // bail.
    const stubMarker = `TODO: call props.publishEvent("${eventName}"`;
    if (code.includes(stubMarker)) return code;
    const insertAt = findFunctionBodyStart(code);
    if (insertAt < 0) return code;
    const stub = `\n  // TODO: call props.publishEvent("${eventName}", { /* payload */ }) when the user does the action that should fire this event.`;
    return code.slice(0, insertAt) + stub + code.slice(insertAt);
}

export function removePublishEvent(code, eventName) {
    if (!eventName) return code;
    let out = code;
    // Remove TODO stub comments referencing this event.
    const stubLineRe = new RegExp(
        `\\n[ \\t]*// TODO: call props\\.publishEvent\\("${escapeRegex(
            eventName
        )}"[^\\n]*`,
        "g"
    );
    out = out.replace(stubLineRe, "");
    // Remove single-line publishEvent calls (props-form or destructured).
    const callLineRe = new RegExp(
        `[ \\t]*(?:props\\.)?publishEvent\\("${escapeRegex(
            eventName
        )}"[^\\n]*\\n`,
        "g"
    );
    out = out.replace(callLineRe, "");
    return out;
}

// ── eventHandler (subscribe via listen) ───────────────────────────

// Match both `props.listen(...)` and `props.listen?.(...)` so we can
// detect existing listen blocks regardless of which form they use.
// New code we insert always uses optional chaining (safe in preview
// where the prop isn't injected by WidgetFactory); widgets generated
// before that fix may have the bare form.
const LISTEN_HEAD_RE = /props\.listen\??\.?\(\s*props\.listeners\s*,\s*\{/;

/**
 * Find the existing `props.listen(props.listeners, { ... })` call in
 * the source and return its boundaries + inner-object text. Walks
 * brace depth so nested handler bodies (which contain `{ ... }`)
 * don't fool the matcher. Returns null if no listen call exists or
 * the call is malformed.
 */
function findListenBlock(code) {
    const headMatch = code.match(LISTEN_HEAD_RE);
    if (!headMatch) return null;
    // headMatch.index points at `props.listen(...`
    // The opening brace of the object literal is the LAST char of the
    // matched head string.
    const objectOpenIdx = headMatch.index + headMatch[0].length - 1;
    // Walk forward from one past the opening brace until we hit the
    // matching `}` (depth 0).
    let depth = 1;
    let i = objectOpenIdx + 1;
    for (; i < code.length; i++) {
        const c = code[i];
        if (c === "{") depth++;
        else if (c === "}") {
            depth--;
            if (depth === 0) break;
        }
    }
    if (depth !== 0) return null;
    const objectCloseIdx = i;
    // Skip past the close paren of the listen call and any trailing
    // semicolon so the replacement region encompasses the whole
    // statement.
    let j = objectCloseIdx + 1;
    while (j < code.length && /\s/.test(code[j])) j++;
    if (code[j] !== ")") return null;
    j++;
    while (j < code.length && /\s/.test(code[j])) j++;
    if (code[j] === ";") j++;
    return {
        callStart: headMatch.index,
        objectOpenIdx,
        objectCloseIdx,
        callEnd: j,
        inner: code.slice(objectOpenIdx + 1, objectCloseIdx),
    };
}

function buildHandlerStub(handlerName, widgetName) {
    const safeWidget = String(widgetName || "Widget").replace(/[`"\\]/g, "");
    const safeHandler = String(handlerName || "onEvent").replace(/[`"\\]/g, "");
    return `${safeHandler}: (data) => { console.log("[${safeWidget}] ${safeHandler} received:", data); /* TODO: handle */ },`;
}

export function addEventHandlerStub(code, handlerName, widgetName) {
    if (!HAS_FUNCTION_EXPORT.test(code)) return code;
    if (!handlerName) return code;

    // Idempotent: handler key already present? bail.
    const keyPresentRe = new RegExp(
        `\\b${escapeRegex(handlerName)}\\s*:\\s*\\(data\\)`
    );
    if (keyPresentRe.test(code)) return code;

    const stub = buildHandlerStub(handlerName, widgetName);

    // If a listen block already exists, splice the stub into it.
    const block = findListenBlock(code);
    if (block) {
        const inner = block.inner;
        const trimmed = inner.replace(/\s+$/, "");
        const sep =
            trimmed.endsWith(",") || trimmed === "" ? "\n    " : ",\n    ";
        const newInner = `${trimmed}${sep}${stub}\n  `;
        const replacement = `props.listen?.(props.listeners, {${newInner}});`;
        return (
            code.slice(0, block.callStart) +
            replacement +
            code.slice(block.callEnd)
        );
    }

    // Otherwise insert a new listen call right after the function
    // body's opening brace.
    const insertAt = findFunctionBodyStart(code);
    if (insertAt < 0) return code;
    const newCall = `\n  props.listen?.(props.listeners, {\n    ${stub}\n  });`;
    return code.slice(0, insertAt) + newCall + code.slice(insertAt);
}

/**
 * Remove the matching `<handlerName>: (data) => { … },` entry from
 * the listen block's inner object text. Walks braces so the entry's
 * body (which contains `{ ... }`) doesn't terminate the match early.
 */
function stripHandlerKey(inner, handlerName) {
    const keyRe = new RegExp(
        `(^|[\\s{,])${escapeRegex(
            handlerName
        )}\\s*:\\s*\\(data\\)\\s*=>\\s*\\{`,
        ""
    );
    const m = inner.match(keyRe);
    if (!m) return null;
    // Position of the start of the entry (after the leading delimiter).
    const leadingLen = m[1].length;
    const entryStart = m.index + leadingLen;
    // Position of the `{` that opens the body.
    const bodyOpen = inner.indexOf("{", entryStart);
    if (bodyOpen < 0) return null;
    // Walk braces until the body closes.
    let depth = 1;
    let i = bodyOpen + 1;
    for (; i < inner.length; i++) {
        const c = inner[i];
        if (c === "{") depth++;
        else if (c === "}") {
            depth--;
            if (depth === 0) break;
        }
    }
    if (depth !== 0) return null;
    let entryEnd = i + 1;
    // Eat trailing whitespace + a single trailing comma.
    while (entryEnd < inner.length && /\s/.test(inner[entryEnd])) entryEnd++;
    if (inner[entryEnd] === ",") entryEnd++;
    // Don't remove leading whitespace — the start of the entry might
    // BE the start of the inner string (after the `{`).
    return inner.slice(0, entryStart) + inner.slice(entryEnd);
}

export function removeEventHandler(code, handlerName) {
    if (!handlerName) return code;
    const block = findListenBlock(code);
    if (!block) return code;

    const stripped = stripHandlerKey(block.inner, handlerName);
    if (stripped === null) return code;

    if (stripped.trim() === "") {
        // Drop the entire listen call. Also eat a leading newline +
        // indent if present so we don't leave a blank line.
        let cutStart = block.callStart;
        while (cutStart > 0 && /[ \t]/.test(code[cutStart - 1])) cutStart--;
        if (cutStart > 0 && code[cutStart - 1] === "\n") cutStart--;
        return code.slice(0, cutStart) + code.slice(block.callEnd);
    }
    const replacement = `props.listen?.(props.listeners, {${stripped}});`;
    return (
        code.slice(0, block.callStart) + replacement + code.slice(block.callEnd)
    );
}
