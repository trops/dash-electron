#!/usr/bin/env node
/**
 * Asserts the duplicate "This widget needs N provider you haven't
 * installed yet" banner is GONE from WidgetBuilderModal.js. The
 * preview-area dropdown's "+ Add new <type> provider" CTA (shipped
 * in v0.0.513) is the single source of install action — having two
 * CTAs in the same modal was redundant noise AND the deleted banner
 * dispatched the old dash:install-known-external event that opened
 * InstallExternalMcpModal behind the WidgetBuilder (the z-stacking
 * bug we worked around with the Settings deep-link path).
 *
 * Anchors:
 *   - Source must NOT contain "This widget needs" (banner headline).
 *   - Source must NOT contain `missingExternalProviders` (orphaned
 *     useMemo identifier with no remaining call sites).
 *
 * String-presence test only — same pattern as the other 12 tests.
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
    !/This widget needs/.test(source),
    'WidgetBuilderModal.js must not contain the "This widget needs N provider…" install banner — that CTA was duplicate noise alongside the preview-area dropdown\'s "+ Add new" button.'
);

assert.ok(
    !/missingExternalProviders/.test(source),
    "WidgetBuilderModal.js must not contain `missingExternalProviders` — orphaned useMemo identifier after the banner was removed."
);

console.log(
    "PASS  duplicate missing-provider banner is gone (and the unused useMemo with it)"
);
