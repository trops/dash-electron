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

    const matches = componentCode.matchAll(callPattern);
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
    const matches = componentCode.matchAll(tagPattern);
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
    for (const re of BOT_CALL_PATTERNS) {
        for (const m of componentCode.matchAll(re)) {
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
    for (const m of componentCode.matchAll(RAW_PUBLISH_PATTERN)) {
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

/** The chat correction for a widget that publishes with api.publishEvent. */
export function buildEventPublishingCorrectionMessage(errors) {
    if (!errors || errors.length === 0) return "";
    const lines = [
        "The widget you generated publishes with api.publishEvent, which sends the bare event name — no bot or widget can hear it:",
    ];
    for (const e of errors) lines.push(`- \`${e.snippet}\` on line ${e.line}`);
    lines.push("");
    lines.push(
        'Re-emit BOTH code blocks (component + config). Publish with `const { publishEvent } = useWidgetEvents();` and `publishEvent("<event>", payload)` (imported from @trops/dash-core), with the event declared in the config\'s `events`. Never call `api.publishEvent`.'
    );
    return lines.join("\n");
}

/** The chat correction for a widget that reaches mainApi.bots. */
export function buildNoBotCallsCorrectionMessage(errors) {
    if (!errors || errors.length === 0) return "";
    const lines = [
        "The widget you generated starts a bot directly, which widgets may not do:",
    ];
    for (const e of errors) lines.push(`- \`${e.snippet}\` on line ${e.line}`);
    lines.push("");
    lines.push(
        'Re-emit BOTH code blocks (component + config). Make it an action widget: declare the event in the config\'s `events`, call `publishEvent("<event>", payload)` from `useWidgetEvents()` on click and show a local "sent" status, and listen for the bot\'s completed/failed through `eventHandlers` to show when it finished. Tell the user to wire the bot under its Run on events. Never reference `mainApi.bots` in any form.'
    );
    return lines.join("\n");
}

/**
 * Build a corrective-message string the modal can post into the
 * chat history so the AI fixes the no-Modal violation.
 */
export function buildNoModalCorrectionMessage(errors) {
    if (!errors || errors.length === 0) return "";
    const lines = [
        "The widget you generated uses popup chrome that's forbidden inside widgets:",
    ];
    for (const e of errors) {
        lines.push(`- \`<${e.tag}>\` on line ${e.line} — ${e.suggestion}`);
    }
    lines.push("");
    lines.push(
        "Re-emit BOTH code blocks (component + config). Replace `<Modal>` / `<Dialog>` / `<Drawer>` with INLINE rendering: a `{showThing && <Card>{thing}</Card>}` collapsible inside the widget's flat surface. Widgets are single-purpose, share dashboard real-estate, and must not pop chrome over other widgets. If the flow legitimately needs two separate widgets, split it: emit the second widget as a separate File: block and coordinate via `useWidgetEvents` (publish on action in widget A, listen + render in widget B)."
    );
    return lines.join("\n");
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
    const matches = componentCode.matchAll(tagPattern);
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

/**
 * Build a corrective-message string the modal can post into the chat
 * history so the AI fixes a hallucinated / typo'd component name.
 */
export function buildComponentReferenceCorrectionMessage(errors) {
    if (!errors || errors.length === 0) return "";
    const lines = [
        "The widget you generated uses component names that don't exist:",
    ];
    for (const e of errors) {
        lines.push(`- \`<${e.name}>\` on line ${e.line} — ${e.suggestion}`);
    }
    lines.push("");
    lines.push(
        "Re-emit BOTH code blocks (component + config). Use ONLY components imported from `@trops/dash-react` (see the dash-react-components.md skill reference for the full list) or components you define locally in the same file. Don't invent component names. If you genuinely need a component that doesn't exist, fall back to a `<Panel>` + `<Heading>` + `<Paragraph>` composition."
    );
    return lines.join("\n");
}

/**
 * Build a corrective-message string the modal can post into the
 * chat history so the AI fixes its own mistake. Same shape as the
 * empty-render banner's "Send to AI to fix" action.
 */
export function buildAiCorrectionMessage(errors) {
    if (!errors || errors.length === 0) return "";
    const lines = ["The widget you generated calls methods that do not exist:"];
    for (const e of errors) {
        lines.push(
            `- \`window.mainApi.${e.service}.${e.method}(...)\` — not a real method on the \`${e.service}\` provider. Available: ${e.suggestion}.`
        );
    }
    lines.push("");
    lines.push(
        "Re-emit BOTH code blocks (component + config) using only methods from the AVAILABLE METHODS section in the system prompt. Do NOT invent new method names. Pass `{ providerHash: pc.providerHash, dashboardAppId: pc.dashboardAppId, providerName: pc.providerName, ...callSpecificFields }` as the single argument — never the bare `pc` object."
    );
    return lines.join("\n");
}
