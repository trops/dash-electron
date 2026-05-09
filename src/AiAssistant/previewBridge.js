/**
 * Host ↔ iframe message bridge for the widget builder preview
 * (slice 17c.1).
 *
 * The bridge wraps `postMessage` / message-event listening with a
 * typed contract so the host React tree and the preview iframe
 * can communicate without sharing context. It's intentionally
 * pure — no DOM access, no React — so it can be unit-tested
 * with a fake iframe ref and exercised with `_dispatch` instead
 * of dispatching real `MessageEvent`s.
 *
 * Protocol invariants enforced here:
 *   1. Every message has shape `{ type: string starting with "bridge:", payload: any }`
 *   2. Messages from origins other than `allowedOrigin` are dropped
 *      silently. `"*"` disables the check (dev-mode escape hatch).
 *   3. Non-bridge messages on the same channel (React DevTools,
 *      webpack HMR, MetaMask wallet probes, etc.) are ignored.
 *   4. A throwing handler is logged but does not stop other
 *      handlers for the same message type from running.
 */

export const BRIDGE_MESSAGE_TYPES = Object.freeze({
    // Host → iframe
    LOAD_BUNDLE: "bridge:load-bundle",
    SET_PROPS: "bridge:set-props",
    SET_THEME: "bridge:set-theme",
    SET_PROVIDERS: "bridge:set-providers",
    UNMOUNT: "bridge:unmount",
    PROVIDER_RESPONSE: "bridge:provider-response",

    // Iframe → host
    READY: "bridge:ready",
    MOUNTED: "bridge:mounted",
    ERROR: "bridge:error",
    RENDER_STATS: "bridge:render-stats",
    PROVIDER_REQUEST: "bridge:provider-request",
});

/**
 * Type guard for a wire-shape bridge message. Accepts any payload
 * (we don't validate per-message-type fields here — handlers do
 * that themselves).
 */
export function isBridgeMessage(data) {
    return (
        data !== null &&
        typeof data === "object" &&
        typeof data.type === "string" &&
        data.type.startsWith("bridge:")
    );
}

/**
 * Create a bridge instance.
 *
 * @param {object}            opts
 * @param {{ current: HTMLIFrameElement | null | { contentWindow: any } }} opts.iframeRef
 *        React ref-like wrapper around the iframe element. Allows
 *        the bridge to be created BEFORE the iframe mounts; calls
 *        to `send()` are no-ops while `current` is null.
 * @param {string}            opts.allowedOrigin
 *        Origin string the iframe should be loaded from. Use `"*"`
 *        only in dev — production should pin the exact origin.
 *
 * @returns {{
 *   send: (type: string, payload?: any) => void,
 *   on: (type: string, handler: (payload: any) => void) => () => void,
 *   destroy: () => void,
 *   _dispatch: (event: { origin: string, data: any }) => void,
 * }}
 */
export function createPreviewBridge({ iframeRef, allowedOrigin }) {
    /** @type {Map<string, Set<Function>>} */
    const handlers = new Map();

    function send(type, payload = {}) {
        const target = iframeRef?.current?.contentWindow;
        if (!target) return;
        const targetOrigin = allowedOrigin === "*" ? "*" : allowedOrigin;
        target.postMessage({ type, payload }, targetOrigin);
    }

    function on(type, handler) {
        let set = handlers.get(type);
        if (!set) {
            set = new Set();
            handlers.set(type, set);
        }
        set.add(handler);
        return () => {
            set.delete(handler);
        };
    }

    function _dispatch(event) {
        if (!event) return;
        if (allowedOrigin !== "*" && event.origin !== allowedOrigin) {
            return;
        }
        if (!isBridgeMessage(event.data)) return;
        const set = handlers.get(event.data.type);
        if (!set || set.size === 0) return;
        for (const h of set) {
            try {
                h(event.data.payload);
            } catch (err) {
                // A buggy handler MUST NOT take down the bridge.
                // Log so the developer sees it; continue to the
                // next subscriber for this message type.
                // eslint-disable-next-line no-console
                console.error(
                    "[previewBridge] handler threw for",
                    event.data.type,
                    err
                );
            }
        }
    }

    function listener(event) {
        _dispatch(event);
    }

    if (
        typeof window !== "undefined" &&
        typeof window.addEventListener === "function"
    ) {
        window.addEventListener("message", listener);
    }

    function destroy() {
        if (
            typeof window !== "undefined" &&
            typeof window.removeEventListener === "function"
        ) {
            window.removeEventListener("message", listener);
        }
        handlers.clear();
    }

    return { send, on, destroy, _dispatch };
}
