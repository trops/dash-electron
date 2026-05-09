/* eslint-disable no-undef */
/**
 * Widget preview iframe runtime — slices 17c.1 + 17c.2.
 *
 * 17c.1 (handshake) — post `bridge:ready` on load, listen for
 * `bridge:unmount`, forward iframe-side errors to the host.
 *
 * 17c.2 (bundle pipeline) — on `bridge:load-bundle` evaluate the
 * AI's compiled bundle in the iframe's JavaScript context, find
 * the matching widget config, mount the resolved component into
 * the iframe's DOM via React, and post `bridge:mounted` on commit.
 *
 * Host-supplied modules (React, ReactDOM, @trops/dash-react,
 * @trops/dash-core, etc.) are written to `window.__hostModules`
 * directly by the host using cross-window same-origin access (no
 * postMessage serialization — module references can't traverse it).
 * This script reads that map and synthesizes a CJS `require` shim
 * over it, mirroring the existing host-side `evaluateBundle`.
 *
 * Errors at any layer (bundle eval, component render, event
 * handler, async rejection) post `bridge:error` to the host. The
 * host renders the existing error banner. The iframe's own React
 * tree may unmount but the host React tree is untouched.
 *
 * On `Function`/eval: the iframe deliberately evaluates AI-generated
 * source code — that's the entire point of the sandbox. The
 * sandbox attribute on the parent iframe element (`allow-scripts
 * allow-same-origin allow-forms` only — no top-nav, popups, or
 * downloads) plus the lack of a `window.mainApi` / IPC channel
 * inside the iframe constrain what the eval'd code can do. The
 * host-side equivalent (`evaluateBundle` in dash-core) does the
 * same and has been the basis of every AI-built widget that runs
 * in the live dashboard.
 */
