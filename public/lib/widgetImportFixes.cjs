/**
 * widgetImportFixes — fix the slips AI-built widget code makes most often,
 * before it's compiled, so the user never sees the build error
 * (create-entry PRD, phase 2d).
 *
 *   1. The config defines its object but never exports it:
 *        const TokyoClockConfig = { … };        (no `export default`)
 *      → adds `export default TokyoClockConfig;`
 *   2. The config imports the component the wrong way for how the
 *      component file exports it:
 *        import { TokyoClock } from "./TokyoClock";   but the component is
 *        `export default function TokyoClock` (or the reverse)
 *      → rewrites the import to match.
 *
 * Each fix applies only when it is unambiguous — one config object, an
 * import of the widget's own component file whose exports say exactly what
 * it offers. Anything else is left for the AI to fix.
 *
 * prepareWidgetConfig runs these, then ensureWidgetType (which needs the
 * default export to find the config).
 */
const { ensureWidgetType } = require("./widgetConfigType.cjs");

const IDENT = "[A-Za-z_$][\\w$]*";

/** Add `export default <name>;` for a config object nobody exported. */
function ensureConfigDefaultExport(source) {
    if (!source || typeof source !== "string") {
        return { source, rewrote: false };
    }
    if (
        /export\s+default\b/.test(source) ||
        /module\.exports\s*=/.test(source)
    ) {
        return { source, rewrote: false };
    }
    const decl = new RegExp(
        `^(?:export\\s+)?(?:const|let|var)\\s+(${IDENT})\\s*=\\s*\\{`,
        "gm"
    );
    const names = [];
    let m;
    while ((m = decl.exec(source))) names.push(m[1]);
    if (names.length !== 1) return { source, rewrote: false };
    return {
        source: `${source.replace(/\s*$/, "")}\n\nexport default ${
            names[0]
        };\n`,
        rewrote: true,
    };
}

/** What a component file exports: { hasDefault, named: Set<string> }. */
function componentExports(source) {
    const named = new Set();
    const text = String(source || "");
    const declRe = new RegExp(
        `export\\s+(?:async\\s+)?(?:function\\*?|const|let|var|class)\\s+(${IDENT})`,
        "g"
    );
    let m;
    while ((m = declRe.exec(text))) named.add(m[1]);
    const listRe = /export\s*\{([^}]*)\}/g;
    while ((m = listRe.exec(text))) {
        for (const part of m[1].split(",")) {
            const bits = part.trim().split(/\s+as\s+/);
            const exported = (bits[1] || bits[0] || "").trim();
            if (exported === "default") continue;
            if (exported) named.add(exported);
        }
    }
    const hasDefault =
        /export\s+default\b/.test(text) ||
        /export\s*\{[^}]*\bas\s+default\b[^}]*\}/.test(text);
    return { hasDefault, named };
}

/**
 * Make the config's import of the widget's own component match how the
 * component file exports it.
 */
function fixComponentImport(configSource, componentSource, componentName) {
    if (
        !configSource ||
        typeof configSource !== "string" ||
        !componentSource ||
        !componentName
    ) {
        return { source: configSource, rewrote: false };
    }
    const { hasDefault, named } = componentExports(componentSource);
    const fromSelf = `["']\\./${componentName}(?:\\.jsx?)?["']`;

    // import { X } from "./Name"  (one specifier, no alias)
    const namedImport = new RegExp(
        `import\\s*\\{\\s*(${IDENT})\\s*\\}\\s*from\\s*(${fromSelf})\\s*;?`
    );
    let m = namedImport.exec(configSource);
    if (m && !named.has(m[1]) && hasDefault) {
        return {
            source: configSource.replace(m[0], `import ${m[1]} from ${m[2]};`),
            rewrote: true,
        };
    }

    // import X from "./Name"
    const defaultImport = new RegExp(
        `import\\s+(${IDENT})\\s+from\\s*(${fromSelf})\\s*;?`
    );
    m = defaultImport.exec(configSource);
    if (m && !hasDefault && named.has(m[1])) {
        return {
            source: configSource.replace(
                m[0],
                `import { ${m[1]} } from ${m[2]};`
            ),
            rewrote: true,
        };
    }
    return { source: configSource, rewrote: false };
}

/**
 * All config fix-ups, in order. Returns the fixed source and what changed.
 *
 * @param {string} configSource           the .dash.js source
 * @param {object} [opts]
 * @param {string} [opts.componentSource] the widget component's source
 * @param {string} [opts.componentName]   the widget name (its file stem)
 * @returns {{ source: string, fixes: string[] }}
 */
function prepareWidgetConfig(configSource, opts = {}) {
    const fixes = [];
    let source = configSource;
    const exp = ensureConfigDefaultExport(source);
    if (exp.rewrote) fixes.push("added export default");
    source = exp.source;
    const imp = fixComponentImport(
        source,
        opts.componentSource,
        opts.componentName
    );
    if (imp.rewrote) fixes.push("matched the component import to its export");
    source = imp.source;
    const typed = ensureWidgetType(source);
    if (typed.rewrote) fixes.push('added type: "widget"');
    return { source: typed.source, fixes };
}

module.exports = {
    prepareWidgetConfig,
    ensureConfigDefaultExport,
    fixComponentImport,
    componentExports,
};
