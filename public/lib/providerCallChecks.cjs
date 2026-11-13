/**
 * providerCallChecks.cjs
 *
 * The Checker holds a widget's provider calls to the user's live tools
 * (what each takes, from the running provider): a tool it doesn't have, a
 * required input left out, an input it doesn't take, or a file path or web
 * address written into the code — which belongs in a userConfig setting the
 * user can change. Pure: the live tools are handed in.
 */
"use strict";

/** Comments blanked (strings kept), so positions and lines still match. */
function withoutComments(src) {
    const out = String(src || "").split("");
    let i = 0;
    let quote = null;
    while (i < out.length) {
        const c = out[i];
        const n = out[i + 1];
        if (quote) {
            if (c === "\\") i += 2;
            else {
                if (c === quote) quote = null;
                i += 1;
            }
            continue;
        }
        if (c === '"' || c === "'" || c === "`") {
            quote = c;
            i += 1;
        } else if (c === "/" && n === "/") {
            while (i < out.length && out[i] !== "\n") out[i++] = " ";
        } else if (c === "/" && n === "*") {
            while (i < out.length && !(out[i] === "*" && out[i + 1] === "/")) {
                if (out[i] !== "\n") out[i] = " ";
                i += 1;
            }
            if (i < out.length) out[i] = out[i + 1] = " ";
            i += 2;
        } else i += 1;
    }
    return out.join("");
}

const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;

/**
 * The top-level entries of an object literal starting at `open` ("{"):
 * [{ key, value, literal? }], whether it spreads another object in, and
 * where it ends.
 */
