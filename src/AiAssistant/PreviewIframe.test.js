/**
 * @jest-environment jsdom
 *
 * Unit tests for the PreviewIframe React component (slice 17c.1).
 *
 * Coverage strategy:
 *   - jest+jsdom doesn't actually load iframe contents, so we can't
 *     drive a real handshake here. The bridge contract itself is
 *     tested in previewBridge.test.js.
 *   - These tests cover the React shell: the iframe element renders
 *     with the correct src, sandbox, and data-preview-status; the
 *     onReady/onError callbacks fire when the bridge dispatches the
 *     corresponding messages; bridge cleanup happens on unmount.
 *   - The full real-iframe handshake is covered by an e2e Playwright
 *     spec (e2e/tests/widget-preview-iframe-handshake.spec.js).
 */
import React from "react";
import { render, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PreviewIframe } from "./PreviewIframe";

describe("PreviewIframe — render shape", () => {
    test("mounts an iframe pointed at the preview host page", () => {
        const { container } = render(<PreviewIframe />);
        const iframe = container.querySelector("iframe");
        expect(iframe).toBeInTheDocument();
        expect(iframe.getAttribute("src")).toBe("/widget-preview-host.html");
    });

    test("applies the lockdown sandbox attribute", () => {
        const { container } = render(<PreviewIframe />);
        const iframe = container.querySelector("iframe");
        const sandbox = iframe.getAttribute("sandbox") || "";
        expect(sandbox).toContain("allow-scripts");
        expect(sandbox).toContain("allow-same-origin");
        expect(sandbox).toContain("allow-forms");
        // Must NOT allow these — kernel-isolation protections.
        expect(sandbox).not.toContain("allow-top-navigation");
        expect(sandbox).not.toContain("allow-popups");
        expect(sandbox).not.toContain("allow-downloads");
    });

    test("starts in 'loading' status until handshake completes", () => {
        const { container } = render(<PreviewIframe />);
        const iframe = container.querySelector("iframe");
        expect(iframe.getAttribute("data-preview-status")).toBe("loading");
    });

    test("forwards className and style overrides", () => {
        const { container } = render(
            <PreviewIframe
                className="my-frame"
                style={{ minHeight: "400px" }}
            />
        );
        const iframe = container.querySelector("iframe");
        expect(iframe).toHaveClass("my-frame");
        // jsdom serializes inline styles; just check the override key
        // appears in the merged inline style.
        expect(iframe.getAttribute("style") || "").toContain("400px");
    });
});

describe("PreviewIframe — bridge wiring", () => {
    test("transitions to 'ready' status when bridge:ready fires", () => {
        const onReady = jest.fn();
        const { container } = render(<PreviewIframe onReady={onReady} />);
        const iframe = container.querySelector("iframe");

        // Simulate the iframe posting bridge:ready. We dispatch a
        // synthetic MessageEvent against the host window with the
        // matching origin. The bridge's window-level listener
        // routes it to subscribers.
        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    origin: window.location.origin,
                    data: {
                        type: "bridge:ready",
                        payload: { shellVersion: "17c.1" },
                    },
                })
            );
        });

        expect(iframe.getAttribute("data-preview-status")).toBe("ready");
        expect(onReady).toHaveBeenCalledWith({ shellVersion: "17c.1" });
    });

    test("forwards bridge:error payloads via onError", () => {
        const onError = jest.fn();
        render(<PreviewIframe onError={onError} />);

        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    origin: window.location.origin,
                    data: {
                        type: "bridge:error",
                        payload: {
                            kind: "uncaught",
                            message: "boom",
                        },
                    },
                })
            );
        });

        expect(onError).toHaveBeenCalledWith({
            kind: "uncaught",
            message: "boom",
        });
    });

    test("ignores messages from foreign origins", () => {
        const onReady = jest.fn();
        render(<PreviewIframe onReady={onReady} />);

        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    origin: "https://attacker.example",
                    data: { type: "bridge:ready", payload: {} },
                })
            );
        });
        expect(onReady).not.toHaveBeenCalled();
    });

    test("unmount tears down the bridge listener", () => {
        const onReady = jest.fn();
        const { unmount } = render(<PreviewIframe onReady={onReady} />);
        unmount();

        // After unmount, the bridge should no longer be listening.
        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    origin: window.location.origin,
                    data: { type: "bridge:ready", payload: {} },
                })
            );
        });
        expect(onReady).not.toHaveBeenCalled();
    });
});
