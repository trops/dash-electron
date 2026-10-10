/**
 * packagePermissions — the MCP tools a widget package calls, from
 * dash-core's scanner (`@trops/dash-core/scanner`).
 *
 * Returns `{ mcp, mcpByComponent }` in the same shape the app writes to an
 * installed package's `package.json` under `dash.permissions`, or null when
 * the package calls no MCP tools. Used by:
 *   - packageZip.js — puts it in the zip's package.json, which the app's
 *     update check reads to ask for new tools before installing
 *   - publishToRegistry.js — sends `mcp` as the registry manifest's
 *     `permissions`
 *
 * Returns null (with a warning) when the installed dash-core predates the
 * scanner export.
 */
function scanPackagePermissions(packageDir) {
    let scanner;
    try {
        scanner = require("@trops/dash-core/scanner");
    } catch (e) {
        console.warn(
            `  ⚠ Permission scan skipped (dash-core scanner unavailable): ${e.message}`
        );
        return null;
    }
    const mcp = scanner.scanWidgetPackagePermissions(packageDir);
    if (!mcp || Object.keys(mcp).length === 0) return null;
    const mcpByComponent =
        scanner.scanWidgetPackagePermissionsByComponent(packageDir);
    return Object.keys(mcpByComponent || {}).length > 0
        ? { mcp, mcpByComponent }
        : { mcp };
}

module.exports = { scanPackagePermissions };
