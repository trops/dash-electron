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
