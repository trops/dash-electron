/**
 * PreviewIframe — slices 17c.1 + 17c.2.
 *
 * Mounts an iframe-isolated preview surface and drives it from the
 * host React tree. The iframe loads a separate React tree and DOM
 * so AI-generated widget code is kernel-isolated from the host:
 * render errors, event-handler errors, async rejections, CSS
 * leaks, globals — all stay inside the iframe.
 *
 * 17c.1 added the iframe + handshake.
 * 17c.2 adds the bundle pipeline: when `bundleSource` and
 *       `componentName` are provided, the host writes its module
 *       references onto the iframe's window via cross-window
 *       same-origin access (because module references can't
 *       traverse postMessage), then sends `bridge:load-bundle`.
 *       The shell evaluates the bundle, mounts the resolved
 *       component, and posts `bridge:mounted`.
 *
 * Subsequent slices add: theme + provider proxying (17c.3),
 * structured error reporting routed into the modal's existing
 * banner UI (17c.4), and render-stats for the empty-render
 * detector (17c.5).
 */
import React, {
    useEffect,
    useRef,
    useState,
    useMemo,
    useCallback,
} from "react";
import * as ReactRuntime from "react";
import * as ReactDOMClient from "react-dom/client";
import * as DashReact from "@trops/dash-react";
import * as DashCore from "@trops/dash-core";
import * as JsxRuntime from "react/jsx-runtime";
import { createPreviewBridge } from "./previewBridge";

const HOST_PATH = "/widget-preview-host.html";

// Module references the iframe shell needs to satisfy the bundle's
// `require("react")` / `require("@trops/dash-react")` calls. Built
// once and reused — these are stable singletons in the host bundle.
//
// CJS interop note: the bundle is CJS, so it expects the modules
// returned by require() to expose their named exports as
// own-properties. The host-side widgetBundleLoader (in dash-core)
// flattens .default onto the namespace; the shell does the same
// inside the iframe's require shim.
function buildDefaultHostModules() {
    return {
        react: ReactRuntime,
        "react-dom/client": ReactDOMClient,
        "@trops/dash-react": DashReact,
        "@trops/dash-core": DashCore,
        "react/jsx-runtime": JsxRuntime,
    };
}

export function PreviewIframe({
    bundleSource,
    componentName,
    props,
    hostModules,
    onReady,
    onMounted,
    onError,
    className,
    style,
}) {
    const iframeRef = useRef(null);
    const bridgeRef = useRef(null);
    const readyRef = useRef(false);
    const [status, setStatus] = useState("loading");

    // Memoize the modules map so we don't re-write window.__hostModules
    // on every parent render. The map is passed into the iframe by
    // direct property assignment (not postMessage) because module
    // references aren't serializable.
    const resolvedHostModules = useMemo(
        () => hostModules || buildDefaultHostModules(),
        [hostModules]
    );

    const writeHostModules = useCallback(() => {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        // Same-origin assignment is allowed because the iframe is
        // hosted from the same origin as the host page (verified
        // by the bridge's allowedOrigin check on the receive side).
        win.__hostModules = resolvedHostModules;
    }, [resolvedHostModules]);

    // Set up the bridge once. Runs on mount; teardown on unmount.
    useEffect(() => {
        const allowedOrigin = window.location.origin || "*";
        const bridge = createPreviewBridge({ iframeRef, allowedOrigin });
        bridgeRef.current = bridge;

        const offReady = bridge.on("bridge:ready", (payload) => {
            readyRef.current = true;
            writeHostModules();
            setStatus("ready");
            if (typeof onReady === "function") onReady(payload);
        });

        const offMounted = bridge.on("bridge:mounted", (payload) => {
            setStatus("mounted");
            if (typeof onMounted === "function") onMounted(payload);
        });

        const offError = bridge.on("bridge:error", (payload) => {
            if (typeof onError === "function") onError(payload);
        });

        return () => {
            offReady();
            offMounted();
            offError();
            bridge.destroy();
            bridgeRef.current = null;
            readyRef.current = false;
        };
    }, [onReady, onMounted, onError, writeHostModules]);

    // Send bridge:load-bundle when the bundle source / component
    // name change AND the iframe handshake has completed.
    useEffect(() => {
        if (!bundleSource || !componentName) return;
        if (!readyRef.current) return;
        // Refresh the host modules map before each load — guards
        // against the iframe reloading mid-session and clearing
        // window.__hostModules.
        writeHostModules();
        bridgeRef.current?.send("bridge:load-bundle", {
            bundleSource,
            componentName,
        });
        // We deliberately re-run this effect when the iframe goes
        // from not-ready to ready (status flip from "loading" →
        // "ready") so a bundle posted before handshake also fires
        // once handshake completes.
    }, [bundleSource, componentName, status, writeHostModules]);

    // Send bridge:set-props when props change AND a component is
    // currently mounted.
    useEffect(() => {
        if (status !== "mounted" && status !== "ready") return;
        if (!bridgeRef.current) return;
        bridgeRef.current.send("bridge:set-props", { props: props || {} });
    }, [props, status]);

    return (
        <iframe
            ref={iframeRef}
            src={HOST_PATH}
            title="Widget Preview"
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
