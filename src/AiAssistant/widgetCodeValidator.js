/**
 * widgetCodeValidator
 *
 * Post-compile guardrail against AI hallucinations of provider IPC
 * methods. Walks the AI-generated component code looking for any
 * `window.mainApi.<service>.<method>(` (or `mainApi.<service>.<method>(`)
 * call where `<method>` is NOT in the PROVIDER_API_REGISTRY for that
 * `<service>`. Returns the offending method names so the modal can
 * surface them in a banner with a "Send to AI to fix" affordance.
 *
 * Why regex (and not a real AST):
 *   - widget code is small (single component file, sub-1k lines)
 *   - the patterns we care about are syntactically narrow (member
 *     access on a known root identifier)
 *   - adding a parser dep + handling JSX makes this 10× heavier
 *     for marginal correctness gains
 *   - every false positive can be silenced by spelling the call as
 *     `const algolia = window.mainApi.algolia; algolia.foo()` —
 *     which the prompt actively discourages, so unaffected paths
 *     stay clean
 *
 * False-negative risk we accept:
 *   - calls behind dynamic property access
 *     (`mainApi.algolia[methodName]`) skip the check. Rare in AI
 *     output and not worth the parser cost.
 */

import { PROVIDER_API_REGISTRY } from "./providerApiRegistry";
import { DASH_REACT_COMPONENTS } from "./dashReactComponentRegistry";

/**
 * Find every `(window.)?mainApi.<service>.<method>(` call in the
 * code where `<service>` is registered AND `<method>` is NOT in
 * the registry for that service.
 *
 * Returns: { ok, errors: [{ service, method, line, suggestion }] }.
 */
export function validateProviderApiUsage(componentCode) {
    if (!componentCode || typeof componentCode !== "string") {
        return { ok: true, errors: [] };
    }

    const errors = [];
    const seen = new Set();

    // Match `(window.)?mainApi.<service>.<method>(` where
    // service and method are bare identifiers. The optional
    // `window.` prefix lets us catch both call styles common in
    // AI output.
    const callPattern =
        /\b(?:window\s*\.\s*)?mainApi\s*\.\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\.\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;

    const matches = codeOnly(componentCode).matchAll(callPattern);
    for (const m of matches) {
        const service = m[1];
        const method = m[2];
        const matchIndex = m.index;

        // Only validate services we have a registry for. Other
        // namespaces (popout, widgetBuilder, …) are not under
        // this check yet — adding them to the registry brings
        // them into scope automatically.
        const known = PROVIDER_API_REGISTRY[service];
        if (!known) continue;
        if (Object.prototype.hasOwnProperty.call(known, method)) continue;

        // Dedupe by service.method — one entry per hallucination
        // even if the AI calls it five times.
        const key = `${service}.${method}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const line = lineOf(componentCode, matchIndex);
        errors.push({
            service,
            method,
            line,
            suggestion: suggestionFor(service, method),
        });
    }

    return { ok: errors.length === 0, errors };
}

/**
 * Given the index of a match in the source, return the 1-based
 * line number it lives on. Cheap; we count newlines from start.
 */

/**
 * The code without its comments, quoted strings or template text — each
 * character blanked to a space, line breaks kept so line numbers stay
 * right — so the checks don't flag words in a doc comment or a string
 * (install gate, 2026-10-16). A '…' or "…" string ends at its line (an
 * apostrophe in JSX text can't hide the lines after it); template
 * expressions (${…}) stay code. keepStrings: blank comments only (a check
 * that reads a string, e.g. mainApi["bots"]).
 */
export function codeOnly(source, { keepStrings = false } = {}) {
    const src = String(source || "");
    const out = src.split("");
    const blank = (i) => {
        if (out[i] !== "\n") out[i] = " ";
    };
    // Stack of modes: "code" (inside ${…} keeps a brace depth) or "tpl".
    const stack = [{ mode: "code", depth: 0 }];
    let i = 0;
    while (i < src.length) {
        const top = stack[stack.length - 1];
        const c = src[i];
        const n = src[i + 1];
        if (top.mode === "tpl") {
            if (c === "\\") {
                blank(i);
                if (i + 1 < src.length) blank(i + 1);
                i += 2;
            } else if (c === "`") {
                stack.pop();
                i += 1;
            } else if (c === "$" && n === "{") {
                stack.push({ mode: "code", depth: 0 });
                i += 2;
            } else {
                blank(i);
                i += 1;
            }
            continue;
        }
        // code
        if (c === "/" && n === "/") {
            while (i < src.length && src[i] !== "\n") blank(i++);
            continue;
        }
        if (c === "/" && n === "*") {
            blank(i);
            blank(i + 1);
            i += 2;
            while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
                blank(i++);
            }
            if (i < src.length) {
                blank(i);
                blank(i + 1);
                i += 2;
            }
            continue;
        }
        if (!keepStrings && (c === "'" || c === '"')) {
            const start = i;
            i += 1;
            while (i < src.length && src[i] !== c && src[i] !== "\n") {
                if (src[i] === "\\" && src[i + 1] !== "\n") blank(i++);
                blank(i++);
            }
            if (src[i] === c) {
                i += 1;
            } else {
                // Not closed on its line, so not a string (an apostrophe
                // in JSX text): keep the rest of the line as code.
                for (let k = start + 1; k < i; k++) out[k] = src[k];
                i = start + 1;
            }
            continue;
        }
        if (!keepStrings && c === "`") {
            stack.push({ mode: "tpl" });
            i += 1;
            continue;
        }
        if (stack.length > 1) {
            if (c === "{") top.depth += 1;
            else if (c === "}") {
                if (top.depth === 0) {
                    stack.pop();
                    i += 1;
                    continue;
                }
                top.depth -= 1;
            }
        }
        i += 1;
    }
    return out.join("");
}

