#!/usr/bin/env node
/**
 * Regression-pin: dash-electron's `@trops/dash-core` dependency must
 * be at ≥ 0.1.459, the version that aligns the Providers sidebar
 * search input with Dashboards (SearchInput + compact
 * `py-1.5 text-xs`). An older version reverts to the larger plain
 * InputText with no magnifying-glass icon.
 *
 * Also covers prior pins (≥ 0.1.458 workspace-scoped widget
 * placement events; ≥ 0.1.457 search + 4-pill class filter on
 * Providers sidebar; ≥ 0.1.456 list-item click dismisses class
 * chooser; ≥ 0.1.455 consistent ← Back button; ≥ 0.1.454
 * NewProviderPicker class chooser; ≥ 0.1.453 friendlier
 * WidgetErrorBoundary; ≥ 0.1.452 deep-link create-provider;
 * ≥ 0.1.451 End Session removal) because semver.
 *
 * Why a regression-pin: the End Session removal lives in dash-core
 * (shipped as v0.1.451). dash-electron's only role is to consume
 * that version. If the pin is downgraded, the button silently comes
 * back. This test prevents that. Per the protocol memory's narrow
 * regression-pin exception, this test pattern is approved for
 * regression-pin use here (asserts a specific version pin in
 * package.json, cites the behavior pinned).
 *
 * Pure JSON read + version compare — no jsdom, no React.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
);

const pinned = pkg?.dependencies?.["@trops/dash-core"];
assert.ok(
    typeof pinned === "string" && pinned.length > 0,
    `Expected "@trops/dash-core" in package.json dependencies. Got: ${pinned}`
);

// Strip any leading non-digit chars (e.g. ^, ~, >=) before semver compare.
const stripped = pinned.replace(/^[^\d]*/, "");
const minRequired = "0.1.459";

function semverGte(a, b) {
    const [aMajor, aMinor, aPatch] = a.split(".").map(Number);
    const [bMajor, bMinor, bPatch] = b.split(".").map(Number);
    if (aMajor !== bMajor) return aMajor > bMajor;
    if (aMinor !== bMinor) return aMinor > bMinor;
    return aPatch >= bPatch;
}

assert.ok(
    semverGte(stripped, minRequired),
    `@trops/dash-core must be >= ${minRequired} (the version that aligns the Providers search input with the Dashboards search input). Currently pinned at: ${pinned}`
);

console.log(
    `PASS  @trops/dash-core pinned at ${pinned} (>= ${minRequired}, Providers search input matches Dashboards)`
);
