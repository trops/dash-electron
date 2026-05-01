/**
 * Pure normalizer for event names + handler names entered into the
 * Configure tab. The Configure tab's Add buttons let users type free
 * text; this module turns that text into a valid camelCase
 * identifier (events) or `on<EventName>` identifier (handlers) so
 * the names pass through to widget code without breaking
 * `publishEvent("...", ...)` / `listen(listeners, { onX: ... })`
 * call sites.
 *
 * Contracts pinned here:
 *   - normalizeEventName produces a valid camelCase JS identifier
 *     (or "" when input has no usable characters)
 *   - normalizeHandlerName ensures an `on` prefix with PascalCase
 *     remainder (`onItemSelected`)
 *   - Both are idempotent — applying twice gives the same result
 */
const {
    normalizeEventName,
    normalizeHandlerName,
} = require("./widgetEventNames");

// ── normalizeEventName ────────────────────────────────────────────

test("normalizeEventName: spaces become camelCase", () => {
    expect(normalizeEventName("item selected")).toBe("itemSelected");
    expect(normalizeEventName("user clicked row")).toBe("userClickedRow");
});

test("normalizeEventName: kebab-case → camelCase", () => {
    expect(normalizeEventName("item-selected")).toBe("itemSelected");
    expect(normalizeEventName("Item-Selected")).toBe("itemSelected");
});

test("normalizeEventName: SNAKE_CASE → camelCase", () => {
    expect(normalizeEventName("ITEM_SELECTED")).toBe("itemSelected");
    expect(normalizeEventName("user_clicked")).toBe("userClicked");
});

test("normalizeEventName: already camelCase is unchanged (idempotent)", () => {
    expect(normalizeEventName("itemSelected")).toBe("itemSelected");
    expect(normalizeEventName(normalizeEventName("itemSelected"))).toBe(
        "itemSelected"
    );
});

test("normalizeEventName: PascalCase → camelCase (lowercase first letter)", () => {
    expect(normalizeEventName("ItemSelected")).toBe("itemSelected");
});

test("normalizeEventName: trims surrounding whitespace", () => {
    expect(normalizeEventName("  trim me  ")).toBe("trimMe");
});

test("normalizeEventName: drops special characters", () => {
    expect(normalizeEventName("my-event!")).toBe("myEvent");
    expect(normalizeEventName("foo@bar#baz")).toBe("fooBarBaz");
});

test("normalizeEventName: strips leading digits (JS identifiers can't start with one)", () => {
    expect(normalizeEventName("123start")).toBe("start");
    expect(normalizeEventName("9to5")).toBe("to5");
});

test("normalizeEventName: empty / pure-junk input returns empty string", () => {
    expect(normalizeEventName("")).toBe("");
    expect(normalizeEventName("   ")).toBe("");
    expect(normalizeEventName("!!!")).toBe("");
    expect(normalizeEventName(null)).toBe("");
    expect(normalizeEventName(undefined)).toBe("");
});

// ── normalizeHandlerName ──────────────────────────────────────────

test("normalizeHandlerName: bare event name gets an on prefix with PascalCase", () => {
    expect(normalizeHandlerName("itemSelected")).toBe("onItemSelected");
    expect(normalizeHandlerName("queryChanged")).toBe("onQueryChanged");
});

test("normalizeHandlerName: spaced input gets onCamelCase", () => {
    expect(normalizeHandlerName("item selected")).toBe("onItemSelected");
    expect(normalizeHandlerName("user clicked row")).toBe("onUserClickedRow");
});

test("normalizeHandlerName: already-prefixed onX is idempotent", () => {
    expect(normalizeHandlerName("onItemSelected")).toBe("onItemSelected");
    expect(normalizeHandlerName(normalizeHandlerName("onItemSelected"))).toBe(
        "onItemSelected"
    );
});

test("normalizeHandlerName: explicit separators are recovered", () => {
    // When the input has separators (kebab, snake, space), the
    // normalizer can identify word boundaries and produce proper
    // PascalCase.
    expect(normalizeHandlerName("on_item_selected")).toBe("onItemSelected");
    expect(normalizeHandlerName("on-item-selected")).toBe("onItemSelected");
    expect(normalizeHandlerName("ON_ITEM_SELECTED")).toBe("onItemSelected");
});

test("normalizeHandlerName: all-lowercase no-separator input keeps single-word casing (best-effort)", () => {
    // "onitemselected" has no signal where the event name's word
    // boundaries are. Best-effort result is `onItemselected` — the
    // normalizer can't invent boundaries it can't see. The user can
    // re-type with separators or capitals to get the casing they want.
    expect(normalizeHandlerName("onitemselected")).toBe("onItemselected");
});

test("normalizeHandlerName: empty / degenerate input returns empty", () => {
    expect(normalizeHandlerName("")).toBe("");
    expect(normalizeHandlerName("   ")).toBe("");
    // "on" alone has no event name — empty.
    expect(normalizeHandlerName("on")).toBe("");
    expect(normalizeHandlerName(null)).toBe("");
});
