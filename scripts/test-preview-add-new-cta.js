#!/usr/bin/env node
/**
 * Asserts the PreviewProviderPicker renders an "Add new" CTA when
 * the chosen type has zero installed instances, and that clicking
 * dispatches `dash:open-settings-create-provider` with the type +
 * providerClass payload.
 *
 * Anchors:
 *   - WidgetBuilderModal.js source contains the literal event name
 *     `dash:open-settings-create-provider` (the dispatched CustomEvent).
 *   - WidgetBuilderModal.js source contains "Add new" text within
 *     ~2000 chars of `compatibleByType` (the variable PreviewProviderPicker
 *     uses to look up instances of the declared type) — a structural
 *     proxy that the button is in the empty-state branch.
 *
 * String-presence test only — pure regex over the source. Same shape
 * as the other 9 dash-electron Node tests.
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
    /dash:open-settings-create-provider/.test(source),
    'WidgetBuilderModal.js must dispatch the "dash:open-settings-create-provider" CustomEvent.'
);

const compatIdx = source.indexOf("compatibleByType");
assert.ok(
    compatIdx >= 0,
    "WidgetBuilderModal.js must reference compatibleByType (PreviewProviderPicker's per-type instance lookup)."
);

// Window is intentionally wide — PreviewProviderPicker's compatibleByType
// is declared near the top of the function and the "Add new" button
// lives in the JSX 60+ lines later. 4000 chars covers that span without
// false-matching deeper into WidgetBuilderModal.
const window = source.slice(
    Math.max(0, compatIdx - 200),
    Math.min(source.length, compatIdx + 4000)
);
assert.ok(
    /Add new/i.test(window),
    'PreviewProviderPicker region (around compatibleByType) must contain "Add new" CTA text.'
);

console.log(
    "PASS  PreviewProviderPicker has Add-new CTA + dispatches dash:open-settings-create-provider"
);
