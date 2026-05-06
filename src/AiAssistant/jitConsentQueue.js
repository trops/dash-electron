/**
 * jitConsentQueue
 *
 * Pure FIFO helpers for JitConsentModal's incoming-request state.
 * Pre-fix the modal kept a single `useState(null)` and overwrote it
 * on every `widget:permission-required` IPC event — when the pipeline
 * bootstrap fired multiple parallel calls, the modal showed only the
 * latest event and the earlier ones silently waited for their main-side
 * timeout, leaving the user with multiple "JIT consent timed out"
 * errors they never had a chance to respond to.
 *
 * CommonJS shape so `node --test` can require it directly. Webpack
 * handles the interop when JitConsentModal does `import { ... }`.
 */

/**
 * Append a request payload to the queue, deduping by requestId so
 * duplicate IPC events (rare but possible if a renderer remounts mid-
 * request) don't double-enqueue. Returns a NEW array — caller stores
 * via setQueue((q) => enqueueRequest(q, payload)) so React state
 * comparisons stay reference-based.
 */
function enqueueRequest(queue, payload) {
    if (
        !payload ||
        typeof payload.requestId !== "string" ||
        !payload.requestId
    ) {
        return queue;
    }
    if (queue.some((entry) => entry?.requestId === payload.requestId)) {
        return queue;
    }
    return [...queue, payload];
}

/**
 * Remove the head of the queue (the request currently displayed). The
 * next request, if any, becomes the new head and renders next render.
 * Returns a NEW array; safe for setState.
 */
function dequeueHead(queue) {
    if (!Array.isArray(queue) || queue.length === 0) return [];
    return queue.slice(1);
}

module.exports = { enqueueRequest, dequeueHead };
