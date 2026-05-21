/**
 * buildAiInstallPackageJson
 *
 * Pure helper that produces the `package.json` body written by the
 * AI widget install IPC handler (`widget:ai-build` in `public/
 * electron.js`). Extracted so the manifest shape is unit-testable
 * without spinning up Electron's main process.
 *
 * Two layers:
 *   1. Always-on baseline — name / version / description / main /
 *      private. Guaranteed to exist for every AI-installed widget so
 *      dash-core's `widgetPermissions.getWidgetMcpPermissions` has a
 *      file to read. Without this baseline, widgets without MCP
 *      usage (pure-UI Counter, Notepad, etc.) have no manifest
 *      anchor at all and fall through weaker back-compat paths.
 *   2. Conditional `dash.permissions.mcp` block — added when the
 *      caller passes a non-empty MCP permissions object derived from
 *      a static scan of the AI's source. Sibling
 *      `dash.permissions.mcpByComponent` is NOT computed here; it's
 *      added post-install by dash-core's `applyScanToPackageJson`,
 *      which re-scans the full widgets/ tree (the AI handler sees
 *      only one widget at a time).
 *
 * Field-merge policy: `existingPkg` (e.g. a package.json the AI
 * itself produced via the files[] payload) wins for any baseline
 * field it provides. The MCP block always reflects the latest scan
 * — hand-authored MCP declarations from the AI are clobbered by the
 * scanner's view of the live source (the scanner IS authoritative
 * for MCP declarations; preserving stale AI guesses risks declaring
 * tools the widget doesn't actually use).
 *
 * @param {object} opts
 * @param {string} opts.widgetName - PascalCase widget name (e.g. "GmailUnreadCount")
 * @param {string} [opts.description] - Free-text description; falls back to a synthesized line
 * @param {object} [opts.existingPkg] - Any package.json the AI shipped in files[] (preserved fields)
 * @param {object} [opts.mcpPermissions] - Output of `scanWidgetMcpUsage(componentCode)` — {} when no usage
 * @returns {object} The body to JSON-stringify and write to <buildDir>/package.json
 */
function buildAiInstallPackageJson({
    widgetName,
    description,
    existingPkg,
    mcpPermissions,
} = {}) {
    const safeName =
        typeof widgetName === "string" && widgetName ? widgetName : "Widget";
    const safeExisting =
        existingPkg && typeof existingPkg === "object" ? existingPkg : {};
    const hasMcp =
        mcpPermissions &&
        typeof mcpPermissions === "object" &&
        Object.keys(mcpPermissions).length > 0;

    // Merge precedence:
    //   - Spread `safeExisting` FIRST so AI-supplied "side" fields
    //     (license, author, scripts, dependencies, …) survive.
    //   - Override the fields we own deterministically. `name` is
    //     always computed (widget identity is anchored on
    //     `@ai-built/<widgetName>`, so existing.name can't disagree
    //     without breaking the install path). `private: true` always
    //     forces — AI-built widgets are not publishable.
    //   - For `description`, caller-supplied value > existing >
    //     synthesized fallback. The caller wins because the IPC's
    //     description is the modal-confirmed value (potentially
    //     user-edited); the AI's earlier guess in files[] is stale.
    //   - For `version` and `main`, prefer the existing value when
    //     present (lets the AI ship its own `main` for a future
    //     bundle-pinning flow), else fall back to the standard
    //     defaults for AI-built widgets.
    const out = {
        ...safeExisting,
        name: `@ai-built/${safeName.toLowerCase()}`,
        version: safeExisting.version || "1.0.0",
        description:
            description ||
            safeExisting.description ||
            `AI-generated widget: ${safeName}`,
        main: safeExisting.main || "dist/index.cjs.js",
        private: true,
    };

    if (hasMcp) {
        const existingDash =
            safeExisting.dash && typeof safeExisting.dash === "object"
                ? safeExisting.dash
                : {};
        const existingPermissions =
            existingDash.permissions &&
            typeof existingDash.permissions === "object"
                ? existingDash.permissions
                : {};
        out.dash = {
            ...existingDash,
            permissions: {
                ...existingPermissions,
                mcp: mcpPermissions,
            },
        };
    }

    return out;
}

module.exports = { buildAiInstallPackageJson };
