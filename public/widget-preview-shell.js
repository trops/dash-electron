/* eslint-disable no-undef */
/**
 * Widget preview iframe runtime — slice 17c.1.
 *
 * This script runs inside the preview iframe. Its job:
 *   1. Post `bridge:ready` to the parent window once the iframe has
 *      installed its message listeners. The host bridge waits for
 *      this handshake before sending bundles.
 *   2. Listen for messages from the host and (in this slice) just
 *      acknowledge them — later slices wire bundle eval, theme,
 *      providers, render stats, and error reporting.
 *
 * Kept as a plain ES5-compatible script (no imports, no JSX, no
 * build step) so the iframe can load it directly via <script src>
 * without going through webpack. This isolates the iframe's
 * dependencies from the host bundle — fewer surprises, faster
 * boot, and the iframe stays a stable contract surface.
 */
(function () {
    "use strict";

    var BRIDGE_PREFIX = "bridge:";

    function isBridgeMessage(data) {
        return (
            data !== null &&
            typeof data === "object" &&
            typeof data.type === "string" &&
            data.type.indexOf(BRIDGE_PREFIX) === 0
        );
    }

    function postToHost(type, payload) {
        try {
            // Target origin "*" is acceptable here because the iframe
            // is loaded from the same origin as the host (the parent
            // is the only frame that ever receives our messages in
            // practice). The host validates origin on its side.
            window.parent.postMessage(
                { type: type, payload: payload || {} },
                "*"
            );
        } catch (err) {
            // If the parent has closed or postMessage is blocked,
            // we have nowhere to report. Swallow: throwing here
            // would just take down the iframe's own message loop.
        }
    }

    // Detach every child of #root without touching innerHTML — the
    // hook (and good practice) discourage innerHTML on user-input
    // surfaces, even though here the input is the literal empty
    // string. Use replaceChildren which is the safe modern API.
    function clearRoot() {
        var root = document.getElementById("root");
        if (!root) return;
        if (typeof root.replaceChildren === "function") {
            root.replaceChildren();
        } else {
            while (root.firstChild) root.removeChild(root.firstChild);
        }
    }

    // Catch ANY error inside the iframe and report it to the host.
    // Slice 17c.4 fleshes this out (kind detection, stack scrubbing);
    // 17c.1 just installs the channel so we can verify it works.
    window.addEventListener("error", function (event) {
        postToHost("bridge:error", {
            kind: "uncaught",
            message: event && event.message ? event.message : "unknown error",
            stack:
                event && event.error && event.error.stack
                    ? event.error.stack
                    : null,
        });
    });
    window.addEventListener("unhandledrejection", function (event) {
        var reason = event && event.reason;
        postToHost("bridge:error", {
            kind: "unhandled-rejection",
            message:
                (reason && reason.message) ||
                (typeof reason === "string" ? reason : "unhandled rejection"),
            stack: reason && reason.stack ? reason.stack : null,
        });
    });

    // Inbound channel: the host posts messages here. For 17c.1 we
    // accept any well-shaped bridge message and act on the small
    // subset wired in this slice (just unmount). Real handlers
    // (load bundle, set theme, provider response) come in 17c.2+.
    window.addEventListener("message", function (event) {
        if (event.source !== window.parent) return;
        if (!isBridgeMessage(event.data)) return;
        if (event.data.type === "bridge:unmount") {
            clearRoot();
        }
    });

    // Handshake: tell the host this iframe is alive and listening.
    // We post AFTER the message + error listeners are installed so
    // the host can race a follow-up message into the same tick
    // without losing it.
    function announceReady() {
        postToHost("bridge:ready", {
            // Identifier the host can echo back in tests so it knows
            // it's talking to OUR shell and not a stray iframe.
            shellVersion: "17c.1",
        });
    }
    if (document.readyState === "complete") {
        announceReady();
    } else {
        window.addEventListener("load", announceReady);
    }
})();
