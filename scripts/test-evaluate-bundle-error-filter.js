#!/usr/bin/env node
/**
 * Asserts public/index.html's early-boot error listeners suppress
 * console logs when the error's stack contains `evaluateBundle` —
 * catches AI-built widgets throwing on the dashboard outside the
 * modal, where the existing __DASH_WIDGET_BUILDER_OPEN flag-based
 * suppression doesn't fire.
 *
 * Anchors:
 *   - `isWidgetBundleError` helper identifier (defined in the inline
 *     script inside index.html).
 *   - The literal `evaluateBundle` referenced inside the helper.
 *   - The helper called from BOTH listeners (`error` + `unhandledrejection`).
 *
 * String-presence test only — pure regex over the source.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
    path.join(__dirname, "..", "public/index.html"),
    "utf8"
);

assert.ok(
    /isWidgetBundleError/.test(source),
    "public/index.html must declare/use an `isWidgetBundleError` helper."
);

assert.ok(
    /evaluateBundle/.test(source),
    "public/index.html must reference `evaluateBundle` (the stack-frame anchor for AI widget bundle errors)."
);

const helperRefs = (source.match(/isWidgetBundleError/g) || []).length;
assert.ok(
    helperRefs >= 3,
    `isWidgetBundleError must appear at least 3 times (1 declaration + 2 call sites — one per listener). Found ${helperRefs}.`
);

// Confirm the helper is referenced near each of the two listener
// registrations. Anchor on the literal addEventListener strings.
const errIdx = source.indexOf('addEventListener(\n                "error"');
const errIdxFallback = errIdx >= 0 ? errIdx : source.indexOf('"error"');
assert.ok(
    errIdxFallback >= 0,
    "public/index.html must register an `error` event listener."
);
const errWindow = source.slice(
    errIdxFallback,
    Math.min(source.length, errIdxFallback + 800)
);
assert.ok(
    /isWidgetBundleError/.test(errWindow),
    "The `error` listener body must reference `isWidgetBundleError`."
);

const rejIdx = source.indexOf('"unhandledrejection"');
assert.ok(
    rejIdx >= 0,
    "public/index.html must register an `unhandledrejection` listener."
);
const rejWindow = source.slice(rejIdx, Math.min(source.length, rejIdx + 800));
assert.ok(
    /isWidgetBundleError/.test(rejWindow),
    "The `unhandledrejection` listener body must reference `isWidgetBundleError`."
);

console.log(
    `PASS  evaluateBundle stack filter wired into both listeners (isWidgetBundleError refs: ${helperRefs})`
);
