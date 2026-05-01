/**
 * Pure-string transforms that sync the Configure tab's Events /
 * Event Handlers sections with the actual widget JS code.
 *
 * Contracts pinned here:
 *   - addPublishEventStub: inserts a TODO comment + ensures
 *     props.publishEvent is referenced (we use props.X form so we
 *     don't have to manipulate destructuring patterns)
 *   - removePublishEvent: deletes any publishEvent calls for the
 *     given name + the matching TODO comment
 *   - addEventHandlerStub: inserts a listen(props.listeners, {...})
 *     call (or extends an existing one) with a console.log stub
 *     body
 *   - removeEventHandler: removes the named key from the listen
 *     block; collapses the entire listen call when empty
 *   - All transforms are idempotent — running twice with the same
 *     input is a no-op the second time
 *   - All transforms are SHAPE-TOLERANT — if the widget code doesn't
 *     match the expected shape (no `export default function`, etc.)
 *     they return the input unchanged rather than corrupt it
 */
// Uses jest globals (test/expect). The module is plain CJS — require()
// works fine from a .test.js. Kept as jest tests so the project's
// existing `npx jest src/AiAssistant/` sweep covers them; an earlier
// node:test version conflicted with jest auto-discovery on .test.js.
const {
    addPublishEventStub,
    removePublishEvent,
    addEventHandlerStub,
    removeEventHandler,
} = require("./widgetCodeTransforms.cjs");

const SIMPLE_WIDGET = `import React from "react";
import { Panel, Heading } from "@trops/dash-react";

export default function MyWidget(props) {
  const greeting = props.greeting || "Hello";
  return (
    <Panel>
      <Heading text={greeting} />
    </Panel>
  );
}
`;

// ── addPublishEventStub ───────────────────────────────────────────

test("addPublishEventStub adds a TODO comment for the event", () => {
    const result = addPublishEventStub(
        SIMPLE_WIDGET,
        "itemSelected",
        "MyWidget"
    );
    expect(result).toMatch(/TODO[\s\S]*publishEvent\("itemSelected"/);
});

test("addPublishEventStub mentions props.publishEvent so the user knows the API", () => {
    const result = addPublishEventStub(
        SIMPLE_WIDGET,
        "itemSelected",
        "MyWidget"
    );
    expect(result).toMatch(/props\.publishEvent/);
});

test("addPublishEventStub is idempotent", () => {
    const once = addPublishEventStub(SIMPLE_WIDGET, "itemSelected", "MyWidget");
    const twice = addPublishEventStub(once, "itemSelected", "MyWidget");
    expect(once).toBe(twice);
});

test("addPublishEventStub is a no-op on code without `export default function`", () => {
    const weird = "// not a widget\nconst x = 1;";
    const result = addPublishEventStub(weird, "itemSelected", "MyWidget");
    expect(result).toBe(weird);
});

// ── removePublishEvent ────────────────────────────────────────────

test("removePublishEvent removes a matching publishEvent call", () => {
    const withCall = SIMPLE_WIDGET.replace(
        "return (",
        '  props.publishEvent("itemSelected", { id: 1 });\n  return ('
    );
    const result = removePublishEvent(withCall, "itemSelected");
    expect(result).not.toMatch(/publishEvent\("itemSelected"/);
});

test("removePublishEvent removes the TODO stub comment too", () => {
    const stubbed = addPublishEventStub(
        SIMPLE_WIDGET,
        "itemSelected",
        "MyWidget"
    );
    const result = removePublishEvent(stubbed, "itemSelected");
    expect(result).not.toMatch(/TODO[\s\S]*publishEvent\("itemSelected"/);
});

test("removePublishEvent leaves OTHER publishEvent calls alone", () => {
    const withTwo = SIMPLE_WIDGET.replace(
        "return (",
        '  props.publishEvent("itemSelected", { id: 1 });\n  props.publishEvent("queryChanged", { q: "x" });\n  return ('
    );
    const result = removePublishEvent(withTwo, "itemSelected");
    expect(result).not.toMatch(/publishEvent\("itemSelected"/);
    expect(result).toMatch(/publishEvent\("queryChanged"/);
});

test("removePublishEvent is a no-op when the event isn't there", () => {
    const result = removePublishEvent(SIMPLE_WIDGET, "neverPublished");
    expect(result).toBe(SIMPLE_WIDGET);
});

// ── addEventHandlerStub ───────────────────────────────────────────

test("addEventHandlerStub inserts a listen() call when none exists", () => {
    const result = addEventHandlerStub(
        SIMPLE_WIDGET,
        "onItemSelected",
        "MyWidget"
    );
    expect(result).toMatch(/props\.listen\(\s*props\.listeners\s*,\s*\{/);
    expect(result).toMatch(/onItemSelected:\s*\(data\)\s*=>/);
});

test("addEventHandlerStub stub body contains a console.log so the user sees it firing", () => {
    const result = addEventHandlerStub(
        SIMPLE_WIDGET,
        "onItemSelected",
        "MyWidget"
    );
    expect(result).toMatch(/console\.log\([^)]*MyWidget[^)]*onItemSelected/);
});

test("addEventHandlerStub adds a key to an existing listen block", () => {
    const existing = SIMPLE_WIDGET.replace(
        "return (",
        "  props.listen(props.listeners, { onQueryChanged: (data) => { /* existing */ } });\n  return ("
    );
    const result = addEventHandlerStub(existing, "onItemSelected", "MyWidget");
    // Both handlers must be present.
    expect(result).toMatch(/onQueryChanged:/);
    expect(result).toMatch(/onItemSelected:/);
    // Only ONE listen call (we extended, not duplicated).
    const listenCalls = (
        result.match(/props\.listen\(\s*props\.listeners\s*,/g) || []
    ).length;
    expect(listenCalls).toBe(1);
});

test("addEventHandlerStub is idempotent", () => {
    const once = addEventHandlerStub(
        SIMPLE_WIDGET,
        "onItemSelected",
        "MyWidget"
    );
    const twice = addEventHandlerStub(once, "onItemSelected", "MyWidget");
    expect(once).toBe(twice);
});

test("addEventHandlerStub is a no-op on code without `export default function`", () => {
    const weird = "// not a widget";
    expect(addEventHandlerStub(weird, "onItemSelected", "MyWidget")).toBe(
        weird
    );
});

// ── removeEventHandler ────────────────────────────────────────────

test("removeEventHandler removes a single handler key", () => {
    const withTwo = SIMPLE_WIDGET.replace(
        "return (",
        '  props.listen(props.listeners, {\n    onItemSelected: (data) => { console.log("a", data); },\n    onQueryChanged: (data) => { console.log("b", data); },\n  });\n  return ('
    );
    const result = removeEventHandler(withTwo, "onItemSelected");
    expect(result).not.toMatch(/onItemSelected:/);
    expect(result).toMatch(/onQueryChanged:/);
});

test("removeEventHandler drops the entire listen call when the last key goes", () => {
    const lone = addEventHandlerStub(
        SIMPLE_WIDGET,
        "onItemSelected",
        "MyWidget"
    );
    const result = removeEventHandler(lone, "onItemSelected");
    expect(result).not.toMatch(/props\.listen\(/);
});

test("removeEventHandler is a no-op when the handler isn't there", () => {
    const result = removeEventHandler(SIMPLE_WIDGET, "onNeverSubscribed");
    expect(result).toBe(SIMPLE_WIDGET);
});
