#!/usr/bin/env node
/**
 * Regression-pin: dash-electron's `@trops/dash-core` dependency must
 * be at ≥ 0.1.452, the version that adds the deep-link create-provider
 * flow (initialProviderType / initialProviderClass on AppSettingsModal,
 * `dash:open-settings-create-provider` listener on DashboardStage). An
 * older version would silently disable the Widget Builder's "Add new
 * <type>" CTA — the dispatched event would have no listener, no
 * Settings open, no provider created.
 *
 * Also covers the prior pin (≥ 0.1.451 — End Session button removed)
 * because semver.
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
const minRequired = "0.1.452";

function semverGte(a, b) {
    const [aMajor, aMinor, aPatch] = a.split(".").map(Number);
    const [bMajor, bMinor, bPatch] = b.split(".").map(Number);
    if (aMajor !== bMajor) return aMajor > bMajor;
    if (aMinor !== bMinor) return aMinor > bMinor;
    return aPatch >= bPatch;
}

assert.ok(
    semverGte(stripped, minRequired),
    `@trops/dash-core must be >= ${minRequired} (the version that removed the End Session button from ChatCore). Currently pinned at: ${pinned}`
);

console.log(
    `PASS  @trops/dash-core pinned at ${pinned} (>= ${minRequired}, includes deep-link create-provider flow)`
);
