/**
 * widgetEventNames — normalizes user-typed event/handler names into
 * valid JS identifiers matching the codebase convention.
 *
 *   - Events: camelCase like `itemSelected`, `queryChanged`.
 *   - Handlers: `on` + PascalCase like `onItemSelected`.
 *
 * Used by the Configure tab's save handler to auto-fix free-form
 * input before it lands in the .dash.js declaration AND the widget
 * code (which we generate via widgetCodeTransforms — those transforms
 * assume valid identifiers).
 */

/**
 * Split a free-form input string into normalized "words". Treats
 * whitespace, hyphens, underscores, and punctuation as separators.
 * Also splits on case boundaries so existing camelCase input is
 * preserved correctly: "itemSelected" → ["item", "Selected"].
 */
function splitWords(input) {
    if (typeof input !== "string") return [];
    let s = input.trim();
    if (!s) return [];
    // Insert a space before a capital that follows a lowercase letter,
    // so case boundaries become word boundaries: "itemSelected" →
    // "item Selected".
    s = s.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
    // Replace any non-alphanumeric run with a single space.
    s = s.replace(/[^A-Za-z0-9]+/g, " ");
    return s.split(/\s+/).filter(Boolean);
}

function lowerFirstChar(s) {
    if (!s) return s;
    return s.charAt(0).toLowerCase() + s.slice(1);
}

function upperFirstChar(s) {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Normalize to camelCase. Drops leading digits (JS identifiers can't
 * start with one) and discards anything that isn't [A-Za-z0-9].
 * Returns "" when nothing usable remains.
 */
export function normalizeEventName(input) {
    const words = splitWords(input);
    if (words.length === 0) return "";
    // First word: all lowercase; subsequent: PascalCase.
    const first = words[0].toLowerCase();
    const rest = words.slice(1).map((w) => upperFirstChar(w.toLowerCase()));
    let combined = first + rest.join("");
    // Strip leading digits — JS identifier rule.
    combined = combined.replace(/^[0-9]+/, "");
    // After stripping digits, the first remaining char might be
    // uppercase (came from a later word). Lowercase it so the result
    // stays camelCase.
    return lowerFirstChar(combined);
}

/**
 * Normalize to handler form: `on<PascalCase>`. If the input already
 * starts with `on` followed by a capital letter we treat the rest as
 * the event name; otherwise the whole input is the event name and we
 * prepend `on`.
 */
export function normalizeHandlerName(input) {
    if (typeof input !== "string") return "";
    const trimmed = input.trim();
    if (!trimmed) return "";

    // Detect existing on-prefix (any casing) and peel it off so the
    // remainder normalizes through the standard event-name path.
    // Always peel when input starts with "on" + at least one more
    // character — the Configure tab's "Event Handlers" section is
    // explicitly for handler names, so a leading `on` reliably means
    // "prefix" (rare edge case: an event called `onlineUser` would
    // come out as `onLineUser`; user can re-type without the on if
    // they really want `online...` as the event name).
    // "on" alone (no event name to suffix) → empty.
    if (/^on$/i.test(trimmed)) return "";

    let body = trimmed;
    if (/^on/i.test(body) && body.length > 2) {
        body = body.slice(2);
    }
    const eventName = normalizeEventName(body);
    if (!eventName) return "";
    return "on" + upperFirstChar(eventName);
}
