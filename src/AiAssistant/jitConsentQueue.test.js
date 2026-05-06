/**
 * jitConsentQueue.test.js
 *
 * Pure helper for JitConsentModal's incoming-request queue. Pre-fix the
 * modal stored a single `useState(null)` and overwrote it on every
 * `widget:permission-required` IPC event, silently losing earlier
 * requests when the pipeline bootstrap fired multiple parallel calls.
 * The queue keeps requests FIFO; the user responds to one at a time.
 *
 * Run via `node --test src/AiAssistant/jitConsentQueue.test.js`. Not
 * wired into ci.sh in this slice — adding it to CI is a separate slice.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert");

const { enqueueRequest, dequeueHead } = require("./jitConsentQueue");

test("enqueue: appends to end (FIFO)", () => {
    const out = enqueueRequest([{ requestId: "a" }], { requestId: "b" });
    assert.deepStrictEqual(out, [{ requestId: "a" }, { requestId: "b" }]);
});

test("enqueue: dedupes by requestId (idempotent on duplicate IPC events)", () => {
    const initial = [{ requestId: "a", widgetId: "w1" }];
    const out = enqueueRequest(initial, { requestId: "a", widgetId: "w1" });
    assert.deepStrictEqual(out, [{ requestId: "a", widgetId: "w1" }]);
});

test("enqueue: ignores payloads without requestId (defensive)", () => {
    const initial = [{ requestId: "a" }];
    const out = enqueueRequest(initial, { widgetId: "w1" });
    assert.deepStrictEqual(out, initial);
});

test("enqueue: does not mutate input array", () => {
    const initial = [{ requestId: "a" }];
    const before = [...initial];
    enqueueRequest(initial, { requestId: "b" });
    assert.deepStrictEqual(initial, before);
});

test("dequeue: removes head", () => {
    const out = dequeueHead([
        { requestId: "a" },
        { requestId: "b" },
        { requestId: "c" },
    ]);
    assert.deepStrictEqual(out, [{ requestId: "b" }, { requestId: "c" }]);
});

test("dequeue: empty array returns empty array", () => {
    assert.deepStrictEqual(dequeueHead([]), []);
});

test("dequeue: does not mutate input array", () => {
    const initial = [{ requestId: "a" }, { requestId: "b" }];
    const before = [...initial];
    dequeueHead(initial);
    assert.deepStrictEqual(initial, before);
});
