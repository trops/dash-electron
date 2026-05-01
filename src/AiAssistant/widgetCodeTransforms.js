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

/**
 * Ensure a named import from a given source is present. If the
 * source already has a `import { ... } from "<source>"` line, add
 * `name` to the names list (idempotent — no-op if already there).
 * If no import from the source exists, insert a fresh import line
 * after the last existing import line (or at file top if there are
 * none). Returns the updated code.
 */
function ensureNamedImport(code, name, source) {
    // 1. Already present in some import from this source?
    const presenceRe = new RegExp(
        `import\\s*\\{[^}]*\\b${escapeRegex(
            name
        )}\\b[^}]*\\}\\s*from\\s*["']${escapeRegex(source)}["']`
    );
    if (presenceRe.test(code)) return code;

    // 2. An import from this source exists with OTHER names — add to it.
    const existingRe = new RegExp(
        `(import\\s*\\{)([^}]*)(\\}\\s*from\\s*["']${escapeRegex(source)}["'])`
    );
    const existingMatch = code.match(existingRe);
    if (existingMatch) {
        const [, head, names, tail] = existingMatch;
        const trimmed = names.replace(/\s+$/, "");
        const sep = trimmed.endsWith(",") || trimmed.trim() === "" ? " " : ", ";
        return code.replace(
            existingRe,
            `${head}${trimmed}${sep}${name} ${tail}`
        );
    }

    // 3. No import from this source — add a new import line. Place
    // it after the last `import` statement so they cluster at the top.
    const importMatches = [...code.matchAll(/^import[^\n]*\n/gm)];
    if (importMatches.length > 0) {
        const last = importMatches[importMatches.length - 1];
        const insertAt = last.index + last[0].length;
        const line = `import { ${name} } from "${source}";\n`;
        return code.slice(0, insertAt) + line + code.slice(insertAt);
    }
    // No imports at all — prepend.
    return `import { ${name} } from "${source}";\n` + code;
}

/**
 * Find an existing `const { ... } = useWidgetEvents();` destructure
 * statement and return its boundaries + names list. Returns null
 * when none exists.
 */
function findUseWidgetEventsDestructure(code) {
    const re = /const\s*\{\s*([^}]*)\s*\}\s*=\s*useWidgetEvents\(\)\s*;?/;
    const m = code.match(re);
    if (!m) return null;
    const names = m[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return {
        start: m.index,
        end: m.index + m[0].length,
        names,
        source: m[0],
    };
}

/**
 * Ensure the useWidgetEvents() destructure exists at the top of the
 * function body and includes ALL the requested names. If it already
 * exists with some of the names, ADD the missing ones to it. If it
 * doesn't exist, insert a new line right after the function body's
 * opening brace.
 *
 * Names is an array like ["listen", "listeners"] or ["publishEvent"].
 */
function ensureUseWidgetEventsDestructure(code, names) {
    const existing = findUseWidgetEventsDestructure(code);
    if (existing) {
        const have = new Set(existing.names);
        const add = names.filter((n) => !have.has(n));
        if (add.length === 0) return code;
        const merged = [...existing.names, ...add].join(", ");
        const replacement = `const { ${merged} } = useWidgetEvents();`;
        return (
            code.slice(0, existing.start) +
            replacement +
            code.slice(existing.end)
        );
    }
    // Insert at the top of the function body. Hooks must come before
    // any conditional return — placing at the very top satisfies that.
    const insertAt = findFunctionBodyStart(code);
    if (insertAt < 0) return code;
    const line = `\n  const { ${names.join(", ")} } = useWidgetEvents();`;
    return code.slice(0, insertAt) + line + code.slice(insertAt);
}

// ── publishEvent ──────────────────────────────────────────────────

export function addPublishEventStub(code, eventName, widgetName) {
    if (!HAS_FUNCTION_EXPORT.test(code)) return code;
    if (!eventName) return code;
    // Idempotent: bail if the TODO already mentions this event.
    const stubMarker = `TODO: call publishEvent("${eventName}"`;
    if (code.includes(stubMarker)) return code;

    let out = code;
    out = ensureNamedImport(out, "useWidgetEvents", "@trops/dash-core");
    out = ensureUseWidgetEventsDestructure(out, ["publishEvent"]);

    // Insert the TODO comment right after the destructure line so
    // the user sees it in context. Find the destructure now (we just
    // ensured it exists) and insert after it.
    const destructure = findUseWidgetEventsDestructure(out);
    const insertAt = destructure ? destructure.end : findFunctionBodyStart(out);
    if (insertAt < 0) return out;
    const stub = `\n  // TODO: call publishEvent("${eventName}", { /* payload */ }) when the user does the action that should fire this event.`;
    return out.slice(0, insertAt) + stub + out.slice(insertAt);
}

