/**
 * SampleWidgets/Slack — event envelope unwrap pin.
 *
 * Background: dash-core's DashboardPublisher.emit wraps every published
 * value in an envelope `{ message, event, uuid }` before delivering it
 * to listeners. A handler that reads `payload.id` directly off the
 * function argument gets `undefined` — the actual payload lives at
 * `payload.message.id`. The canonical unwrap (used by every Algolia
 * widget) is:
 *
 *   const payload = envelope?.message || envelope;
 *
 * Two Slack widgets in this package consume `channelSelected` and
 * historically read fields off the envelope directly:
 *   - SlackChannelMessages.js
 *   - SlackPostMessage.js
 *
 * Both were silently broken — once the slack-mcp-server CSV bug
 * unblocked channel loading, channel selection looked like it worked
 * (the publisher fired) but the downstream widgets never re-rendered
 * with the right channel because they were reading `envelope.id`,
 * not `envelope.message.id`.
 *
 * This file pins the unwrap idiom inside each widget's channelSelected
 * handler. Static source-presence — matches the pattern of the
 * surrounding Slack package tests and avoids spinning up React + the
 * full provider context for what is fundamentally a string-shaped
 * regression.
 */
const fs = require("fs");
const path = require("path");

function readWidget(name) {
    return fs.readFileSync(path.join(__dirname, `${name}.js`), "utf8");
}

describe("Slack widgets unwrap the event envelope before reading fields", () => {
    test("SlackChannelMessages — channelSelected handler unwraps via envelope?.message", () => {
        const src = readWidget("SlackChannelMessages");
        // The handler closure must contain the unwrap line before
        // any `payload.id` / `payload.name` access. We match the
        // unwrap idiom directly — the closure body is short enough
        // that a single regex over the file proves the fix is in
        // place (the alternative would be to mount the component
        // and dispatch an event, which is much heavier).
        expect(src).toMatch(/envelope\?\.message\s*\|\|\s*envelope/);
    });

    test("SlackPostMessage — channelSelected handler unwraps via envelope?.message", () => {
        const src = readWidget("SlackPostMessage");
        expect(src).toMatch(/envelope\?\.message\s*\|\|\s*envelope/);
    });

    test("neither widget reads `.id` directly off the listener argument", () => {
        // Catches a future regression where someone adds a new
        // handler without the unwrap. The forbidden pattern is a
        // handler that names the argument `payload` and immediately
        // reads `payload.id` / `payload.name` without an unwrap line.
        for (const name of ["SlackChannelMessages", "SlackPostMessage"]) {
            const src = readWidget(name);
            // Disallow the bare pattern: `(payload) =>` followed
            // quickly by `payload.id` / `payload.name` with no unwrap
            // before the access. The unwrap line writes to a local
            // `const payload = ...` so any safe handler will have
            // that line between the argument and the field read.
            const handlerBlocks = src.matchAll(
                /\(payload\)\s*=>\s*\{([\s\S]{0,400}?)\n\s{4,}\}/g
            );
            for (const block of handlerBlocks) {
                const body = block[1];
                if (/payload\.(id|name|channelId|channelName)/.test(body)) {
                    expect(body).toMatch(
                        /(?:envelope|message|payload)\s*=\s*[^;]*\.message/
                    );
                }
            }
        }
    });
});
