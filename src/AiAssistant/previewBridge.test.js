/**
 * Tests for the host ↔ iframe message bridge (slice 17c.1).
 *
 * The bridge is a pure module: it wraps postMessage / message-event
 * listening with a typed message contract so the host and the
 * preview iframe speak the same language. These tests exercise the
 * contract without mounting an actual iframe.
 *
 * Test stance:
 *   - the bridge MUST validate message shape (type + payload)
 *   - unknown / malformed messages are dropped with a console warn,
 *     never throw — a buggy iframe shouldn't crash the host
 *   - origin is checked: postMessage from a foreign window is ignored
 *   - subscribers are isolated: throwing in one handler does not
 *     prevent later handlers from running
 */
import {
    BRIDGE_MESSAGE_TYPES,
    isBridgeMessage,
    createPreviewBridge,
} from "./previewBridge";

describe("BRIDGE_MESSAGE_TYPES — typed contract", () => {
    test("exposes host→iframe message types", () => {
        expect(BRIDGE_MESSAGE_TYPES).toMatchObject({
            LOAD_BUNDLE: "bridge:load-bundle",
            SET_PROPS: "bridge:set-props",
            SET_THEME: "bridge:set-theme",
            SET_PROVIDERS: "bridge:set-providers",
            UNMOUNT: "bridge:unmount",
            PROVIDER_RESPONSE: "bridge:provider-response",
        });
    });

    test("exposes iframe→host message types", () => {
        expect(BRIDGE_MESSAGE_TYPES).toMatchObject({
            READY: "bridge:ready",
            MOUNTED: "bridge:mounted",
            ERROR: "bridge:error",
            RENDER_STATS: "bridge:render-stats",
            PROVIDER_REQUEST: "bridge:provider-request",
        });
    });
});

describe("isBridgeMessage — shape validator", () => {
    test("accepts a well-formed bridge message", () => {
        expect(isBridgeMessage({ type: "bridge:ready", payload: {} })).toBe(
            true
        );
        expect(
            isBridgeMessage({
                type: "bridge:load-bundle",
                payload: { bundleSource: "x" },
            })
        ).toBe(true);
    });

    test("rejects messages without the bridge: prefix", () => {
        expect(isBridgeMessage({ type: "ready", payload: {} })).toBe(false);
        expect(
            isBridgeMessage({ type: "react-devtools-bridge", payload: {} })
        ).toBe(false);
    });

    test("rejects non-objects", () => {
        expect(isBridgeMessage(null)).toBe(false);
        expect(isBridgeMessage(undefined)).toBe(false);
        expect(isBridgeMessage("bridge:ready")).toBe(false);
        expect(isBridgeMessage(42)).toBe(false);
    });

    test("rejects messages with non-string type", () => {
        expect(isBridgeMessage({ type: 123, payload: {} })).toBe(false);
        expect(isBridgeMessage({ payload: {} })).toBe(false);
    });
});

