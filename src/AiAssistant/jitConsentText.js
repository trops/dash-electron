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

// A widget config without its own name gets this model default.
const DEFAULT_CONFIG_NAME = "My Workspace";

/** "NotepadWidget" → "Notepad Widget", "GDriveFileList" → "G Drive File List". */
function splitWords(name) {
    return String(name || "")
        .replace(/[-_]+/g, " ")
        .replace(/([a-z])([A-Z0-9])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .trim();
}

/**
 * The widget as people see it in the prompt's heading ("Notepad wants to
 * read a file"), not its code name (NotepadWidget): its default title, else
 * its own name when that isn't the code name, else the code name split into
 * words without a trailing "Widget".
 *
 * @param {string} widgetId  scope.package.Component
 * @param {object|null} config  the widget's config, when Dash has it
 * @returns {string}
 */
function widgetDisplayName(widgetId, config) {
    if (typeof widgetId !== "string" || !widgetId) return "This widget";
    const tail = widgetId.slice(widgetId.lastIndexOf(".") + 1);
    const title =
        config &&
        config.userConfig &&
        config.userConfig.title &&
        config.userConfig.title.defaultValue;
    if (typeof title === "string" && title.trim()) return title.trim();
    for (const n of [config && config.displayName, config && config.name]) {
        if (
            typeof n === "string" &&
            n.trim() &&
            n !== tail &&
            n !== DEFAULT_CONFIG_NAME
        ) {
            return n.trim();
        }
    }
    const words = splitWords(tail);
    return words.replace(/^(.+\S)\s+Widget$/, "$1") || tail;
}

/**
 * A file name as pieces to wrap between: after each "." and "-", so a long
 * name breaks there, not mid-word.
 *
 * @param {string} name
 * @returns {string[]}
 */
function fileNameParts(name) {
    return String(name || "").split(/(?<=[.\-_])/);
}

module.exports = { fsFileLabel, widgetDisplayName, fileNameParts };