function lineOf(source, idx) {
    let n = 1;
    for (let i = 0; i < idx; i++) {
        if (source[i] === "\n") n++;
    }
    return n;
}

/**
 * Heuristic next-best-guess for a given hallucinated call. If the
 * caller's `method` is close (substring match either direction)
 * to a registered method, point at it; otherwise list all
 * registered methods for the service.
 */
function suggestionFor(service, method) {
    const registered = Object.keys(PROVIDER_API_REGISTRY[service] || {});
    const lc = method.toLowerCase();
    const close = registered.filter(
        (r) => r.toLowerCase().includes(lc) || lc.includes(r.toLowerCase())
    );
    if (close.length > 0) return close.join(", ");
    return registered.join(", ");
}

/**
 * Detects `<Modal>`, `<Dialog>`, `<Drawer>` JSX in widget code.
 *
 * Why this is a hard rule (not a suggestion): widgets are small,
 * single-purpose UI units that share dashboard real-estate with
 * other widgets. Popping a Modal/Dialog/Drawer over the dashboard
 * from inside a widget hijacks that shared real-estate, often
 * fights z-index against actual app chrome, and produces the
 * `open prop must be boolean` runtime error the AI hits when it
 * forgets to thread an `isOpen` state into the dialog.
 *
 * Multi-step flows (create / edit / configure) belong inline in
 * the widget's flat surface — a collapsible <Card> beats a Modal
 * every time. If a flow legitimately needs separation, split it
 * into multiple widgets coordinated via useWidgetEvents (the
 * "assembly line" pattern this app encourages).
 *
 * Returns: { ok, errors: [{ tag, line, suggestion }] }.
 */
export function validateNoModalUsage(componentCode) {
    if (!componentCode || typeof componentCode !== "string") {
        return { ok: true, errors: [] };
    }

    const errors = [];
    const seen = new Set();
    // JSX opening-tag patterns: `<Modal `, `<Modal>`, `<Modal\n`,
    // `<Modal/>`. We require a non-identifier char immediately
    // after the tag name to avoid false positives on identifiers
    // like `ModalContent`, `DialogTrigger`, etc.
    const tagPattern = /<(Modal|Dialog|Drawer)(?=[\s/>])/g;
    const matches = codeOnly(componentCode).matchAll(tagPattern);
    for (const m of matches) {
        const tag = m[1];
        if (seen.has(tag)) continue;
        seen.add(tag);
        const line = lineOf(componentCode, m.index);
        errors.push({
            tag,
            line,
            suggestion:
                tag === "Modal"
                    ? "Use a collapsible <Card> inline instead. Example: `{showForm && <Card>{form}</Card>}`."
                    : tag === "Dialog"
                    ? "<Dialog> is HeadlessUI internals — wrap in a <Card> in the widget's flat surface, or split into a separate widget that listens for an event."
                    : "<Drawer> is app chrome, not widget content. Split into a sibling widget coordinated via useWidgetEvents.",
        });
    }
    return { ok: errors.length === 0, errors };
}

