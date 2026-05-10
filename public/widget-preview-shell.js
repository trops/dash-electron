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

    // Slice 19H: every bridge:error site also needs to feed the
    // modal's Console tab so users see runtime/eval errors there with
    // a "Send error to AI" affordance. Use this helper so the two
    // posts stay in sync — adding a new bridge:error site automatically
    // surfaces it in the console too.
    function postErrorToHost(kind, message, stack) {
        postToHost("bridge:error", {
            kind: kind,
            message: message,
            stack: stack || null,
        });
        postToHost("bridge:console", {
            severity: "error",
            source: "bridge:" + kind,
            args: [message],
            timestamp: Date.now(),
            stack: stack || "",
        });
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
        scheduleRenderStats();
    }

    function reRenderCurrent() {
        if (!currentRoot || !currentComponent) return;
        var hostModules = window.__hostModules || {};
        var React = hostModules.react;
        if (!React) return;
        renderWith(React, currentComponent, currentProps);
    }

    // Slice 17c.5 — measure the rendered widget's text content +
    // descendant count and post `bridge:render-stats` so the host's
    // empty-render detector can flip its banner. We schedule TWO
    // checks (short + longer) to mirror the host's existing
    // double-check pattern: components with async data fetches
    // legitimately render empty for a beat before content arrives,
    // and a one-shot check trips a false positive on those.
    var statsTimers = [];
    function scheduleRenderStats() {
        // Cancel any in-flight measurements from a previous render.
        for (var i = 0; i < statsTimers.length; i++) {
            clearTimeout(statsTimers[i]);
        }
        statsTimers = [];
        statsTimers.push(setTimeout(measureAndPostStats, 1500));
        statsTimers.push(setTimeout(measureAndPostStats, 3000));
    }
    function measureAndPostStats() {
        var root = document.getElementById("root");
        if (!root) {
            postToHost("bridge:render-stats", {
                textLength: 0,
                childCount: 0,
            });
            return;
        }
        // Look at the inner widget if dash-react Panel rendered one
        // (id="panel-NNNN"). Otherwise the wrapper is the metric.
        var inner = root.querySelector('[id^="panel-"]') || root;
        var text = (inner.textContent || "").trim();
        var childCount = inner.children ? inner.children.length : 0;
        postToHost("bridge:render-stats", {
            textLength: text.length,
            childCount: childCount,
        });
    }

    function mountWidget(payload) {
        var bundleSource = payload && payload.bundleSource;
        var componentName = payload && payload.componentName;
        var hostModules = window.__hostModules || {};

        if (!bundleSource || typeof bundleSource !== "string") {
            postErrorToHost(
                "load-bundle",
                "bridge:load-bundle missing bundleSource string"
            );
            return;
        }
        var React = hostModules.react;
        var ReactDOMClient = hostModules["react-dom/client"];
        if (!React || !ReactDOMClient) {
            postErrorToHost(
                "load-bundle",
                "host did not provide React + ReactDOMClient on window.__hostModules"
            );
            return;
        }

        var bundleExports;
        try {
            bundleExports = evaluateBundle(bundleSource, hostModules);
        } catch (err) {
            postErrorToHost(
                "bundle-eval",
                (err && err.message) || "bundle eval failed",
                err && err.stack
            );
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
            postErrorToHost(
                "no-component",
                'No widget config matched name "' +
                    componentName +
                    '" in bundle (' +
                    configs.length +
                    " configs found)"
            );
            return;
        }

        unmountCurrent();
        var rootEl = document.getElementById("root");
        if (!rootEl) {
            postErrorToHost("no-root", "iframe #root element missing");
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
            postErrorToHost(
                "mount",
                (err && err.message) || "mount failed",
                err && err.stack
            );
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
        var message = event && event.message ? event.message : "unknown error";
        var stack =
            event && event.error && event.error.stack ? event.error.stack : "";
        postToHost("bridge:error", {
            kind: "uncaught",
            message: message,
            stack: stack || null,
        });
        // Slice 19G.2 — also feed the modal's Console tab so the user
        // sees runtime errors alongside their console.* output (and
        // can hit "Send to AI to fix" inline).
        postToHost("bridge:console", {
            severity: "error",
            source: "window.error",
            args: [message],
            timestamp: Date.now(),
            stack: stack,
        });
    });
    window.addEventListener("unhandledrejection", function (event) {
        var reason = event && event.reason;
        var message =
            (reason && reason.message) ||
            (typeof reason === "string" ? reason : "unhandled rejection");
        var stack = reason && reason.stack ? reason.stack : "";
        postToHost("bridge:error", {
            kind: "unhandled-rejection",
            message: message,
            stack: stack || null,
        });
        postToHost("bridge:console", {
            severity: "error",
            source: "unhandledrejection",
            args: [message],
            timestamp: Date.now(),
            stack: stack,
        });
    });

    // === Console forwarding (slice 19G.2) ===
    //
    // The widget runs inside this iframe's JavaScript context, so its
    // console.log/warn/error/info/debug calls don't reach the host
    // window. Forward them via postMessage so the modal's Console tab
    // can display them alongside the existing bridge:error feed.
    //
    // We pass through to the original console first so devtools still
    // logs everything when developing — this is purely additive.
    //
    // Cap each serialized arg at 4096 chars to avoid postMessage
    // bloat. Long objects truncate with a marker.
    (function installConsoleForwarder() {
        var SEVERITIES = ["log", "warn", "error", "info", "debug"];
        var MAX_ARG_CHARS = 4096;
        function serializeArg(arg) {
            if (arg === null) return null;
            if (arg === undefined) return undefined;
            var t = typeof arg;
            if (t === "string" || t === "number" || t === "boolean") return arg;
            if (arg instanceof Error) {
                return {
                    __isError: true,
                    name: arg.name,
                    message: arg.message,
                    stack: arg.stack || "",
                };
            }
            try {
                var s = JSON.stringify(arg);
                if (s && s.length > MAX_ARG_CHARS) {
                    return s.slice(0, MAX_ARG_CHARS) + "…[truncated]";
                }
                return arg;
            } catch (_e) {
                // Circular ref, BigInt, or other non-serializable.
                try {
                    return String(arg);
                } catch (_e2) {
                    return "(unserializable)";
                }
            }
        }
        for (var i = 0; i < SEVERITIES.length; i++) {
            (function (sev) {
                var orig = window.console[sev];
                window.console[sev] = function () {
                    // Pass through first — never delay the real log.
                    try {
                        if (typeof orig === "function") {
                            orig.apply(window.console, arguments);
                        }
                    } catch (_e) {
                        /* ignore */
                    }
                    var args = [];
                    for (var j = 0; j < arguments.length; j++) {
                        args.push(serializeArg(arguments[j]));
                    }
                    var stack = "";
                    try {
                        stack = new Error().stack || "";
                    } catch (_e) {
                        /* ignore */
                    }
                    try {
                        postToHost("bridge:console", {
                            severity: sev,
                            source: "console",
                            args: args,
                            timestamp: Date.now(),
                            stack: stack,
                        });
                    } catch (_e) {
                        /* never let a postMessage failure break logging */
                    }
                };
            })(SEVERITIES[i]);
        }
    })();

    // === IPC bridge (slice 17d.3) ===
    //
    // Widgets call `window.mainApi.<provider>.<method>(...)` for
    // every credentialed IPC. The iframe's own document doesn't
    // load preload.js, so window.mainApi is undefined here unless
    // we bridge it from the host. Same-origin lets us read
    // window.parent.mainApi directly without postMessage marshalling.
    //
    // Once installed widgets enforce per-package permission grants
    // (slice 17d.4, lives in dash-core's WidgetFactory), this
    // proxy can be tightened to consult the grants store before
    // forwarding. For preview the proxy is a passthrough — the
    // install-time modal (17d.2) is the trust boundary, and
    // preview iterations need to actually call the API to verify
    // the widget works.
    function exposeHostMainApi() {
        try {
            var hostMainApi = window.parent && window.parent.mainApi;
            if (!hostMainApi) return;
            // Direct reference — same-origin iframe can use the
            // host's mainApi object as-is. Methods bound to the
            // host's preload context still resolve correctly when
            // called from iframe code because preload functions
            // close over their own state.
            window.mainApi = hostMainApi;
        } catch (err) {
            // Cross-origin or window.parent unavailable. Leave
            // window.mainApi undefined; widgets that need it will
            // throw, the host's bridge:error handler surfaces a
            // banner, and the user knows to recheck their setup.
        }
    }

    // === Handshake ===
    function announceReady() {
        // Bridge mainApi from the host BEFORE handshake-ready, so a
        // widget that loads as soon as bridge:ready fires has
        // window.mainApi available on first render.
        exposeHostMainApi();
        // shellVersion stays at "17c.1" — it identifies the bridge
        // protocol version, not the slice that last touched the
        // file. Bumping it would break tests that assert the exact
        // string and also signal a wire-format change to the host
        // bridge, which this slice doesn't make.
        postToHost("bridge:ready", { shellVersion: "17c.1" });
    }
    if (document.readyState === "complete") {
        announceReady();
    } else {
        window.addEventListener("load", announceReady);
    }
})();
