/**
 * Pins the modal-close cleanup in Dash.js.
 *
 * Bug it fixes: `installedWidgetInfo` was never cleared on
 * WidgetBuilderModal close, so a subsequent "Edit with AI" session
 * that the user CANCELLED would inherit the stale install info from
 * the previous session and dispatch a `dash:swap-widget-in-cell`
 * event using the previously-built widget's name AND the new edit
 * cell's gridItemId — swapping a different widget into the user's
 * cell unexpectedly.
 *
 * Fix: the close-time setState block (the one guarded by
 * `if (!open)`) must include BOTH `installedWidgetInfo: null` and
 * `widgetBuilderCellContext: null` so a subsequent open starts from
 * a clean slate.
 *
 * Static source-presence test: locate the close-time setState block
 * (it's the only setState that simultaneously sets
 * isWidgetBuilderOpen: false), then assert the cleanup keys are
 * inside that block.
 */
const fs = require("fs");
const path = require("path");

describe("Dash.js — WidgetBuilderModal close clears stale install state", () => {
    const dashPath = path.join(__dirname, "Dash.js");
    const source = fs.readFileSync(dashPath, "utf8");

    // Walk every `this.setState({...})` call in the file and return
    // the first one that closes the widget builder modal — i.e. its
    // body contains BOTH the key `isWidgetBuilderOpen` and the value
    // `false`. Multiple setStates touch isWidgetBuilderOpen across
    // this file (open=true elsewhere, close=false here); the value
    // pin disambiguates.
    function captureSetStateAt(startIdx) {
        let depth = 0;
        let i = startIdx + "this.setState(".length; // index of `{`
        for (; i < source.length; i++) {
            const c = source[i];
            if (c === "{") depth++;
            else if (c === "}") {
                depth--;
                if (depth === 0) break;
            }
        }
        if (depth !== 0) return null;
        return source.slice(startIdx, i + 2); // include `})`
    }
    function getCloseTimeSetStateBlock() {
        const literal = "this.setState({";
        let cursor = 0;
        while (cursor < source.length) {
            const idx = source.indexOf(literal, cursor);
            if (idx < 0) break;
            const block = captureSetStateAt(idx);
            cursor = idx + literal.length;
            if (!block) continue;
            if (
                /isWidgetBuilderOpen\s*:\s*false/.test(block) &&
                // Skip the one-liner close in the open-settings handler
                // — the close handler ALSO clears widgetBuilderEditContext,
                // which is what we're inspecting.
                /widgetBuilderEditContext\s*:\s*null/.test(block)
            ) {
                return block;
            }
        }
        return null;
    }

    test("can locate the close-time setState block", () => {
        const block = getCloseTimeSetStateBlock();
        expect(block).not.toBeNull();
        // Sanity — block does close the modal.
        expect(block).toMatch(/isWidgetBuilderOpen:\s*false/);
    });

    test("close-time setState clears installedWidgetInfo", () => {
        const block = getCloseTimeSetStateBlock();
        expect(block).not.toBeNull();
        expect(block).toMatch(/installedWidgetInfo:\s*null/);
    });

    test("close-time setState clears widgetBuilderCellContext", () => {
        const block = getCloseTimeSetStateBlock();
        expect(block).not.toBeNull();
        expect(block).toMatch(/widgetBuilderCellContext:\s*null/);
    });
});
