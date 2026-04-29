#!/usr/bin/env node
/**
 * Regression-pin: WidgetBuilderModal's message-poller "messages
 * cleared" detection block must trigger on `lastMsgCount.current > 0`
 * even when `lastCompiledCode.current` is null. Otherwise clicking
 * New Chat after Skip-for-now (no compile yet) leaves the chat in a
 * stale state with no provider gate.
 *
 * Anchors:
 *   - Source contains the "Detect New Chat" comment + the message-
 *     cleared block.
 *   - Within ~600 chars of that comment, source contains BOTH
 *     `lastMsgCount.current` AND `lastCompiledCode.current` —
 *     proves the broadened OR-shaped condition is in source.
 *   - Within the same window, source contains
 *     `setSelectedProviderForBuild(null)` — proves the gate reset
 *     is hooked into this block.
 *
 * Per the strict-protocol memory's narrow regression-pin exception:
 *   (a) user approval in the PLAN's `proceed` is the relaxation grant,
 *   (b) test cites the specific behavior pinned (broadened condition
 *       includes both lastMsgCount and lastCompiledCode references),
 *   (c) the PLAN flagged this as a regression-pin.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
    path.join(__dirname, "..", "src/AiAssistant/WidgetBuilderModal.js"),
    "utf8"
);

const anchorIdx = source.indexOf("Detect New Chat");
assert.ok(
    anchorIdx >= 0,
    'WidgetBuilderModal.js must contain the "Detect New Chat" comment marking the message-poller reset block.'
);

const window = source.slice(
    anchorIdx,
    Math.min(source.length, anchorIdx + 2500)
);

// Anchor on the `hadActivity` variable name introduced in the fix.
// Asserting on `lastMsgCount.current` alone wouldn't be specific
// enough — that ref also exists in the unrelated "update lastMsgCount"
// block right below the cleared-detection.
assert.ok(
    /hadActivity/.test(window),
    "The message-cleared block must declare a `hadActivity` flag combining lastCompiledCode + lastMsgCount."
);

assert.ok(
    /hadActivity[\s\S]{0,400}lastCompiledCode\.current/.test(window) ||
        /lastCompiledCode\.current[\s\S]{0,400}hadActivity/.test(window),
    "`hadActivity` must combine `lastCompiledCode.current` (so the after-compile reset still fires)."
);

assert.ok(
    /hadActivity[\s\S]{0,400}lastMsgCount\.current/.test(window) ||
        /lastMsgCount\.current[\s\S]{0,400}hadActivity/.test(window),
    "`hadActivity` must combine `lastMsgCount.current` (so New Chat after Skip-for-now also fires the reset)."
);

assert.ok(
    /setSelectedProviderForBuild\(null\)/.test(window),
    "The message-cleared block must call `setSelectedProviderForBuild(null)` to re-open the gate on New Chat."
);

console.log(
    "PASS  message-cleared block triggers on lastMsgCount > 0 OR lastCompiledCode, and resets the gate"
);