function objectEntries(src, open) {
    const parts = [];
    let depth = 0;
    let quote = null;
    let start = open + 1;
    let i = open;
    for (; i < src.length; i += 1) {
        const c = src[i];
        if (quote) {
            if (c === "\\") i += 1;
            else if (c === quote) quote = null;
            continue;
        }
        if (c === '"' || c === "'" || c === "`") quote = c;
        else if (c === "{" || c === "[" || c === "(") depth += 1;
        else if (c === "}" || c === "]" || c === ")") {
            depth -= 1;
            if (depth === 0) {
                parts.push(src.slice(start, i));
                break;
            }
        } else if (c === "," && depth === 1) {
            parts.push(src.slice(start, i));
            start = i + 1;
        }
    }
    let spread = false;
    const entries = [];
    for (const raw of parts) {
        const text = raw.trim();
        if (!text) continue;
        if (text.startsWith("...")) {
            spread = true;
            continue;
        }
        const m =
            /^(?:(["'])([^"']+)\1|([A-Za-z_$][\w$]*))\s*(?::([\s\S]*))?$/.exec(
                text
            );
        if (!m) {
            spread = true; // a computed key: can't tell
            continue;
        }
        const key = m[2] || m[3];
        const value = m[4] === undefined ? key : m[4].trim();
        const str = /^(["'])((?:\\.|(?!\1)[^\\])*)\1$/.exec(value);
        entries.push({
            key,
            value,
            ...(str ? { literal: str[2] } : {}),
        });
    }
    return { entries, spread, end: i };
}

/**
 * Every `callTool("<tool>", { … })` with a written tool name:
 * [{ tool, line, entries, spread, hasArgs }].
 */
function findToolCalls(componentCode) {
    const src = withoutComments(componentCode);
    const calls = [];
    const re = /\bcallTool\s*\(\s*(["'`])([\w.:-]+)\1\s*(,)?/g;
    let m;
    while ((m = re.exec(src))) {
        let j = re.lastIndex;
        while (/\s/.test(src[j] || "")) j += 1;
        const call = {
            tool: m[2],
            line: lineOf(src, m.index),
            entries: [],
            spread: false,
            hasArgs: false,
        };
        if (m[3] && src[j] === "{") {
            const o = objectEntries(src, j);
            call.entries = o.entries;
            call.spread = o.spread;
            call.hasArgs = true;
        } else if (m[3]) {
            call.spread = true; // a variable: its inputs aren't known here
        }
        calls.push(call);
    }
    return calls;
}

/**
 * The provider types a widget's config declares: each entry of its
 * providers list, by its own type — not a type nested inside it.
 */
function declaredTypes(configCode) {
    const src = withoutComments(configCode);
    const at = /\bproviders\s*:\s*\[/.exec(src);
    if (!at) return [];
    const types = [];
    let depth = 0;
    let quote = null;
    for (let i = at.index + at[0].length - 1; i < src.length; i += 1) {
        const c = src[i];
        if (quote) {
            if (c === "\\") i += 1;
            else if (c === quote) quote = null;
            continue;
        }
        if (c === '"' || c === "'" || c === "`") quote = c;
        else if (c === "{" && depth === 1) {
            const o = objectEntries(src, i);
            const type = o.entries.find((e) => e.key === "type");
            if (type && type.literal) types.push(type.literal);
            i = o.end;
        } else if (c === "[" || c === "(" || c === "{") depth += 1;
        else if (c === "]" || c === ")" || c === "}") {
            depth -= 1;
            if (depth === 0) break;
        }
    }
    return types;
}

// A value that is the user's data, not part of how the tool works: a file
// path ("/Users/me/notes.md", "~/notes.md", "From /docs/a.md") or a web
// address. A fixed API path ("/repos"), a version ("v1.2"), a field name
// ("user.name") or a file name alone ("README.md") is part of the call.
function isUserValue(s) {
    const v = String(s || "").trim();
    if (!v) return false;
    if (/(?:^|\s)https?:\/\/\S+/i.test(v)) return true;
    return /(?:^|\s)(?:~\/|\.{1,2}\/|[A-Za-z]:\\|\/[^/\s]+\/)/.test(v);
}

const listed = (names, max = 12) =>
    names.length > max
        ? `${names.slice(0, max).join(", ")}, …`
        : names.join(", ");

/**
 * @param {string} componentCode
 * @param {string} configCode
 * @param {{ [type]: { provider, tools: [{ name, inputSchema }] } }} live
 * @returns {string[]} problems, each "line N: …"
 */
function providerCallProblems(componentCode, configCode, live = {}) {
    const declared = declaredTypes(configCode);
    const types = declared.filter(
        (t) => live && live[t] && Array.isArray(live[t].tools)
    );
    if (!types.length) return [];
    // A provider that isn't running now: its tools aren't known, so a call
    // not found among the others may well be one of its.
    const allKnown = types.length === declared.length;
    const problems = [];
    for (const call of findToolCalls(componentCode)) {
        let tool = null;
        for (const t of types) {
            tool = live[t].tools.find((x) => x && x.name === call.tool);
            if (tool) break;
        }
        if (!tool) {
            if (!allKnown) continue;
            const one = live[types[0]];
            problems.push(
                `line ${call.line}: callTool("${call.tool}") — ${
                    types.length === 1 ? one.provider : "the widget's providers"
                } ${types.length === 1 ? "has" : "have"} no tool ${
                    call.tool
                }. Its tools: ${listed(
                    types.flatMap((t) => live[t].tools.map((x) => x.name))
                )}.`
            );
            continue;
        }
        const schema = tool.inputSchema || {};
        const props = schema.properties || {};
        const allowed = Object.keys(props);
        const required = Array.isArray(schema.required) ? schema.required : [];
        if (call.hasArgs) {
            const given = new Set(call.entries.map((e) => e.key));
            if (!call.spread) {
                const missing = required.filter((k) => !given.has(k));
                if (missing.length) {
                    problems.push(
                        `line ${call.line}: ${call.tool} needs ${missing.join(
                            ", "
                        )} — ${
                            missing.length === 1 ? "it's" : "they're"
                        } not given.`
                    );
                }
            }
            // An input it doesn't take, only when the tool says it takes no
            // others (most servers say so; a schema that doesn't, isn't held).
            if (allowed.length && schema.additionalProperties === false) {
                for (const e of call.entries) {
                    if (!props[e.key]) {
                        problems.push(
                            `line ${call.line}: ${call.tool} doesn't take ${
                                e.key
                            } — it takes ${allowed.join(", ")}.`
                        );
                    }
                }
            }
        } else if (!call.spread && required.length) {
            problems.push(
                `line ${call.line}: ${call.tool} needs ${required.join(
                    ", "
                )} — no inputs are given.`
            );
        }
        for (const e of call.entries) {
            if (e.literal !== undefined && isUserValue(e.literal)) {
                problems.push(
                    `line ${call.line}: ${call.tool}'s ${
                        e.key
                    } is written into the code (${JSON.stringify(
                        e.literal
                    )}) — make it a userConfig setting the user can change, and pass the setting.`
                );
            }
        }
    }
    return problems;
}

module.exports = { findToolCalls, providerCallProblems, declaredTypes };