export function removePublishEvent(code, eventName) {
    if (!eventName) return code;
    let out = code;
    // Remove TODO stub comments referencing this event (both legacy
    // `props.publishEvent` and current `publishEvent` forms).
    const stubLineRe = new RegExp(
        `\\n[ \\t]*// TODO: call (?:props\\.)?publishEvent\\("${escapeRegex(
            eventName
        )}"[^\\n]*`,
        "g"
    );
    out = out.replace(stubLineRe, "");
    // Remove single-line publishEvent calls (bare destructured form
    // OR legacy props-form so cleanup works on widgets generated
    // before the hook switch).
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

// Match three listen-call shapes so we can detect existing blocks
// regardless of which form they use:
//   - `listen(listeners, {` — canonical hook form (what we now insert)
//   - `props.listen(props.listeners, {` — legacy WidgetFactory form
//   - `props.listen?.(props.listeners, {` — optional-chained legacy form
// New code we insert always uses the canonical hook form. The legacy
// matchers ensure remove operations work on widgets generated before
// the hook switch.
const LISTEN_HEAD_RE =
    /(?:(?:props\.)?listen)\??\.?\(\s*(?:props\.)?listeners\s*,\s*\{/;

/**
 * Find the existing listen() call in the source (any supported shape)
 * and return its boundaries + inner-object text. Walks brace depth
 * so nested handler bodies (which contain `{ ... }`) don't fool the
 * matcher. Returns null if no listen call exists or the call is
 * malformed.
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

    let out = code;
    out = ensureNamedImport(out, "useWidgetEvents", "@trops/dash-core");
    out = ensureUseWidgetEventsDestructure(out, ["listen", "listeners"]);

    const stub = buildHandlerStub(handlerName, widgetName);

    // If a listen block already exists, splice the stub into it.
    const block = findListenBlock(out);
    if (block) {
        const inner = block.inner;
        const trimmed = inner.replace(/\s+$/, "");
        const sep =
            trimmed.endsWith(",") || trimmed === "" ? "\n    " : ",\n    ";
        const newInner = `${trimmed}${sep}${stub}\n  `;
        const replacement = `listen(listeners, {${newInner}});`;
        return (
            out.slice(0, block.callStart) +
            replacement +
            out.slice(block.callEnd)
        );
    }

    // Otherwise insert a new listen call right after the
    // useWidgetEvents destructure (which we just ensured exists),
    // so listen + listeners are already in scope above the call.
    const destructure = findUseWidgetEventsDestructure(out);
    const insertAt = destructure ? destructure.end : findFunctionBodyStart(out);
    if (insertAt < 0) return out;
    const newCall = `\n  listen(listeners, {\n    ${stub}\n  });`;
    return out.slice(0, insertAt) + newCall + out.slice(insertAt);
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
    // After the strip, normalize to the canonical hook form so the
    // result matches what addEventHandlerStub would produce. (Same
    // shape, easier to reason about.)
    const replacement = `listen(listeners, {${stripped}});`;
    return (
        code.slice(0, block.callStart) + replacement + code.slice(block.callEnd)
    );
}

// ── scheduledTasks (useScheduler) ─────────────────────────────────

const SCHEDULER_HEAD_RE = /useScheduler\(\s*\{/;

/**
 * Find an existing `useScheduler({ ... })` call and return its
 * boundaries + inner-object text. Walks brace depth so nested task
 * handler bodies don't fool the matcher. Returns null when none
 * exists or the call is malformed.
 *
 * The match starts at the outer wrapping (`const { tasks } = ` or
 * bare expression) — we capture only the call itself; the surrounding
 * statement context is unchanged by add/remove operations.
 */
function findUseSchedulerCall(code) {
    const headMatch = code.match(SCHEDULER_HEAD_RE);
    if (!headMatch) return null;
    const objectOpenIdx = headMatch.index + headMatch[0].length - 1;
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
    // Walk past the close paren so the replacement region is the
    // whole `useScheduler(...)` call.
    let j = objectCloseIdx + 1;
    while (j < code.length && /\s/.test(code[j])) j++;
    if (code[j] !== ")") return null;
    j++;
    return {
        callStart: headMatch.index,
        objectOpenIdx,
        objectCloseIdx,
        callEnd: j,
        inner: code.slice(objectOpenIdx + 1, objectCloseIdx),
    };
}

function buildScheduledTaskStub(taskKey, widgetName) {
    const safeWidget = String(widgetName || "Widget").replace(/[`"\\]/g, "");
    const safeKey = String(taskKey || "task").replace(/[`"\\]/g, "");
    return `${safeKey}: () => { console.log("[${safeWidget}] scheduled task ${safeKey} fired"); /* TODO: handle */ },`;
}

export function addScheduledTaskStub(code, taskKey, widgetName) {
    if (!HAS_FUNCTION_EXPORT.test(code)) return code;
    if (!taskKey) return code;

    // Idempotent: if the task key is already in some useScheduler
    // call, bail.
    const keyPresentRe = new RegExp(
        `\\b${escapeRegex(taskKey)}\\s*:\\s*\\(\\s*\\)\\s*=>`
    );
    if (keyPresentRe.test(code)) return code;

    let out = code;
    out = ensureNamedImport(out, "useScheduler", "@trops/dash-core");

    const stub = buildScheduledTaskStub(taskKey, widgetName);

    // If a useScheduler call already exists, splice into it.
    const block = findUseSchedulerCall(out);
    if (block) {
        const inner = block.inner;
        const trimmed = inner.replace(/\s+$/, "");
        const sep =
            trimmed.endsWith(",") || trimmed === "" ? "\n    " : ",\n    ";
        const newInner = `${trimmed}${sep}${stub}\n  `;
        const replacement = `useScheduler({${newInner}})`;
        return (
            out.slice(0, block.callStart) +
            replacement +
            out.slice(block.callEnd)
        );
    }

    // Otherwise insert a new `const { tasks } = useScheduler({...});`
    // call right after the function body's opening brace. Hooks
    // first, before any conditional return.
    const insertAt = findFunctionBodyStart(out);
    if (insertAt < 0) return out;
    const newCall = `\n  const { tasks } = useScheduler({\n    ${stub}\n  });`;
    return out.slice(0, insertAt) + newCall + out.slice(insertAt);
}

/**
 * Strip the matching `<taskKey>: () => { … },` entry from the
 * useScheduler call's inner object text. Walks braces so the entry's
 * body doesn't terminate the match early.
 */
function stripScheduledTaskKey(inner, taskKey) {
    const keyRe = new RegExp(
        `(^|[\\s{,])${escapeRegex(taskKey)}\\s*:\\s*\\(\\s*\\)\\s*=>\\s*\\{`,
        ""
    );
    const m = inner.match(keyRe);
    if (!m) return null;
    const leadingLen = m[1].length;
    const entryStart = m.index + leadingLen;
    const bodyOpen = inner.indexOf("{", entryStart);
    if (bodyOpen < 0) return null;
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
    while (entryEnd < inner.length && /\s/.test(inner[entryEnd])) entryEnd++;
    if (inner[entryEnd] === ",") entryEnd++;
    return inner.slice(0, entryStart) + inner.slice(entryEnd);
}

export function removeScheduledTask(code, taskKey) {
    if (!taskKey) return code;
    const block = findUseSchedulerCall(code);
    if (!block) return code;

    const stripped = stripScheduledTaskKey(block.inner, taskKey);
    if (stripped === null) return code;

    if (stripped.trim() === "") {
        // Drop the whole `const { tasks } = useScheduler({...});`
        // statement. Walk back from callStart to eat the leading
        // `const { tasks } = ` plus any indent + newline so we don't
        // leave a dangling blank line or orphan const.
        let cutStart = block.callStart;
        // Eat backwards: optional `const { ... } = ` prefix.
        const prefixRe = /\n[ \t]*const\s*\{[^}]*\}\s*=\s*$/;
        const before = code.slice(0, cutStart);
        const prefixMatch = before.match(prefixRe);
        if (prefixMatch) {
            cutStart = prefixMatch.index;
        } else {
            // No const-destructure prefix — just trim leading
            // whitespace + newline.
            while (cutStart > 0 && /[ \t]/.test(code[cutStart - 1])) cutStart--;
            if (cutStart > 0 && code[cutStart - 1] === "\n") cutStart--;
        }
        // Also eat a trailing `;` if present.
        let cutEnd = block.callEnd;
        if (code[cutEnd] === ";") cutEnd++;
        return code.slice(0, cutStart) + code.slice(cutEnd);
    }
    const replacement = `useScheduler({${stripped}})`;
    return (
        code.slice(0, block.callStart) + replacement + code.slice(block.callEnd)
    );
}
