#!/usr/bin/env node
/**
 * Asserts ChatProviderGate.js renders a list of provider TYPES drawn
 * from all known sources (built-in MCP catalog + known-external
 * catalog + installed providers' types), NOT a list of installed
 * provider instances.
 *
 * Anchors:
 *   - Source must reference `typeOptions` (the new identifier for
 *     the deduped type list).
 *   - Source must NOT reference `installedOptions` (the old
 *     instance-list identifier from the pre-refactor gate).
 *   - Source must reference all three catalog sources via either
 *     a prop name or an explicit catalog/types reference.
 *
 * String-presence test only — pure regex over the source. Upgrade to
 * RTL once dash-electron Jest infrastructure exists.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
    path.join(__dirname, "..", "src/AiAssistant/ChatProviderGate.js"),
    "utf8"
);

assert.ok(
    /typeOptions/.test(source),
    "ChatProviderGate.js must declare a `typeOptions` list (the new deduped type list)."
);

assert.ok(
    !/installedOptions/.test(source),
    "ChatProviderGate.js must NOT use `installedOptions` (legacy instance-list identifier from the pre-refactor gate)."
);

assert.ok(
    /builtInCatalog/.test(source),
    "ChatProviderGate.js must reference `builtInCatalog` as one of the type sources."
);

assert.ok(
    /knownExternalCatalog/.test(source),
    "ChatProviderGate.js must reference `knownExternalCatalog` as one of the type sources."
);

assert.ok(
    /installedProviders/.test(source) ||
        /providersMap/.test(source) ||
        /appProviders/.test(source),
    "ChatProviderGate.js must reference installed providers as one of the type sources."
);

console.log(
    "PASS  ChatProviderGate lists TYPES from all three sources (built-in catalog, known-external catalog, installed providers)"
);
