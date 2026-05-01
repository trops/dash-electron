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
// Uses jest globals (test/expect). The module is plain ESM —
// jest+babel handle the named-import resolution for .js files.
const {
    addPublishEventStub,
    removePublishEvent,
    addEventHandlerStub,
    removeEventHandler,
    addScheduledTaskStub,
    removeScheduledTask,
} = require("./widgetCodeTransforms");

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

test("addPublishEventStub adds the useWidgetEvents import + destructures publishEvent", () => {
    const result = addPublishEventStub(
        SIMPLE_WIDGET,
        "itemSelected",
        "MyWidget"
    );
    // Canonical API: import { useWidgetEvents } from "@trops/dash-core"
    // and destructure publishEvent from the hook return.
    expect(result).toMatch(/useWidgetEvents/);
    expect(result).toMatch(
        /import\s*\{[^}]*useWidgetEvents[^}]*\}\s*from\s*["']@trops\/dash-core["']/
    );
    expect(result).toMatch(
        /const\s*\{[^}]*publishEvent[^}]*\}\s*=\s*useWidgetEvents\(\)/
    );
});

test("addPublishEventStub TODO comment references bare publishEvent (no props.) name", () => {
    const result = addPublishEventStub(
        SIMPLE_WIDGET,
        "itemSelected",
        "MyWidget"
    );
    // TODO mentions calling publishEvent (the destructured name),
    // not props.publishEvent which would be the legacy form.
    expect(result).toMatch(/TODO[\s\S]*publishEvent\("itemSelected"/);
    expect(result).not.toMatch(/props\.publishEvent/);
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

test("addEventHandlerStub inserts useWidgetEvents import + destructure + listen call when none exists", () => {
    const result = addEventHandlerStub(
        SIMPLE_WIDGET,
        "onItemSelected",
        "MyWidget"
    );
    // Hook import + destructure (listen + listeners both needed).
    expect(result).toMatch(
        /import\s*\{[^}]*useWidgetEvents[^}]*\}\s*from\s*["']@trops\/dash-core["']/
    );
    expect(result).toMatch(
        /const\s*\{[^}]*listen[^}]*listeners[^}]*\}\s*=\s*useWidgetEvents\(\)/
    );
    // Bare listen call (no props.) — uses the destructured names.
    expect(result).toMatch(/\blisten\(\s*listeners\s*,\s*\{/);
    expect(result).toMatch(/onItemSelected:\s*\(data\)\s*=>/);
    // No props.listen leakage — that was the legacy API.
    expect(result).not.toMatch(/props\.listen/);
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
        "export default function MyWidget(props) {",
        `import { useWidgetEvents } from "@trops/dash-core";

export default function MyWidget(props) {
  const { listen, listeners } = useWidgetEvents();
  listen(listeners, { onQueryChanged: (data) => { /* existing */ } });`
    );
    const result = addEventHandlerStub(existing, "onItemSelected", "MyWidget");
    // Both handlers must be present.
    expect(result).toMatch(/onQueryChanged:/);
    expect(result).toMatch(/onItemSelected:/);
    // Only ONE listen call (we extended, not duplicated).
    const listenCalls = (result.match(/\blisten\(\s*listeners\s*,/g) || [])
        .length;
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
        "export default function MyWidget(props) {",
        `import { useWidgetEvents } from "@trops/dash-core";

export default function MyWidget(props) {
  const { listen, listeners } = useWidgetEvents();
  listen(listeners, {
    onItemSelected: (data) => { console.log("a", data); },
    onQueryChanged: (data) => { console.log("b", data); },
  });`
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
    // Bare listen call gets dropped. The destructure + import stay
    // (cheap to leave; no harm if no other handlers reference them).
    expect(result).not.toMatch(/\blisten\(\s*listeners\s*,/);
});

test("removeEventHandler is a no-op when the handler isn't there", () => {
    const result = removeEventHandler(SIMPLE_WIDGET, "onNeverSubscribed");
    expect(result).toBe(SIMPLE_WIDGET);
});

test("removeEventHandler also detects legacy props.listen call shapes", () => {
    // Widgets generated before the hook switch may still have the
    // legacy `props.listen(...)` or `props.listen?.(...)` form. The
    // remove path needs to handle them so user can clean those up
    // via the Configure tab without manual editing.
    const legacy = SIMPLE_WIDGET.replace(
        "return (",
        '  props.listen?.(props.listeners, {\n    onItemSelected: (data) => { console.log("a", data); },\n  });\n  return ('
    );
    const result = removeEventHandler(legacy, "onItemSelected");
    expect(result).not.toMatch(/onItemSelected:/);
});

test("addEventHandlerStub idempotent on import + destructure (no duplicates)", () => {
    const once = addEventHandlerStub(
        SIMPLE_WIDGET,
        "onItemSelected",
        "MyWidget"
    );
    const twice = addEventHandlerStub(once, "onAnother", "MyWidget");
    // Only ONE useWidgetEvents import + ONE destructure even when
    // adding multiple handlers.
    const importCount = (
        twice.match(
            /import\s*\{[^}]*useWidgetEvents[^}]*\}\s*from\s*["']@trops\/dash-core["']/g
        ) || []
    ).length;
    expect(importCount).toBe(1);
    const destructureCount = (twice.match(/=\s*useWidgetEvents\(\)/g) || [])
        .length;
    expect(destructureCount).toBe(1);
});

// ── addScheduledTaskStub ──────────────────────────────────────────

test("addScheduledTaskStub adds the useScheduler import", () => {
    const result = addScheduledTaskStub(
        SIMPLE_WIDGET,
        "refreshData",
        "MyWidget"
    );
    expect(result).toMatch(
        /import\s*\{[^}]*useScheduler[^}]*\}\s*from\s*["']@trops\/dash-core["']/
    );
});

