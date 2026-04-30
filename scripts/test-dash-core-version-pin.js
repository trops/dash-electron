#!/usr/bin/env node
/**
 * Regression-pin: dash-electron's `@trops/dash-core` dependency must
 * be at ≥ 0.1.470, the version where forEachWidget walks
 * `workspace.pages[].layout` BEFORE `workspace.layout`. Without this,
 * an auto-migrated single-page workspace (whose pages[0].layout was
 * aliased to workspace.layout in WorkspaceModel and then diverged on
 * the first per-page edit) produced stale top-level items that the
 * id-dedupe in forEachWidget kept visiting first — so the bulk-edit
 * modal's OVERRIDE badge read pre-edit provider bindings even after
 * the user unset a provider in the per-widget Providers panel. Every
 * cycle from 0.1.464 forward correctly fixed write-side propagation;
 * the read-side walk order was the missing piece.
 *
 * Also covers prior pins (≥ 0.1.469 handlePageWorkspaceChange updates
 * openTabs React state; ≥ 0.1.468 per-widget provider edit writes
 * through to both binding layers; ≥ 0.1.467 per-widget provider
 * edits propagate to the parent; ≥ 0.1.466 bulk-apply respects
 * staged unsets; ≥ 0.1.465 bulk-edit writes through to both
 * provider-binding layers; ≥ 0.1.464 provider hooks use widget-
 * identity fallback chain; ≥ 0.1.463 wizard step restructure;
 * ≥ 0.1.462 wizard polish — horizontal banner, sticky sidebar, top
 * Summary; ≥ 0.1.461 registry sign-in CTA in the wizard; ≥ 0.1.460
 * Dashboard Wizard left-sidebar filter layout; ≥ 0.1.459 Providers
 * search matches Dashboards; ≥ 0.1.458 workspace-scoped widget
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
const minRequired = "0.1.470";

function semverGte(a, b) {
    const [aMajor, aMinor, aPatch] = a.split(".").map(Number);
    const [bMajor, bMinor, bPatch] = b.split(".").map(Number);
    if (aMajor !== bMajor) return aMajor > bMajor;
    if (aMinor !== bMinor) return aMinor > bMinor;
    return aPatch >= bPatch;
}

assert.ok(
    semverGte(stripped, minRequired),
    `@trops/dash-core must be >= ${minRequired} (the version where forEachWidget walks pages BEFORE workspace.layout, so per-widget unsets aren't shadowed by the auto-migration alias the bulk modal was reading). Currently pinned at: ${pinned}`
);

console.log(
    `PASS  @trops/dash-core pinned at ${pinned} (>= ${minRequired}, forEachWidget walks pages first so fresh page data wins over stale workspace.layout alias)`
);
