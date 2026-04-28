#!/usr/bin/env node
/**
 * Asserts the chat-area provider gate is wired up:
 *
 *   1. ChatProviderGate.js component file exists.
 *   2. WidgetBuilderModal.js imports ChatProviderGate.
 *   3. WidgetBuilderModal.js no longer renders <WidgetProviderPicker
 *      (the old bottom-of-chat dropdown is gone).
 *   4. WidgetBuilderModal.js contains the gate's conditional render
 *      guard (selectedProviderForBuild === null) within ~5 lines of
 *      a ChatProviderGate reference.
 *
 * String-presence test only — pure regex over the source. Upgrade to
 * RTL once dash-electron Jest infrastructure exists.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const gatePath = path.join(
    __dirname,
    "..",
    "src/AiAssistant/ChatProviderGate.js"
);
assert.ok(
    fs.existsSync(gatePath),
    `Expected ${gatePath} to exist (the new gate component).`
);

const modal = fs.readFileSync(
    path.join(__dirname, "..", "src/AiAssistant/WidgetBuilderModal.js"),
    "utf8"
);

assert.ok(
    /import\s+\{[^}]*ChatProviderGate[^}]*\}\s+from\s+["'][^"']*ChatProviderGate/.test(
        modal
    ),
    "WidgetBuilderModal.js should import ChatProviderGate."
);

assert.ok(
    !/<WidgetProviderPicker\b/.test(modal),
    "WidgetBuilderModal.js should not render <WidgetProviderPicker any longer (the old dropdown was replaced by the gate)."
);

const gateRender = modal.match(
    /selectedProviderForBuild\s*===\s*null[\s\S]{0,500}<ChatProviderGate\b|<ChatProviderGate\b[\s\S]{0,500}selectedProviderForBuild\s*===\s*null/
);
assert.ok(
    gateRender,
    "WidgetBuilderModal.js should conditionally render <ChatProviderGate based on `selectedProviderForBuild === null`."
);

console.log(
    "PASS  provider gate is wired (file exists, imported, old picker removed, conditional render present)"
);
