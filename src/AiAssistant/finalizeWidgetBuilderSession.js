/**
 * What happens when a Widget Builder session ends — shared by the builder's
 * own window (Dash.js) and the builder inside the Create screen
 * (EmbeddedWidgetBuilder), so both finish the same way.
 *
 * Also the "don't remount the dashboard" guard: a late IPC
 * `widget:installed` (or an MCP state change) would remount the stage and
 * discard unsaved layout edits, so Dash.js skips those remounts while any
 * builder is open and for 3s after one finishes.
 */

const BUILDER_CHAT_KEY = "dash-widget-builder";

let activeBuilders = 0;
let suppressUntil = 0;

/** A builder opened (true) or closed (false). */
export function markWidgetBuilderActive(active) {
    activeBuilders = Math.max(0, activeBuilders + (active ? 1 : -1));
}

/** Hold off dashboard remounts for `ms` (a builder just finished). */
export function suppressStageRemount(ms = 3000) {
    suppressUntil = Date.now() + ms;
}

/** True while a builder is open or just finished. */
export function widgetBuilderBlocksRemount() {
    return activeBuilders > 0 || Date.now() < suppressUntil;
}

/** Test hook. */
export function resetWidgetBuilderSessionState() {
    activeBuilders = 0;
    suppressUntil = 0;
}

/**
 * Before a builder mounts: clear the last session's chat (ChatCore reads it
 * only at mount) and end its Claude Code session — unless a draft is being
 * resumed, whose chat the builder restores itself.
 */
export function primeWidgetBuilderChat({ resuming = false } = {}) {
    if (!resuming) {
        try {
            localStorage.setItem(
                BUILDER_CHAT_KEY,
                JSON.stringify({ messages: [] })
            );
        } catch (_) {
            /* ignore */
        }
    }
    if (window.mainApi?.llm?.endCliSession) {
        window.mainApi.llm.endCliSession(BUILDER_CHAT_KEY);
    }
}

/**
 * Finish a session: register the installed widget's bundle, tell the widget
 * lists, and put it on the dashboard — swapped into its cell for Edit with AI
 * (a remix), placed into an empty cell for Build with AI. No install: nothing.
 *
 * @param {object} args
 * @param {{componentName, scopedName}|null} args.installed  from onInstalled:
 *        the scoped component id and the package name
 * @param {object|null} args.cellContext  { cellNumber, gridItemId, workspaceId }
 * @param {object|null} args.editContext  { originalWidgetId, … } (Edit with AI)
 * @param {(scopedName, source, regEntry, opts) => void} args.registerBundle
 */
export async function finalizeWidgetBuilderSession({
    installed,
    cellContext = null,
    editContext = null,
    registerBundle,
}) {
    if (!installed) return;
    const ctx = cellContext;
    const editCtx = editContext;

    // Register widget in renderer's ComponentManager
    try {
        const bundleResult = await window.mainApi.widgets.readBundle(
            installed.scopedName
        );
        if (bundleResult?.success && typeof registerBundle === "function") {
            // replaceExisting=true: we just installed this widget (possibly
            // a post-edit update), so the freshly-compiled bundle must
            // overwrite the stale component that may already be in
            // ComponentManager from the pre-edit state.
            registerBundle(installed.scopedName, bundleResult.source, null, {
                replaceExisting: true,
            });
        }
    } catch (regErr) {
        console.warn("[App] Widget registration:", regErr);
    }

    // Notify the widget sidebar (and anyone else listening) that the
    // installed-widget list changed. This is the event the main-process
    // `widget:installed` broadcast would normally trigger — but the ai-build
    // handler suppresses that broadcast when cellContext is set (to avoid
    // remounting the dashboard). We do it here instead so the sidebar
    // refreshes without tearing down the app shell.
    window.dispatchEvent(new Event("dash:widgets-updated"));
    window.dispatchEvent(
        new CustomEvent("dash:widget-installed", {
            detail: { widgetName: installed.scopedName },
        })
    );

    if (editCtx?.originalWidgetId && ctx?.gridItemId) {
        // REMIX mode: swap existing widget in-place
        window.dispatchEvent(
            new CustomEvent("dash:swap-widget-in-cell", {
                detail: {
                    widgetComponentName: installed.componentName,
                    widgetId: editCtx.originalWidgetId,
                    cellNumber: ctx.cellNumber,
                    gridItemId: ctx.gridItemId,
                    workspaceId: ctx.workspaceId,
                },
            })
        );
    } else if (ctx?.cellNumber && ctx?.gridItemId) {
        // NEW mode: place in empty cell
        window.dispatchEvent(
            new CustomEvent("dash:place-widget-in-cell", {
                detail: {
                    widgetComponentName: installed.componentName,
                    cellNumber: ctx.cellNumber,
                    gridItemId: ctx.gridItemId,
                    workspaceId: ctx.workspaceId,
                },
            })
        );
    }
}
