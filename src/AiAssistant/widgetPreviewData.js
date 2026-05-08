/**
 * Pure helpers for the widget-builder live preview's render context.
 * Kept in their own module so they can be unit-tested without
 * pulling in the rest of WidgetBuilderModal (and its electron / react
 * deps) through jest's transform pipeline.
 */

/**
 * Regex-extract the `providers: [{ type, providerClass }, ...]` array
 * from a widget config source string. The widget builder uses the
 * declarations to decide which provider-picker rows to render and to
 * populate the WidgetContext that `useWidgetProviders` reads from.
 *
 * Returns [] for any falsy / non-string input or when no providers
 * array is found.
 */
export function extractProviderDeclarations(configCode) {
    const providers = [];
    if (!configCode || typeof configCode !== "string") return providers;
    const providerMatch = configCode.match(/providers\s*:\s*\[([\s\S]*?)\]/);
    if (!providerMatch) return providers;
    const typeMatches = providerMatch[1].matchAll(
        /type\s*:\s*["']([^"']+)["']/g
    );
    const classMatches = providerMatch[1].matchAll(
        /providerClass\s*:\s*["']([^"']+)["']/g
    );
    const classes = [...classMatches].map((m) => m[1]);
    let i = 0;
    for (const m of typeMatches) {
        providers.push({
            type: m[1],
            providerClass: classes[i] || "credential",
        });
        i++;
    }
    return providers;
}

/**
 * Build the `widgetData` object that PreviewContextWrapper feeds to
 * WidgetContext. Two source paths for declared providers:
 *
 *   1. editContext.configCode — populated when the user is editing
 *      a widget that already exists on the dashboard (Edit-with-AI).
 *   2. previewConfigCode — the AI's most recently generated config
 *      source for a brand-new widget being built in this modal.
 *
 * editContext wins when present so a saved widget's declared
 * providers don't get overridden by whatever the AI is currently
 * suggesting in chat. In build mode editContext is null and the
 * previewConfigCode path is the only source — without it,
 * `widgetData.providers` was always empty and useWidgetProviders
 * could never resolve anything.
 *
 * `selectedProviders` merges editContext's saved selection with the
 * preview-picker selection, with the picker winning so the user can
 * try a different provider in the preview without first saving.
 */
export function buildPreviewWidgetData({
    editContext,
    previewConfigCode,
    previewProviderSelection,
}) {
    const sourceCode = editContext?.configCode || previewConfigCode || "";
    const providers = extractProviderDeclarations(sourceCode);
    const selectedProviders = {
        ...(editContext?.selectedProviders || {}),
        ...(previewProviderSelection || {}),
    };
    return {
        providers,
        selectedProviders,
        userPrefs: editContext?.userPrefs || null,
        uuidString: "preview-widget",
    };
}
