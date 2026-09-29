/**
 * runFeed.js
 *
 * Pure reducer that folds a stream of normalized BotEvents (from
 * window.mainApi.bots.onStream) into a renderable feed. Kept separate from the
 * panel so the merge logic (text-delta accumulation, tool_call↔tool_result
 * pairing) is unit-testable without React.
 *
 * Feed item shapes:
 *   { type: "text", text }
 *   { type: "tool", id, name, input?, output?, isError?, status: "running"|"done"|"error" }
 *   { type: "done", stopReason, usage }
 *   { type: "error", message }
 *   { type: "skipped", reason }
 */

/**
 * @param {Array} feed  current feed items
 * @param {object} event  a BotEvent
 * @returns {Array} the next feed (new array)
 */
export function reduceFeed(feed, event) {
    if (!event || !event.type) return feed;
    const next = feed.slice();

    switch (event.type) {
        case "text": {
            const last = next[next.length - 1];
            if (last && last.type === "text") {
                next[next.length - 1] = {
                    ...last,
                    text: last.text + (event.text || ""),
                };
            } else {
                next.push({ type: "text", text: event.text || "" });
            }
            break;
        }
        case "tool_call":
            next.push({
                type: "tool",
                id: event.id,
                name: event.name,
                input: event.input,
                status: "running",
            });
            break;
        case "tool_result": {
            const idx = next.findIndex(
                (i) =>
                    i.type === "tool" &&
                    i.id === event.id &&
                    i.status === "running"
            );
            const resolved = {
                output: event.output,
                isError: !!event.isError,
                status: event.isError ? "error" : "done",
            };
            if (idx >= 0) {
                next[idx] = { ...next[idx], ...resolved };
            } else {
                next.push({
                    type: "tool",
                    id: event.id,
                    name: event.name,
                    ...resolved,
                });
            }
            break;
        }
        case "done":
            next.push({
                type: "done",
                stopReason: event.stopReason,
                usage: event.usage,
            });
            break;
        case "error":
            next.push({ type: "error", message: event.message });
            break;
        case "skipped":
            next.push({ type: "skipped", reason: event.reason });
            break;
        // "session" carries resume state, not display content — ignore.
        default:
            break;
    }
    return next;
}