describe("createPreviewBridge — host-side surface", () => {
    let mockIframe;
    let posted;

    beforeEach(() => {
        posted = [];
        mockIframe = {
            contentWindow: {
                postMessage: (msg, origin) => {
                    posted.push({ msg, origin });
                },
            },
        };
    });

    test("send() posts to iframe.contentWindow with the expected origin", () => {
        const bridge = createPreviewBridge({
            iframeRef: { current: mockIframe },
            allowedOrigin: "http://localhost:3000",
        });
        bridge.send("bridge:set-theme", { currentTheme: { x: 1 } });

        expect(posted).toHaveLength(1);
        expect(posted[0].msg).toEqual({
            type: "bridge:set-theme",
            payload: { currentTheme: { x: 1 } },
        });
        expect(posted[0].origin).toBe("http://localhost:3000");
    });

    test("send() is a no-op when iframeRef.current is null", () => {
        const bridge = createPreviewBridge({
            iframeRef: { current: null },
            allowedOrigin: "*",
        });
        // Must not throw.
        expect(() => bridge.send("bridge:set-theme", {})).not.toThrow();
    });

    test("on() registers a handler keyed by message type", () => {
        const bridge = createPreviewBridge({
            iframeRef: { current: mockIframe },
            allowedOrigin: "http://localhost:3000",
        });
        const calls = [];
        bridge.on("bridge:ready", (payload) => calls.push(payload));

        // Simulate the iframe sending a message; we call the bridge's
        // dispatch directly instead of going through the window event.
        bridge._dispatch({
            origin: "http://localhost:3000",
            data: { type: "bridge:ready", payload: { x: 1 } },
        });

        expect(calls).toEqual([{ x: 1 }]);
    });

    test("on() returns an unsubscribe function", () => {
        const bridge = createPreviewBridge({
            iframeRef: { current: mockIframe },
            allowedOrigin: "*",
        });
        const calls = [];
        const off = bridge.on("bridge:ready", () => calls.push(1));

        bridge._dispatch({
            origin: "http://x",
            data: { type: "bridge:ready", payload: {} },
        });
        expect(calls).toHaveLength(1);

        off();
        bridge._dispatch({
            origin: "http://x",
            data: { type: "bridge:ready", payload: {} },
        });
        expect(calls).toHaveLength(1);
    });

    test("dispatch ignores messages from foreign origins", () => {
        const bridge = createPreviewBridge({
            iframeRef: { current: mockIframe },
            allowedOrigin: "http://localhost:3000",
        });
        const calls = [];
        bridge.on("bridge:ready", () => calls.push(1));

        bridge._dispatch({
            origin: "https://attacker.example",
            data: { type: "bridge:ready", payload: {} },
        });
        expect(calls).toEqual([]);
    });

    test('allowedOrigin: "*" disables origin check (dev-mode escape hatch)', () => {
        const bridge = createPreviewBridge({
            iframeRef: { current: mockIframe },
            allowedOrigin: "*",
        });
        const calls = [];
        bridge.on("bridge:ready", () => calls.push(1));

        bridge._dispatch({
            origin: "http://anything",
            data: { type: "bridge:ready", payload: {} },
        });
        expect(calls).toEqual([1]);
    });

    test("dispatch ignores non-bridge messages (don't intercept devtools)", () => {
        const bridge = createPreviewBridge({
            iframeRef: { current: mockIframe },
            allowedOrigin: "*",
        });
        const calls = [];
        bridge.on("bridge:ready", () => calls.push(1));

        // React DevTools, webpack HMR, MetaMask etc. all post their own
        // messages to window. We must not consume those.
        bridge._dispatch({
            origin: "http://x",
            data: { source: "react-devtools-bridge", payload: {} },
        });
        bridge._dispatch({ origin: "http://x", data: "hmr-update" });
        bridge._dispatch({ origin: "http://x", data: null });

        expect(calls).toEqual([]);
    });

    test("a throwing handler does not block later handlers", () => {
        const bridge = createPreviewBridge({
            iframeRef: { current: mockIframe },
            allowedOrigin: "*",
        });
        const calls = [];
        bridge.on("bridge:ready", () => {
            throw new Error("boom");
        });
        bridge.on("bridge:ready", () => calls.push("second"));

        // suppress the expected console.error
        const orig = console.error;
        console.error = () => {};
        try {
            bridge._dispatch({
                origin: "http://x",
                data: { type: "bridge:ready", payload: {} },
            });
        } finally {
            console.error = orig;
        }
        expect(calls).toEqual(["second"]);
    });

    test("destroy() removes the window listener and clears subscribers", () => {
        const bridge = createPreviewBridge({
            iframeRef: { current: mockIframe },
            allowedOrigin: "*",
        });
        const calls = [];
        bridge.on("bridge:ready", () => calls.push(1));

        bridge.destroy();

        bridge._dispatch({
            origin: "http://x",
            data: { type: "bridge:ready", payload: {} },
        });
        expect(calls).toEqual([]);
    });
});
