/**
 * remixGate.js
 *
 * Remixing someone else's widget in the Widget Builder is allowed only when
 * its author allows remixes (user decisions, 2026-10-27; registry 1.9.0):
 * by default public packages may be remixed and private ones — shared or,
 * later, paid — may not. Using and configuring the widget is unaffected;
 * only building your own version of its code is stopped. Publishing is
 * checked again by dash-core and the registry.
 */

/**
 * Whether a registry package may be remixed: what its author chose, else
 * public yes / private no. Null when the package isn't known (not in the
 * registry, or the registry couldn't be asked) — the publish check decides.
 */
export function remixAllowed(pkg) {
    if (!pkg || typeof pkg !== "object") return null;
    if (typeof pkg.allowRemix === "boolean") return pkg.allowRemix;
    return pkg.visibility !== "private";
}

/** The message shown instead of the builder, or null when it may be remixed. */
export function remixBlockedText(pkg, widgetName) {
    if (remixAllowed(pkg) !== false) return null;
    const what = widgetName ? `"${widgetName}"` : "this widget";
    return `The author of ${what} doesn't allow remixes, so its code can't be edited here. You can still use it and change its settings on your dashboards.`;
}
