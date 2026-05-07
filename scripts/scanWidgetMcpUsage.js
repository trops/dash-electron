/**
 * scanWidgetMcpUsage
 *
 * Static scanner over an AI-generated widget's source code. Emits the
 * `dash.permissions.mcp` block that the runtime gate's
 * `parseManifestPermissions` reads. Used by the AI build IPC handler to
 * pre-declare permissions so the user is asked once at install time
 * instead of dripping JIT prompts every time a new tool is called.
 *
 * Strategy: regex extraction of `useMcpProvider("type")` and
 * `callTool("name", ...)` patterns. Conservative — when a widget
 * declares multiple providers we list all detected tools under each
 * (the runtime gate still denies anything not actually granted, so
 * over-declaration just costs the user one consent decision they may
 * not need rather than enabling unintended access).
 *
 * Limitations (acceptable, documented):
 *   - Single-file scan. Sibling files in multi-file widgets aren't
 *     scanned in v1.
 *   - Variable-indirected calls like `callTool(toolName, ...)` are
 *     skipped — we can't know the value statically.
 *   - Comments are stripped before scanning so commented-out examples
 *     don't pollute the declaration.
 */

function _stripLineComments(code) {
    // Conservative: only strip `// ...` line comments. Doesn't try to
    // be string-aware; a `//` inside a string literal would be
    // mistaken for a comment, but for AI-generated widget code that's
    // a vanishingly rare false positive (and even then it'd just
    // truncate the string in our parsing copy, not in the real file).
    return code.replace(/\/\/[^\n]*/g, "");
}

function _captureAll(code, pattern) {
    const out = [];
    for (const match of code.matchAll(pattern)) {
        out.push(match[1]);
    }
    return out;
}

function scanWidgetMcpUsage(componentCode) {
    if (typeof componentCode !== "string" || !componentCode) return {};

    const stripped = _stripLineComments(componentCode);

    // useMcpProvider("type") — quote variant agnostic.
    const providerPattern = /useMcpProvider\s*\(\s*["'`]([^"'`]+)["'`]/g;
    const providers = Array.from(
        new Set(_captureAll(stripped, providerPattern))
    );

    if (providers.length === 0) return {};

    // callTool("name", ...) — only matches when the first arg is a
    // string literal. Variable indirection like `callTool(tool, ...)`
    // doesn't match and is intentionally skipped.
    const callPattern = /callTool\s*\(\s*["'`]([^"'`]+)["'`]/g;
    const tools = Array.from(new Set(_captureAll(stripped, callPattern)));

    if (tools.length === 0) return {};

    // Multi-provider widgets: declare all tools under each provider.
    // The runtime gate's per-server allowlist still bounds what's
    // actually allowed — over-declaration just gives the user one more
    // consent decision rather than expanding access.
    const out = {};
    for (const provider of providers) {
        out[provider] = { tools: [...tools] };
    }
    return out;
}

module.exports = { scanWidgetMcpUsage };
