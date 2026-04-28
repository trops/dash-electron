#!/usr/bin/env node
/**
 * Regression test: WidgetProviderPicker's dropdown panel must open
 * DOWNWARD (top-full / mt-1), not upward (bottom-full / mb-1).
 *
 * Pure string-presence test on the source file. Not a render test —
 * upgrade to RTL once dash-electron Jest infrastructure is in place
 * (see /Users/johngiatropoulos/.claude/plans/ai-builder-discarded-features-roadmap.md
 * "Cross-cutting infrastructure work" section).
 *
 * Anchored on `max-h-80` since that class is unique to the dropdown
 * panel within WidgetProviderPicker.js (the trigger button uses
 * different sizing).
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
    path.join(__dirname, "..", "src/AiAssistant/WidgetProviderPicker.js"),
    "utf8"
);

const match = source.match(/className=\{?`?[^`"}]*max-h-80[^`"}]*`?\}?/);
assert.ok(match, "could not locate the dropdown panel's className");
const className = match[0];

assert.ok(
    className.includes("top-full"),
    `dropdown should open downward (top-full), got: ${className}`
);
assert.ok(
    className.includes("mt-1"),
    `dropdown should have mt-1 spacing below trigger, got: ${className}`
);
assert.ok(
    !className.includes("bottom-full"),
    `dropdown must not use bottom-full (opens upward), got: ${className}`
);
assert.ok(
    !className.includes("mb-1"),
    `dropdown must not have mb-1 spacing above trigger, got: ${className}`
);

console.log("PASS  picker dropdown opens downward");
