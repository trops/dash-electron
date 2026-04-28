#!/usr/bin/env node
/**
 * Regression-pin: locks in the `synthesizeDefaultConfigCode` helper
 * and its wiring into the message-poller path that runs when the AI
 * emits only a component block (no `.dash.js` config).
 *
 * Why a regression-pin: the synthesizer has been on master since
 * v0.0.510 (PR #470). It is correct as-is. This test ensures a
 * future refactor that drops the synthesizer doesn't silently
 * regress — without it, the Code tab's `.dash.js` editor would go
 * back to displaying empty for every AI build that omits the config
 * block (a known-frequent failure mode).
 *
 * Per the strict-protocol memory's narrow regression-pin exception,
 * this test pattern is approved for regression-pin use here:
 *   (a) user approved the relaxation in the PLAN's `proceed`,
 *   (b) test cites the specific behavior pinned (synthesizer
 *       presence + wiring into the message-poller),
 *   (c) the PLAN is flagged as a regression-pin in its title.
 *
 * Anchors:
 *   - Function declaration: `function synthesizeDefaultConfigCode(`
 *   - At least 2 occurrences of the identifier (declaration + call site)
 *   - Call site within ~5000 chars of the message-poller's
 *     `extractCodeBlocks(` anchor — proves the synthesizer is wired
 *     into the AI-emit path.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
    path.join(__dirname, "..", "src/AiAssistant/WidgetBuilderModal.js"),
    "utf8"
);

assert.ok(
    /function\s+synthesizeDefaultConfigCode\s*\(/.test(source),
    "WidgetBuilderModal.js must declare `function synthesizeDefaultConfigCode(...)`."
);

const occurrences = (source.match(/synthesizeDefaultConfigCode/g) || []).length;
assert.ok(
    occurrences >= 2,
    `synthesizeDefaultConfigCode must appear at least twice (declaration + call site). Found ${occurrences} occurrence(s).`
);

// Confirm the synthesizer is wired into the message-poller path. The
// poller's CALL site anchors on `extractCodeBlocks(msgs)` — the only
// place that variable name appears is inside the message-poller. (The
// other `extractCodeBlocks` occurrence is the function definition far
// earlier in the file; we don't want that one.)
const pollerAnchor = source.indexOf("extractCodeBlocks(msgs)");
assert.ok(
    pollerAnchor >= 0,
    "WidgetBuilderModal.js must contain the message-poller's call to `extractCodeBlocks(msgs)`."
);
const pollerWindow = source.slice(
    pollerAnchor,
    Math.min(source.length, pollerAnchor + 5000)
);
assert.ok(
    /synthesizeDefaultConfigCode\(/.test(pollerWindow),
    "The synthesizer must be called within ~5000 chars after `extractCodeBlocks(` (proves it is wired into the message-poller path that runs when the AI omits the .dash.js block)."
);

console.log(
    `PASS  synthesizeDefaultConfigCode is declared + wired into the message-poller (occurrences: ${occurrences})`
);