test("addScheduledTaskStub inserts useScheduler({ ... }) call with the task key", () => {
    const result = addScheduledTaskStub(
        SIMPLE_WIDGET,
        "refreshData",
        "MyWidget"
    );
    expect(result).toMatch(/useScheduler\(\s*\{/);
    expect(result).toMatch(/refreshData:\s*\(\s*\)\s*=>/);
});

test("addScheduledTaskStub stub body has a console.log so the user sees it firing", () => {
    const result = addScheduledTaskStub(
        SIMPLE_WIDGET,
        "refreshData",
        "MyWidget"
    );
    expect(result).toMatch(/console\.log\([^)]*MyWidget[^)]*refreshData/);
});

test("addScheduledTaskStub adds a key to an existing useScheduler call", () => {
    const existing = SIMPLE_WIDGET.replace(
        "export default function MyWidget(props) {",
        `import { useScheduler } from "@trops/dash-core";

export default function MyWidget(props) {
  const { tasks } = useScheduler({
    refreshData: () => { console.log("a"); },
  });`
    );
    const result = addScheduledTaskStub(existing, "generateReport", "MyWidget");
    expect(result).toMatch(/refreshData:/);
    expect(result).toMatch(/generateReport:/);
    // Only ONE useScheduler call.
    const schedulerCalls = (result.match(/useScheduler\(/g) || []).length;
    expect(schedulerCalls).toBe(1);
});

test("addScheduledTaskStub is idempotent on the same key", () => {
    const once = addScheduledTaskStub(SIMPLE_WIDGET, "refreshData", "MyWidget");
    const twice = addScheduledTaskStub(once, "refreshData", "MyWidget");
    expect(once).toBe(twice);
});

test("addScheduledTaskStub is a no-op on code without `export default function`", () => {
    const weird = "// not a widget";
    expect(addScheduledTaskStub(weird, "refreshData", "MyWidget")).toBe(weird);
});

// ── removeScheduledTask ──────────────────────────────────────────

test("removeScheduledTask removes a single task key", () => {
    const withTwo = SIMPLE_WIDGET.replace(
        "export default function MyWidget(props) {",
        `import { useScheduler } from "@trops/dash-core";

export default function MyWidget(props) {
  const { tasks } = useScheduler({
    refreshData: () => { console.log("a"); },
    generateReport: () => { console.log("b"); },
  });`
    );
    const result = removeScheduledTask(withTwo, "refreshData");
    expect(result).not.toMatch(/refreshData:/);
    expect(result).toMatch(/generateReport:/);
});

test("removeScheduledTask drops the entire useScheduler call when the last key goes", () => {
    const lone = addScheduledTaskStub(SIMPLE_WIDGET, "refreshData", "MyWidget");
    const result = removeScheduledTask(lone, "refreshData");
    expect(result).not.toMatch(/useScheduler\(/);
});

test("removeScheduledTask is a no-op when the task isn't there", () => {
    expect(removeScheduledTask(SIMPLE_WIDGET, "neverScheduled")).toBe(
        SIMPLE_WIDGET
    );
});
