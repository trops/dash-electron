#!/usr/bin/env node
/**
 * Regression: Dash.js's modal-close handler must forward `workspaceId`
 * in BOTH widget-builder placement events. Pairs with the dash-core
 * 0.1.458 workspace-id guard that no-ops the wrong workspace's
 * LayoutBuilder when `gridItemId` / `widgetId` collide across open
 * dashboard tabs.
 *
 *   - `dash:place-widget-in-cell` — new build → empty cell
 *   - `dash:swap-widget-in-cell`  — remix existing widget in-place
 *
 * Without `workspaceId` in the detail, dash-core's guard falls through
 * (it's opt-in) and the bug returns: a widget built for Dashboard A's
 * cell can be silently placed in Dashboard B too, or worse, overwrite
 * an existing cell in B if `gridItemId` happens to match.
 *
 * Static source-presence check on dash-electron's `src/Dash.js`. Pure
 * file read + regex — no DOM, no React.
 */
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const dashJs = fs.readFileSync(
    path.join(__dirname, "..", "src", "Dash.js"),
    "utf8"
);

// Extract the dispatch block for a given event name. The shape is:
//   window.dispatchEvent(
//       new CustomEvent("<event-name>", { detail: { ... } })
//   );
// We want the substring containing the `detail: { ... }` body so we
// can assert workspaceId is among the forwarded fields.
function dispatchBlock(source, eventName) {
    const re = new RegExp(
        "new\\s+CustomEvent\\(\\s*[\\n\\s]*[\"']" +
            eventName +
            "[\"'][\\s\\S]*?\\)\\s*\\)"
    );
    const m = source.match(re);
    return m ? m[0] : null;
}

const placeBlock = dispatchBlock(dashJs, "dash:place-widget-in-cell");
assert.ok(
    placeBlock,
    "Could not locate dash:place-widget-in-cell dispatch in src/Dash.js"
);
assert.ok(
    /workspaceId/.test(placeBlock),
    "dash:place-widget-in-cell dispatch must forward workspaceId so dash-core's workspace-id guard can scope the placement to the originating dashboard. Block found:\n" +
        placeBlock
);

const swapBlock = dispatchBlock(dashJs, "dash:swap-widget-in-cell");
assert.ok(
    swapBlock,
    "Could not locate dash:swap-widget-in-cell dispatch in src/Dash.js"
);
assert.ok(
    /workspaceId/.test(swapBlock),
    "dash:swap-widget-in-cell dispatch must forward workspaceId so the remix path is also workspace-scoped. Block found:\n" +
        swapBlock
);

console.log(
    "PASS  Dash.js forwards workspaceId in both place- and swap-widget-in-cell dispatches"
);
