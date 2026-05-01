/**
 * widgetConsoleCapture.js
 *
 * Hooks the global console + window error events so the AI Builder can
 * surface widget-specific runtime output (logs, warnings, errors, async
 * rejections) in its Console tab.
 *
 * Filtering: we ONLY capture events whose call-stack contains a marker
 * identifying widget code — `evaluateBundle` (the dash-core entry that
 * runs the widget's compiled bundle) or `@ai-built/` (the package URL
 * baked into stack frames for AI-built widgets). Calls from elsewhere
 * in the app (the modal itself, ChatCore, dash-core framework code)
 * are NOT captured, so the Console tab stays focused on what the user
 * actually wrote.
 *
 * The original console methods are preserved — captured calls still
 * pass through to devtools so the existing dev workflow keeps working.
 *
 * Stack-based filtering is best-effort. Async callbacks that fire long
 * after `evaluateBundle` returned still keep the widget URL in the
 * stack via the source map, so most async paths work. If a stack is
 * truly stripped (some Node-internal interleaving), the call is
 * silently dropped — better than leaking framework noise into the
 * widget console.
 */

const SEVERITIES = ["log", "warn", "error", "info", "debug"];

/**
 * Internal: does the given stack string indicate a widget-scoped call?
 * Exported with an underscore so the test can exercise it directly
 * without faking real call stacks.
 */
export function _matchesWidgetScope(stack) {
    if (typeof stack !== "string" || !stack) return false;
    if (stack.indexOf("evaluateBundle") >= 0) return true;
    if (stack.indexOf("@ai-built/") >= 0) return true;
    return false;
}

function currentStack() {
    try {
        return new Error().stack || "";
    } catch {
        return "";
    }
}

function formatArgs(args) {
    // Defensive: just pass args through; the renderer handles
    // serialization. Strings stay strings; objects stay objects.
    return Array.isArray(args) ? args : [args];
}

/**
 * Install console + window.error + unhandledrejection capture. Calls
 * `onEvent({ severity, source, args, timestamp, stack })` for each
 * widget-scoped event. Returns an `uninstall()` that restores the
 * original handlers.
 */
export function installWidgetConsoleCapture(onEvent) {
    if (typeof onEvent !== "function") {
        throw new Error(
            "installWidgetConsoleCapture requires an onEvent callback"
        );
    }
    if (typeof window === "undefined") {
        // Non-browser environment (e.g. node:test). Bail with a no-op
        // uninstall so callers don't have to special-case.
        return () => {};
    }

    const originals = {};
    for (const sev of SEVERITIES) {
        originals[sev] = console[sev];
        // eslint-disable-next-line no-console
        console[sev] = (...args) => {
            const stack = currentStack();
            // Always pass through to the real console first so the
            // app's normal devtools workflow keeps working — never
            // swallow or delay.
            try {
                originals[sev](...args);
            } catch {
                /* ignore */
            }
            if (_matchesWidgetScope(stack)) {
                try {
                    onEvent({
                        severity: sev,
                        source: "console",
                        args: formatArgs(args),
                        timestamp: Date.now(),
                        stack,
                    });
                } catch {
                    /* swallow — never let a buggy onEvent break console */
                }
            }
        };
    }

    const errorHandler = (event) => {
        const stack = event?.error?.stack || "";
        if (!_matchesWidgetScope(stack)) return;
        const message = event?.error?.message || event?.message || "(error)";
        try {
            onEvent({
                severity: "error",
                source: "window.error",
                args: [message],
                timestamp: Date.now(),
                stack,
            });
        } catch {
            /* ignore */
        }
    };

    const rejectionHandler = (event) => {
        const reason = event?.reason;
        const stack = reason?.stack || "";
        if (!_matchesWidgetScope(stack)) return;
        const message =
            reason?.message ||
            (typeof reason === "string" ? reason : "(promise rejection)");
        try {
            onEvent({
                severity: "error",
                source: "unhandledrejection",
                args: [message],
                timestamp: Date.now(),
                stack,
            });
        } catch {
            /* ignore */
        }
    };

    // Capture phase so we run BEFORE other listeners — matches the
    // existing pattern in WidgetBuilderModal that suppresses
    // react-error-overlay.
    window.addEventListener("error", errorHandler, true);
    window.addEventListener("unhandledrejection", rejectionHandler, true);

    return function uninstall() {
        for (const sev of SEVERITIES) {
            // eslint-disable-next-line no-console
            console[sev] = originals[sev];
        }
        window.removeEventListener("error", errorHandler, true);
        window.removeEventListener(
            "unhandledrejection",
            rejectionHandler,
            true
        );
    };
}
