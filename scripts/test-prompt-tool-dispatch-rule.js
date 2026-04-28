#!/usr/bin/env node
/**
 * Asserts that buildSystemPrompt in WidgetBuilderModal.js contains the
 * MCP tool-name-dispatch rule in the two branches that generate MCP
 * widget code: the focused branch (when picker.providerClass === "mcp")
 * and the legacy fallback branch.
 *
 * Anchor phrase: "hardcode tool names" — chosen because it is unique
 * to this rule's wording and won't appear elsewhere in the file.
 *
 * The no-provider branch is intentionally excluded — when the user
 * explicitly picks "no external provider", there is no MCP context for
 * the rule to apply to.
 *
 * String-presence test only — pure regex over the source. Upgrade to
 * RTL once dash-electron Jest infrastructure exists (see roadmap's
 * cross-cutting section).
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

const anchor = "hardcode tool names";
const count = countOccurrences(source, anchor);

assert.ok(
    count >= 2,
    `MCP tool-name-dispatch rule (anchor "${anchor}") expected in 2 prompt branches (focused MCP + legacy). Found ${count} occurrence(s).`
);

console.log(
    `PASS  MCP tool-name-dispatch rule present in 2 prompt branches (anchor "${anchor}": ${count})`
);
