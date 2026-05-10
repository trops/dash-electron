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
 *
 * Implementation note: a naive `type\s*:\s*["']...["']/g` regex over the
 * whole array body would also match field-type entries nested in
 * `credentialSchema` (`appId: { type: "text" }`,
 * `apiKey: { type: "password" }`) — making one provider with a
 * 2-field credentialSchema look like three provider declarations
 * (Algolia, Text, Password) in the picker. To avoid that we walk the
 * array body brace-counting to slice out each top-level `{...}`
 * entry, then strip nested `{...}` blocks from the entry before
 * matching `type:` and `providerClass:`. That way only top-level keys
 * of each provider entry are captured.
 */
export function extractProviderDeclarations(configCode) {
    const providers = [];
    if (!configCode || typeof configCode !== "string") return providers;
    const providerMatch = configCode.match(/providers\s*:\s*\[([\s\S]*?)\]/);
    if (!providerMatch) return providers;

    // Walk the providers-array body, brace-counting to extract each
    // top-level `{...}` entry verbatim.
    const body = providerMatch[1];
    const entries = [];
    let depth = 0;
    let entryStart = -1;
    for (let i = 0; i < body.length; i++) {
        const ch = body[i];
        if (ch === "{") {
            if (depth === 0) entryStart = i;
            depth++;
        } else if (ch === "}") {
            depth--;
            if (depth === 0 && entryStart !== -1) {
                entries.push(body.slice(entryStart + 1, i));
                entryStart = -1;
            }
        }
    }

    for (const entry of entries) {
        // Collapse nested `{...}` blocks (deepest first) so that
        // `type:` keys inside credentialSchema field entries are
        // erased before the regex match. Iterate until no more
        // innermost braces remain — handles arbitrary nesting depth
        // (e.g. credentialSchema → fieldEntry → nested validator).
        let stripped = entry;
        let prev;
        do {
            prev = stripped;
            stripped = stripped.replace(/\{[^{}]*\}/g, "");
        } while (stripped !== prev);

        const typeMatch = stripped.match(/type\s*:\s*["']([^"']+)["']/);
        const classMatch = stripped.match(
            /providerClass\s*:\s*["']([^"']+)["']/
        );
        if (typeMatch) {
            providers.push({
                type: typeMatch[1],
                providerClass: classMatch ? classMatch[1] : "credential",
            });
        }
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
