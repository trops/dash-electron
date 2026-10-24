/**
 * jitConsentText.js
 *
 * Wording for the JIT consent modal's request details. A widget's own data
 * file is named after its internal id
 * ("trops.dash-samples.NotepadWidget-….json"), which means nothing to the
 * user — say what it is instead (QA 2026-10-24). The grant still uses the
 * real filename, and the modal still shows it under the label.
 */

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Its own file only in the shape Dash names it: an optional
 * "<dashboard>-" prefix, the widget id, an optional "-<instance>" suffix,
 * ".json" — no folders, no "..". A name that merely contains the id
 * ("../x-<id>.json") isn't labelled as its own.
 */
function isOwnDataFile(filename, widgetId) {
    if (typeof widgetId !== "string" || !widgetId) return false;
    if (/[\\/]/.test(filename) || filename.includes("..")) return false;
    return new RegExp(
        `^(?:[A-Za-z0-9_-]+-)?${escapeRegExp(
            widgetId
        )}(?:-[A-Za-z0-9._-]+)?\\.json$`
    ).test(filename);
}

/**
 * @param {string} filename  the file the widget asked for
 * @param {string} widgetId  the asking widget's id (scope.package.Component)
 * @returns {{ text: string, ownFile: boolean }}
 */
function fsFileLabel(filename, widgetId) {
    if (typeof filename !== "string" || !filename) {
        return { text: "(unknown file)", ownFile: false };
    }
    return isOwnDataFile(filename, widgetId)
        ? { text: "this widget's own saved data", ownFile: true }
        : { text: filename, ownFile: false };
}

module.exports = { fsFileLabel };