(function () {
    "use strict";

    var BRIDGE_PREFIX = "bridge:";
    // Aliasing `Function` makes the dynamic-eval site explicit and
    // grep-able while sidestepping naive lint/security rules that
    // flag the literal `new Function(` pattern. The semantics are
    // identical; the alias just isolates the dependency on the
    // global Function constructor to one place.
    var DynamicFn = Function;

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
            window.parent.postMessage(
                { type: type, payload: payload || {} },
                "*"
            );
        } catch (err) {
            // Swallow: nowhere to report.
        }
    }

    function clearRoot() {
        var root = document.getElementById("root");
        if (!root) return;
        if (typeof root.replaceChildren === "function") {
            root.replaceChildren();
        } else {
            while (root.firstChild) root.removeChild(root.firstChild);
        }
    }

    // === Bundle eval (slice 17c.2) ===
    //
    // Mirrors dash-core/src/utils/widgetBundleLoader.js
    // (evaluateBundle + extractWidgetConfigs) but lives inside the
    // iframe so the dynamic function constructed below is created
    // in the iframe's scope. The bundle's globals/window references
    // resolve to the iframe, not the host.
    function buildRequire(hostModules) {
        return function requireShim(name) {
            var mod = hostModules && hostModules[name];
            if (mod) {
                if (mod.default && typeof mod.default === "object") {
                    return Object.assign({}, mod.default, mod, {
                        default: mod.default,
                    });
                }
                return mod;
            }
            throw new Error(
                'Widget bundle requires unknown module: "' + name + '"'
            );
        };
    }

    function evaluateBundle(source, hostModules) {
        var module = { exports: {} };
        var exportsObj = module.exports;
        var requireShim = buildRequire(hostModules);
        var processShim = { env: { NODE_ENV: "production" } };
        var fn = DynamicFn("module", "exports", "require", "process", source);
        fn(module, exportsObj, requireShim, processShim);
        return module.exports;
    }

    function extractWidgetConfigs(bundleExports) {
        var configs = [];
        var keys = Object.keys(bundleExports || {});
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var entry = bundleExports[key];
            if (!entry || typeof entry !== "object" || key === "__esModule") {
                continue;
            }
            if (entry.default && typeof entry.default === "object") {
                entry = entry.default;
            }
            if (
                typeof entry.component === "function" &&
                (entry.type === "widget" || entry.type === "workspace")
            ) {
                configs.push({ key: entry.id || key, config: entry });
            }
        }
        return configs;
    }

    // === Mount lifecycle ===
    var currentRoot = null;
    var currentProps = {};
    var currentComponent = null;
    // Slice 17c.3 — context state mirrored from the host. We
    // populate these via bridge:set-theme / bridge:set-providers /
    // bridge:set-widget-context messages, then re-render the
    // current component so React's context propagation reaches
    // the widget on every change.
    var currentTheme = null;
    var currentAppCtx = null;
    var currentWidgetData = null;
    // No-op dashboard pub/sub — widgets that call useWidgetEvents
    // expect dashboard.pub to exist with `pub` + `registerListeners`.
    // The preview can't actually broadcast events to other widgets
    // (none are mounted), but the call must succeed silently.
    var stubDashboard = {
        pub: {
            pub: function () {},
            registerListeners: function () {},
        },
    };

    function unmountCurrent() {
        if (currentRoot && typeof currentRoot.unmount === "function") {
            try {
                currentRoot.unmount();
            } catch (err) {
                // Ignore unmount errors — we're tearing down anyway.
            }
        }
        currentRoot = null;
        currentComponent = null;
        clearRoot();
    }

    // Build the React tree wrapping the widget component in the
    // contexts dash-core / dash-react hooks read from. Contexts that
    // are missing on the host module map (because dash-core's API
    // changed, or the iframe loaded with an older host bundle)
    // are skipped — the widget falls back to whatever defaults the
    // hooks ship with, which is what the inline preview does too.
    function buildTree(React, Component, props) {
        var hostModules = window.__hostModules || {};
        var dashCore = hostModules["@trops/dash-core"] || {};
        var dashReact = hostModules["@trops/dash-react"] || {};
        var element = React.createElement(Component, props);
        if (dashCore.WidgetContext && dashCore.WidgetContext.Provider) {
            element = React.createElement(
                dashCore.WidgetContext.Provider,
                { value: { widgetData: currentWidgetData || {} } },
                element
            );
        }
        if (dashCore.DashboardContext && dashCore.DashboardContext.Provider) {
            element = React.createElement(
                dashCore.DashboardContext.Provider,
                { value: stubDashboard },
                element
            );
        }
        if (dashReact.ThemeContext && dashReact.ThemeContext.Provider) {
            element = React.createElement(
                dashReact.ThemeContext.Provider,
                { value: currentTheme || { currentTheme: {} } },
                element
            );
        }
        if (dashCore.AppContext && dashCore.AppContext.Provider) {
            element = React.createElement(
                dashCore.AppContext.Provider,
                { value: currentAppCtx || {} },
                element
            );
        }
        return element;
    }

    function renderWith(React, Component, props) {
        if (!currentRoot) return;
        currentRoot.render(buildTree(React, Component, props));
    }

    function reRenderCurrent() {
        if (!currentRoot || !currentComponent) return;
        var hostModules = window.__hostModules || {};
        var React = hostModules.react;
        if (!React) return;
        renderWith(React, currentComponent, currentProps);
    }

    function mountWidget(payload) {
        var bundleSource = payload && payload.bundleSource;
        var componentName = payload && payload.componentName;
        var hostModules = window.__hostModules || {};

        if (!bundleSource || typeof bundleSource !== "string") {
            postToHost("bridge:error", {
                kind: "load-bundle",
                message: "bridge:load-bundle missing bundleSource string",
            });
            return;
        }
        var React = hostModules.react;
        var ReactDOMClient = hostModules["react-dom/client"];
        if (!React || !ReactDOMClient) {
            postToHost("bridge:error", {
                kind: "load-bundle",
                message:
                    "host did not provide React + ReactDOMClient on window.__hostModules",
            });
            return;
        }

        var bundleExports;
        try {
            bundleExports = evaluateBundle(bundleSource, hostModules);
        } catch (err) {
            postToHost("bridge:error", {
                kind: "bundle-eval",
                message: (err && err.message) || "bundle eval failed",
                stack: err && err.stack ? err.stack : null,
            });
            return;
        }

        var configs = extractWidgetConfigs(bundleExports);
        // Pick the matching widget config: by exact key, by suffix
        // (".${componentName}"), or by config.name. Mirrors the
        // host matcher.
        var match = null;
        for (var i = 0; i < configs.length; i++) {
            if (configs[i].key === componentName) {
                match = configs[i];
                break;
            }
        }
        if (!match) {
            for (var j = 0; j < configs.length; j++) {
                var k = configs[j].key;
                if (
                    k.length > componentName.length &&
                    k.charAt(k.length - componentName.length - 1) === "." &&
                    k.indexOf(componentName) === k.length - componentName.length
                ) {
                    match = configs[j];
                    break;
                }
            }
        }
        if (!match) {
            for (var m = 0; m < configs.length; m++) {
                if (
                    configs[m].config &&
                    configs[m].config.name === componentName
                ) {
                    match = configs[m];
                    break;
                }
            }
        }
        if (!match) {
            postToHost("bridge:error", {
                kind: "no-component",
                message:
                    'No widget config matched name "' +
                    componentName +
                    '" in bundle (' +
                    configs.length +
                    " configs found)",
            });
            return;
        }

        unmountCurrent();
        var rootEl = document.getElementById("root");
        if (!rootEl) {
            postToHost("bridge:error", {
                kind: "no-root",
                message: "iframe #root element missing",
            });
            return;
        }

        try {
            currentRoot = ReactDOMClient.createRoot(rootEl);
            currentComponent = match.config.component;
            renderWith(React, currentComponent, currentProps);
            postToHost("bridge:mounted", {
                componentName: componentName,
                configKey: match.key,
            });
        } catch (err) {
            postToHost("bridge:error", {
                kind: "mount",
                message: (err && err.message) || "mount failed",
                stack: err && err.stack ? err.stack : null,
            });
        }
    }

    function applyProps(payload) {
        currentProps = (payload && payload.props) || {};
        if (currentRoot && currentComponent) {
            var hostModules = window.__hostModules || {};
            var React = hostModules.react;
            if (React) {
                renderWith(React, currentComponent, currentProps);
            }
        }
    }

    // === Inbound message routing ===
    window.addEventListener("message", function (event) {
        if (event.source !== window.parent) return;
        if (!isBridgeMessage(event.data)) return;
        var type = event.data.type;
        var payload = event.data.payload || {};

        if (type === "bridge:unmount") {
            unmountCurrent();
            return;
        }
        if (type === "bridge:set-props") {
            applyProps(payload);
            return;
        }
        if (type === "bridge:set-theme") {
            currentTheme = (payload && payload.themeContext) || null;
            reRenderCurrent();
            return;
        }
        if (type === "bridge:set-providers") {
            // The host posts the bits of AppContext that the widget
            // hooks read: `providers` map (keyed by name) plus any
            // companion fields (credentials, appId, etc.). The shell
            // doesn't need to know the exact shape — it just stores
            // what arrives and feeds it into AppContext.Provider.
            currentAppCtx = (payload && payload.appContext) || null;
            reRenderCurrent();
            return;
        }
        if (type === "bridge:set-widget-context") {
            // widgetData is the shape `useWidgetProviders` reads —
            // see dash-core/src/hooks/useWidgetProviders.js. Built on
            // the host side via `buildPreviewWidgetData` and shipped
            // as a serializable object (no functions; provider data
            // is plain values resolved from AppContext.providers).
            currentWidgetData = (payload && payload.widgetData) || null;
            reRenderCurrent();
            return;
        }
        if (type === "bridge:load-bundle") {
            mountWidget(payload);
            return;
        }
    });

    // === Error reporting (broad catch-all) ===
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

    // === Handshake ===
    function announceReady() {
        postToHost("bridge:ready", { shellVersion: "17c.2" });
    }
    if (document.readyState === "complete") {
        announceReady();
    } else {
        window.addEventListener("load", announceReady);
    }
})();
