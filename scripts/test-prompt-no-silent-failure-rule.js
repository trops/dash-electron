#!/usr/bin/env node
/**
 * Asserts that buildSystemPrompt in WidgetBuilderModal.js contains the
 * silent-failure-UX rule in ALL THREE branches: focused (MCP-picked),
 * no-provider, and legacy fallback. Applies universally because
 * non-MCP widgets can also have caught exceptions (JSON.parse, fetch,
 * prop validation, etc.) that should surface to the user.
 *
 * Anchor phrase: "silently swallow errors" — distinctive and unique
 * to this rule's wording.
 *
 * String-presence test only — pure regex over the source. Upgrade to
 * RTL once dash-electron Jest infrastructure exists.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
    path.join(__dirname, "..", "src/AiAssistant/WidgetBuilderModal.js"),
    "utf8"
);

function countOccurrences(text, needle) {
    const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    return (text.match(re) || []).length;
}

const anchor = "silently swallow errors";
const count = countOccurrences(source, anchor);

assert.ok(
    count >= 3,
    `silent-failure-UX rule (anchor "${anchor}") expected in all 3 prompt branches (focused, no-provider, legacy). Found ${count} occurrence(s).`
);

console.log(
    `PASS  silent-failure-UX rule present in all 3 prompt branches (anchor "${anchor}": ${count})`
);
