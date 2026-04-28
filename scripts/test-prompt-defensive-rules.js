#!/usr/bin/env node
/**
 * Asserts that buildSystemPrompt in WidgetBuilderModal.js contains
 * BOTH defensive prompt rules in ALL THREE branches (focused /
 * no-provider / legacy):
 *
 *   1. Browser-context ban — anchor: "process.cwd"
 *      Tells the AI not to use Node-only APIs in widget code.
 *      Already present in the focused branch as of v0.0.506.
 *      Must be added to no-provider and legacy branches.
 *
 *   2. Defensive guards on MCP tool responses — anchor: "MCP tool response"
 *      Tells the AI to type-check before calling string/array methods on
 *      `callTool(...)` results. Must be added to all three branches.
 *
 * Anchor selection: chosen to be unique to the rule text (won't appear
 * in other parts of the file). "process.cwd" is unlikely to appear in
 * renderer code; "MCP tool response" is a phrase specific to the new
 * rule wording.
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

const cwdCount = countOccurrences(source, "process.cwd");
const mcpRuleCount = countOccurrences(source, "MCP tool response");

assert.ok(
    cwdCount >= 3,
    `Browser-context rule (anchor "process.cwd") expected in all 3 prompt branches (focused, no-provider, legacy). Found ${cwdCount} occurrence(s).`
);

assert.ok(
    mcpRuleCount >= 3,
    `Defensive-code rule (anchor "MCP tool response") expected in all 3 prompt branches. Found ${mcpRuleCount} occurrence(s).`
);

console.log(
    `PASS  defensive-code prompt rules present in all 3 branches (process.cwd: ${cwdCount}, MCP tool response: ${mcpRuleCount})`
);