/**
 * Widgets never start bots themselves (team-dashboards TD-005): they publish
 * an event the user wires a bot to. Rejects any reach into `mainApi.bots` —
 * `mainApi.bots`, `mainApi?.bots`, `mainApi["bots"]`, and destructuring
 * `{ bots } = …mainApi`. (Dash also refuses to install such a package.)
 *
 * Returns: { ok, errors: [{ line, snippet, suggestion }] }.
 */
const BOT_CALL_PATTERNS = [
    /mainApi\s*(?:\?\.|\.)\s*bots\b/g,
    /mainApi\s*(?:\?\.)?\s*\[\s*["'`]bots["'`]\s*\]/g,
    /\{[^{}]*\bbots\b[^{}]*\}\s*=\s*[\w.?]*mainApi\b/g,
];
export function validateNoBotCalls(componentCode) {
    if (!componentCode || typeof componentCode !== "string") {
        return { ok: true, errors: [] };
    }
    const errors = [];
    const seenLines = new Set();
    const code = codeOnly(componentCode, { keepStrings: true });
    for (const re of BOT_CALL_PATTERNS) {
        for (const m of code.matchAll(re)) {
            const line = lineOf(componentCode, m.index);
            if (seenLines.has(line)) continue;
            seenLines.add(line);
            errors.push({
                line,
                snippet: m[0],
                suggestion:
                    "Publish an event instead (declare it in the config's events, publishEvent on click) and tell the user to wire the bot under its Run on events.",
            });
        }
    }
    errors.sort((a, b) => a.line - b.line);
    return { ok: errors.length === 0, errors };
}

/**
 * Widgets publish events with `publishEvent` from `useWidgetEvents()` (or
 * the `publishEvent` prop), which names the event after the widget
 * (`Component[id].event`) — what bots and other widgets subscribe to. The
 * raw `api.publishEvent(...)` sends the bare name, so nothing ever hears it
 * (create-entry phase 4d-2).
 *
 * Returns: { ok, errors: [{ line, snippet, suggestion }] }.
 */
const RAW_PUBLISH_PATTERN = /\bapi\s*(?:\?\.|\.)\s*publishEvent\s*\(/g;
export function validateEventPublishing(componentCode) {
    if (!componentCode || typeof componentCode !== "string") {
        return { ok: true, errors: [] };
    }
    const errors = [];
    for (const m of codeOnly(componentCode, { keepStrings: true }).matchAll(
        RAW_PUBLISH_PATTERN
    )) {
        errors.push({
            line: lineOf(componentCode, m.index),
            snippet: m[0].replace(/\s*\($/, ""),
            suggestion:
                'Use publishEvent from useWidgetEvents(): const { publishEvent } = useWidgetEvents(); publishEvent("<event>", payload).',
        });
    }
    return { ok: errors.length === 0, errors };
}

/**
 * A widget that declares a connection (the config's `providers`) gets its
 * credentials from that connection. It must not ask the user to paste keys
 * into its settings, or call the service itself with fetch — the Builder
 * did both for a user's Attribute Boost while the Algolia connection sat
 * unused (create-entry, Create build fixes 3). A widget with no connection
 * may ask for its own key.
 *
 * Flags: a setting named like a credential (apiKey, adminApiKey, secret,
 * accessToken, password, credentials — not sortKey or tokenLimit); a fetch
 * whose URL names a connected service; and, alongside such a fetch, an App
 * ID setting.
 *
 * Returns: { ok, errors: [{ kind: "setting", name, line, provider,
 * suggestion } | { kind: "fetch", line, snippet, provider, suggestion }] }.
 */
const KEY_QUALIFIERS = new Set([
    "api",
    "access",
    "private",
    "secret",
    "admin",
    "search",
    "auth",
    "client",
    "write",
    "read",
]);
const SECRET_WORDS = new Set([
    "secret",
    "password",
    "passwd",
    "credential",
    "credentials",
    "token",
]);

function nameParts(name) {
    return String(name)
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .split(/[\s_-]+/)
        .map((p) => p.toLowerCase())
        .filter(Boolean);
}

function isCredentialName(name) {
    const parts = nameParts(name);
    const last = parts[parts.length - 1];
    if (SECRET_WORDS.has(last)) return true;
    if (parts.join("") === "apikey") return true;
    return (
        last === "key" &&
        parts.length > 1 &&
        KEY_QUALIFIERS.has(parts[parts.length - 2])
    );
}

function isAppIdName(name) {
    const joined = nameParts(name).join("");
    return joined === "appid" || joined === "applicationid";
}

/** The provider types a .dash.js config declares. */
function declaredProviderTypes(configCode) {
    const block = /providers\s*:\s*\[([\s\S]*?)\]/.exec(configCode);
    if (!block) return [];
    return [...block[1].matchAll(/type\s*:\s*["'`]([\w.-]+)["'`]/g)].map(
        (m) => m[1]
    );
}

/** The top-level keys of a config's userConfig, with where they are. */
function userConfigKeys(configCode) {
    const start = /userConfig\s*:\s*\{/.exec(configCode);
    if (!start) return [];
    const keys = [];
    let depth = 0;
    let quote = null;
    let expectKey = false;
    for (
        let i = start.index + start[0].length - 1;
        i < configCode.length;
        i++
    ) {
        const ch = configCode[i];
        if (quote) {
            if (ch === "\\") i++;
            else if (ch === quote) quote = null;
            continue;
        }
        if (depth === 1 && expectKey) {
            const key = /^\s*["']?([A-Za-z_$][\w$]*)["']?\s*:/.exec(
                configCode.slice(i, i + 200)
            );
            if (key) {
                keys.push({ name: key[1], index: i + key[0].indexOf(key[1]) });
                expectKey = false;
                i += key[0].length - 1;
                continue;
            }
        }
        if (ch === '"' || ch === "'" || ch === "`") quote = ch;
        else if (ch === "{" || ch === "[" || ch === "(") {
            depth++;
            if (depth === 1) expectKey = true;
        } else if (ch === "}" || ch === "]" || ch === ")") {
            depth--;
            if (depth === 0) break;
        } else if (ch === "," && depth === 1) expectKey = true;
    }
    return keys;
}

function namesService(url, type) {
    const t = String(type).toLowerCase();
    const words = [t, t.replace(/[-_.]/g, ""), t.split(/[-_.]/)[0]];
    const u = url.toLowerCase();
    return words.some((w) => w.length > 2 && u.includes(w));
}

const FETCH_PATTERN = /\bfetch\s*\(\s*(`[^`]*`|"[^"]*"|'[^']*')/g;

export function validateProviderCredentials(componentCode, configCode) {
    const config = typeof configCode === "string" ? configCode : "";
    const code = typeof componentCode === "string" ? componentCode : "";
    const types = declaredProviderTypes(config);
    if (!types.length) return { ok: true, errors: [] };
    const via = (type) =>
        `window.mainApi.${type}.* or useMcpProvider("${type}")`;
    const errors = [];
    for (const m of code.matchAll(FETCH_PATTERN)) {
        const type = types.find((t) => namesService(m[1], t));
        if (!type) continue;
        errors.push({
            kind: "fetch",
            line: lineOf(code, m.index),
            snippet: m[0].replace(/\s+/g, " ").slice(0, 80),
            provider: type,
            suggestion: `Don't call ${type} with fetch and pasted keys — go through the ${type} connection (${via(
                type
            )}).`,
        });
    }
    const callsDirectly = errors.length > 0;
    const type = types[0];
    for (const key of userConfigKeys(config)) {
        if (
            !isCredentialName(key.name) &&
            !(callsDirectly && isAppIdName(key.name))
        ) {
            continue;
        }
        errors.push({
            kind: "setting",
            name: key.name,
            line: lineOf(config, key.index),
            provider: type,
            suggestion: `Remove the "${
                key.name
            }" setting: the ${type} connection already holds the credentials — call the service through the connection (${via(
                type
            )}).`,
        });
    }
    return { ok: errors.length === 0, errors };
}

/**
 * Find every JSX `<UpperCaseName ...` reference where the name is
 * neither imported in the file nor exported by @trops/dash-react.
 *
 * Why this exists: when the AI hallucinates a component name (typo,
 * wrong library, outdated training data), React fails at render time
 * with `Element type is invalid: expected a string ... but got:
 * undefined`. The error originates deep in the reconciler, far from
 * the JSX line that caused it. Catching it at compile time means the
 * user never sees the broken render — they get a clean "Component X
 * is not imported" message with a "Send to AI to fix" affordance.
 *
 * Detection:
 *   1. Collect every PascalCase JSX tag reference.
 *   2. Subtract names declared in the file (imports OR locally-defined
 *      function/const/let/var bindings). These are user code; trust them.
 *   3. Subtract dash-react exports (the registry).
 *   4. Anything left is rejected.
 *
 * Edge cases:
 *   - JSX member expressions (`<Tabs.Panel>`, `<React.Fragment>`) —
 *     check the root identifier (`Tabs`, `React`) only.
 *   - Fragment shorthand `<>` — no name, skipped by the regex.
 *   - All-caps constants (`<MY_CONST>`) — rare in JSX; treat like
 *     other identifiers.
 *
 * Returns: { ok, errors: [{ name, line, suggestion }] }.
 */
export function validateComponentReferences(componentCode) {
    if (!componentCode || typeof componentCode !== "string") {
        return { ok: true, errors: [] };
    }

    const declared = collectDeclaredNames(componentCode);
    const errors = [];
    const seen = new Set();

    // Match opening JSX tags: `<Foo `, `<Foo>`, `<Foo/>`, `<Foo.Bar`,
    // `<Foo\n`. Anchor on `<` followed by an uppercase letter.
    // Capture the root identifier (everything up to whitespace, `>`,
    // `/`, or `.`).
    const tagPattern = /<([A-Z][A-Za-z0-9_$]*)(?=[\s/>.])/g;
    const matches = codeOnly(componentCode).matchAll(tagPattern);
    for (const m of matches) {
        const name = m[1];
        if (declared.has(name)) continue;
        if (DASH_REACT_COMPONENTS.has(name)) continue;
        if (seen.has(name)) continue;
        seen.add(name);
        const line = lineOf(componentCode, m.index);
        errors.push({
            name,
            line,
            suggestion: suggestionForComponent(name),
        });
    }
    return { ok: errors.length === 0, errors };
}

/**
 * Collect every name declared in the file — imports + local
 * function/const/let/var bindings — so we can subtract them from
 * the JSX-tag set before flagging unknowns.
 */
function collectDeclaredNames(source) {
    const names = new Set();

    // Default + namespace imports: `import Foo from "..."`,
    //                              `import * as Foo from "..."`.
    const defaultImports = source.matchAll(
        /import\s+(?:\*\s+as\s+)?([A-Za-z_$][\w$]*)\s*(?:,\s*\{[^}]*\})?\s*from\s*["']/g
    );
    for (const m of defaultImports) names.add(m[1]);

    // Named imports: `import { Foo, Bar as Baz } from "..."`. The
    // locally-bound name is `Foo` and `Baz` (the alias wins).
    const namedImports = source.matchAll(
        /import\s+(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]+)\}\s*from\s*["']/g
    );
    for (const m of namedImports) {
        for (const entry of m[1].split(",")) {
            const trimmed = entry.trim();
            if (!trimmed) continue;
            const aliasMatch = trimmed.match(/\s+as\s+([A-Za-z_$][\w$]*)$/);
            const local = aliasMatch
                ? aliasMatch[1]
                : trimmed.split(/\s+/)[0].replace(/^\*$/, "");
            if (local) names.add(local);
        }
    }

    // Local function declarations: `function FooBar(...)`.
    const fnDecls = source.matchAll(/\bfunction\s+([A-Z][A-Za-z0-9_$]*)/g);
    for (const m of fnDecls) names.add(m[1]);

    // Local const/let/var bindings whose value is a function or
    // expression: `const FooBar = ...`. Catches arrow components.
    const varDecls = source.matchAll(
        /\b(?:const|let|var)\s+([A-Z][A-Za-z0-9_$]*)\s*=/g
    );
    for (const m of varDecls) names.add(m[1]);

    return names;
}

function suggestionForComponent(name) {
    // Find dash-react exports that look close to the unknown — helps
    // catch typos like `Heding` → `Heading`. Three signals, any one
    // counts:
    //   1. substring overlap (either direction)
    //   2. shared first 2 chars (catches single-char-misspelling
    //      typos where the 3rd char differs, e.g. `heding` vs `heading`)
    //   3. Levenshtein-ish: same length ±1 AND >50% chars in common
    const lc = name.toLowerCase();
    const close = [...DASH_REACT_COMPONENTS].filter((r) => {
        const rlc = r.toLowerCase();
        if (rlc.includes(lc) || lc.includes(rlc)) return true;
        if (lc.length >= 2 && rlc.startsWith(lc.slice(0, 2))) {
            // Within 2 chars of the same length keeps prefix-match
            // tight — `Heading2` matches `Heding`, but `Header3000`
            // wouldn't match `He`.
            if (Math.abs(lc.length - rlc.length) <= 2) return true;
        }
        return false;
    });
    if (close.length > 0 && close.length <= 8) {
        return `did you mean ${close.map((c) => `<${c}>`).join(" or ")}?`;
    }
    return `not imported and not exported by @trops/dash-react. If you meant to define it locally, add a function/const declaration.`;
}
