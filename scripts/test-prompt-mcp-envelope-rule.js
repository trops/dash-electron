#!/usr/bin/env node
/**
 * Asserts that buildSystemPrompt in WidgetBuilderModal.js contains the
 * MCP response-envelope rule in the two branches that generate MCP
 * widget code: the focused branch (when picker.providerClass === "mcp")
 * and the legacy fallback branch.
 *
 * Anchor phrase: "MCP response envelope" — the rule's header phrase,
 * unique to this rule's wording.
 *
 * The no-provider branch is intentionally excluded — when the user
 * picks "no external provider", there is no MCP context for the rule
 * to apply to.
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

const anchor = "MCP response envelope";
const count = countOccurrences(source, anchor);

assert.ok(
    count >= 2,
    `MCP response-envelope rule (anchor "${anchor}") expected in 2 prompt branches (focused MCP + legacy). Found ${count} occurrence(s).`
);

console.log(
    `PASS  MCP response-envelope rule present in 2 prompt branches (anchor "${anchor}": ${count})`
);
