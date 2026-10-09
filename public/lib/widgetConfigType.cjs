/**
 * ensureWidgetType — add `type: "widget"` to an AI-built widget config
 * (.dash.js source) that left it out.
 *
 * The bundle loader (dash-core extractWidgetConfigs) only accepts configs
 * whose type is "widget" or "workspace". Without it the Widget Builder
 * preview failed with "Could not resolve widget component from bundle",
 * and the installed widget would not load either.
 *
 * Only the config object's own keys count — a nested `type` (a provider's,
 * a userConfig field's) is not the widget's type. Shapes we don't
 * recognise are left unchanged.
 *
 * @param {string} source - the .dash.js source
 * @returns {{ source: string, rewrote: boolean }}
 */
function ensureWidgetType(source) {
    if (!source || typeof source !== "string") {
        return { source, rewrote: false };
    }
    const open = findConfigOpenBrace(source);
    if (open === -1) return { source, rewrote: false };
    if (hasTopLevelType(source, open)) return { source, rewrote: false };
    return {
        source: `${source.slice(
            0,
            open + 1
        )}\n    type: "widget",${source.slice(open + 1)}`,
        rewrote: true,
    };
}

// Index of the `{` that opens the exported config object, or -1.
function findConfigOpenBrace(source) {
    const direct = /export\s+default\s*\{/.exec(source);
    if (direct) return direct.index + direct[0].length - 1;
    const named = /export\s+default\s+([A-Za-z_$][\w$]*)\s*;?/.exec(source);
    if (!named) return -1;
    const decl = new RegExp(
        `(?:const|let|var)\\s+${named[1]}\\s*=\\s*\\{`
    ).exec(source);
    return decl ? decl.index + decl[0].length - 1 : -1;
}

// Does the object starting at `open` have its own `type:` key?
function hasTopLevelType(source, open) {
    let depth = 0;
    let quote = null;
    for (let i = open; i < source.length; i++) {
        const ch = source[i];
        if (quote) {
            if (ch === "\\") i++;
            else if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") {
            quote = ch;
            continue;
        }
        if (ch === "{" || ch === "[" || ch === "(") depth++;
        else if (ch === "}" || ch === "]" || ch === ")") {
            depth--;
            if (depth === 0) return false;
        } else if (
            depth === 1 &&
            /[\s,{]/.test(source[i - 1] || "") &&
            /^type\s*:/.test(source.slice(i, i + 12))
        ) {
            return true;
        }
    }
    return false;
}

module.exports = { ensureWidgetType };
