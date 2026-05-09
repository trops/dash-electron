/**
 * PreviewIframe — slice 17c.1.
 *
 * Renders the iframe-isolated widget preview surface. This first
 * slice only establishes the iframe + bridge handshake; subsequent
 * slices layer bundle loading, theme/provider proxying, error
 * reporting, and render stats on top.
 *
 * Behavior:
 *   - Mounts an <iframe src="/widget-preview-host.html">.
 *   - Spins up a previewBridge tied to that iframe.
 *   - On `bridge:ready`, transitions internal state from "loading"
 *     to "ready" and exposes that via the optional `onReady` prop
 *     so the parent can drive its own UI off of it.
 *   - On `bridge:error`, surfaces the error message via the
 *     optional `onError` prop. (17c.4 will wire this into the
 *     existing modal previewError UI; 17c.1 just routes it.)
 *   - Tears down the bridge cleanly on unmount.
 *
 * Behind a feature flag in WidgetBuilderModal.js so the existing
 * inline preview path stays as the default until 17c.6 flips it.
 */
import React, { useEffect, useRef, useState } from "react";
import { createPreviewBridge } from "./previewBridge";

const HOST_PATH = "/widget-preview-host.html";

export function PreviewIframe({ onReady, onError, className, style }) {
    const iframeRef = useRef(null);
    const bridgeRef = useRef(null);
    const [status, setStatus] = useState("loading");

    useEffect(() => {
        // The iframe loads from the same origin as the host page in
        // dev (webpack-dev-server) and in the packaged app
        // (file:// or app://). Pinning to `window.location.origin`
        // works for both. "*" only used if origin is somehow empty.
        const allowedOrigin = window.location.origin || "*";

        const bridge = createPreviewBridge({ iframeRef, allowedOrigin });
        bridgeRef.current = bridge;

        const offReady = bridge.on("bridge:ready", (payload) => {
            setStatus("ready");
            if (typeof onReady === "function") {
                onReady(payload);
            }
        });

        const offError = bridge.on("bridge:error", (payload) => {
            if (typeof onError === "function") {
                onError(payload);
            }
        });

        return () => {
            offReady();
            offError();
            bridge.destroy();
            bridgeRef.current = null;
        };
        // We deliberately re-run this effect only when the
        // identity of the callback changes; in practice the parent
        // memoizes them.
    }, [onReady, onError]);

    return (
        <iframe
            ref={iframeRef}
            src={HOST_PATH}
            title="Widget Preview"
            // sandbox: allow scripts (we're loading a script element
            // ourselves), allow same-origin (we're hosted from the
            // same origin so postMessage origin checks pass), forms
            // (some widgets render forms). NO popups, NO top-nav,
            // NO downloads — anything the widget might attempt that
            // could escape its sandbox is blocked at the platform
            // level.
            sandbox="allow-scripts allow-same-origin allow-forms"
            data-preview-status={status}
            className={className}
            style={{
                width: "100%",
                height: "100%",
                border: "0",
                display: "block",
                background: "transparent",
                ...(style || {}),
            }}
        />
    );
}
