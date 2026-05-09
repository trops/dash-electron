/**
 * @jest-environment jsdom
 *
 * Unit tests for the PreviewIframe React component (slices 17c.1
 * + 17c.2).
 *
 * Coverage strategy:
 *   - jest+jsdom doesn't actually load iframe contents, so we can't
 *     drive a real handshake here. The bridge contract itself is
 *     tested in previewBridge.test.js, and the real-iframe pipeline
 *     is covered by an e2e Playwright spec
 *     (e2e/tests/widget-preview-iframe-handshake.spec.js).
 *   - These tests cover the React shell: the iframe element renders
 *     with the correct src/sandbox/data-preview-status; bridge
 *     callbacks fire when messages dispatch; cleanup happens on
 *     unmount.
 *   - We mock @trops/dash-react and @trops/dash-core to avoid
 *     pulling their ESM dist through jest's transform pipeline.
 *     The component only references these modules to populate the
 *     iframe's host-modules map, which the test doesn't exercise.
 */
// Mock the dash-* modules (ESM dist that jest can't transform);
// the component only uses these to populate the iframe's host
// modules map, which the tests don't exercise.
jest.mock("@trops/dash-react", () => ({}), { virtual: true });
jest.mock("@trops/dash-core", () => ({}), { virtual: true });

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

describe("PreviewIframe — bundle pipeline (slice 17c.2)", () => {
    function getPostedMessages(container) {
        // jsdom doesn't actually load iframe content, so
        // iframe.contentWindow.postMessage is a stub. We patch it
        // with a recorder so the test can assert the host posted
        // the right bridge messages.
        const iframe = container.querySelector("iframe");
        if (!iframe) return [];
        const win = iframe.contentWindow;
        if (!win) return [];
        // Lazily attach the recorder if it isn't already.
        if (!win.__recorded) {
            win.__recorded = [];
            win.postMessage = (msg) => win.__recorded.push(msg);
        }
        return win.__recorded;
    }

    test("does NOT post bridge:load-bundle until handshake completes", () => {
        const { container } = render(
            <PreviewIframe
                bundleSource="module.exports = {};"
                componentName="Foo"
                hostModules={{}}
            />
        );
        // No handshake yet — the post should not have happened.
        expect(getPostedMessages(container)).toEqual([]);
    });

    test("posts bridge:load-bundle once the handshake completes", () => {
        const { container } = render(
            <PreviewIframe
                bundleSource="module.exports = {};"
                componentName="Foo"
                hostModules={{}}
            />
        );

        // Pre-attach the recorder before the bridge:ready dispatch
        // so we capture the posted message.
        getPostedMessages(container);

        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    origin: window.location.origin,
                    data: { type: "bridge:ready", payload: {} },
                })
            );
        });

        const posted = getPostedMessages(container);
        const loadMsg = posted.find(
            (m) => m && m.type === "bridge:load-bundle"
        );
        expect(loadMsg).toBeTruthy();
        expect(loadMsg.payload).toEqual({
            bundleSource: "module.exports = {};",
            componentName: "Foo",
        });
    });

    test("writes hostModules onto iframe.contentWindow.__hostModules on ready", () => {
        const fakeModules = { react: { __token: "REACT" } };
        const { container } = render(
            <PreviewIframe
                bundleSource="module.exports = {};"
                componentName="Foo"
                hostModules={fakeModules}
            />
        );
        getPostedMessages(container);

        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    origin: window.location.origin,
                    data: { type: "bridge:ready", payload: {} },
                })
            );
        });

        const iframe = container.querySelector("iframe");
        expect(iframe.contentWindow.__hostModules).toBe(fakeModules);
    });

    test("transitions to 'mounted' status when bridge:mounted fires", () => {
        const onMounted = jest.fn();
        const { container } = render(<PreviewIframe onMounted={onMounted} />);

        // Handshake first.
        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    origin: window.location.origin,
                    data: { type: "bridge:ready", payload: {} },
                })
            );
        });
        // Then mount.
        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    origin: window.location.origin,
                    data: {
                        type: "bridge:mounted",
                        payload: { componentName: "Foo" },
                    },
                })
            );
        });

        const iframe = container.querySelector("iframe");
        expect(iframe.getAttribute("data-preview-status")).toBe("mounted");
        expect(onMounted).toHaveBeenCalledWith({ componentName: "Foo" });
    });

    test("posts bridge:set-props when props change after ready", () => {
        const { container, rerender } = render(
            <PreviewIframe props={{ a: 1 }} />
        );
        getPostedMessages(container);

        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    origin: window.location.origin,
                    data: { type: "bridge:ready", payload: {} },
                })
            );
        });

        rerender(<PreviewIframe props={{ a: 2 }} />);

        const posted = getPostedMessages(container);
        const propsMsgs = posted.filter(
            (m) => m && m.type === "bridge:set-props"
        );
        // At least one set-props after ready; payload reflects
        // the latest props value.
        expect(propsMsgs.length).toBeGreaterThan(0);
        expect(propsMsgs[propsMsgs.length - 1].payload).toEqual({
            props: { a: 2 },
        });
    });
});
