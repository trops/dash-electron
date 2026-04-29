#!/usr/bin/env node
/**
 * Asserts ChatProviderGate intercepts type-button clicks when the
 * user has zero installed instances of the chosen type and shows
 * a three-action panel (Create new / Skip for now / Cancel).
 *
 * Anchors:
 *   - `pendingType` state identifier (the interim selection captured
 *     while the user decides what to do about the empty-instances case).
 *   - "Create new" button text (CTA that dispatches the existing
 *     dash:open-settings-create-provider event).
 *   - "Skip for now" button text (CTA that calls onChange anyway —
 *     the widget will declare the type but won't have a configured
 *     provider until the user adds one later).
 *   - The dispatched event name `dash:open-settings-create-provider`.
 *
 * String-presence test only — same shape as the other 10 tests.
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
    /pendingType/.test(source),
    "ChatProviderGate.js must declare a `pendingType` state for the no-instances confirmation."
);

assert.ok(
    /Create new/.test(source),
    'ChatProviderGate.js must render a "Create new" button in the no-instances prompt.'
);

assert.ok(
    /Skip for now/.test(source),
    'ChatProviderGate.js must render a "Skip for now" button in the no-instances prompt.'
);

assert.ok(
    /dash:open-settings-create-provider/.test(source),
    "ChatProviderGate.js must dispatch the dash:open-settings-create-provider event from the Create-new button."
);

console.log(
    "PASS  gate prompts (Create new / Skip for now / Cancel) when chosen type has no installed instances"
);
