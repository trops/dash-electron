/**
 * Static scanner for credentialed-API call sites in AI-generated
 * widget code (slice 17d.1).
 *
 * Walks the component code looking for
 * `(window.)?mainApi.<service>.<method>(` patterns and returns one
 * entry per (service, method) pair seen. Used by the install-time
 * permission modal to enumerate which credentialed calls the
 * widget will make so the user can grant or deny each one before
 * the install completes.
 *
 * Same regex shape as widgetCodeValidator's `validateProviderApiUsage`
 * (we deliberately mirror it so the two stay in sync — the
 * validator rejects unknown methods at compile time; the scanner
 * captures the known ones for the install-time grant flow).
 *
 * Limits we accept (mirroring the validator):
 *   - dynamic property access (`mainApi.algolia[methodName]`) is
 *     not detected. The prompt + validator already discourage it.
 *   - method calls inside string literals or comments will trigger
 *     a match. The widget shouldn't mention these patterns in
 *     strings; the validator's noise floor is the same.
 */

export function scanCredentialMethodCalls(componentCode) {
    if (!componentCode || typeof componentCode !== "string") return [];
    const seen = new Map();

    const callPattern =
        /\b(?:window\s*\.\s*)?mainApi\s*\.\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\.\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    const matches = componentCode.matchAll(callPattern);
    for (const m of matches) {
        const service = m[1];
        const method = m[2];
        const key = service + "." + method;
        if (seen.has(key)) continue;
        seen.set(key, {
            service,
            method,
            line: lineOf(componentCode, m.index),
        });
    }
    return Array.from(seen.values());
}

function lineOf(source, idx) {
    let n = 1;
    for (let i = 0; i < idx; i++) {
        if (source[i] === "\n") n++;
    }
    return n;
}

/**
 * Pivot the flat scanner output into a per-service map for the
 * permission modal UI. Each service maps to an array of { method,
 * line } entries.
 */
export function groupByProvider(calls) {
    if (!Array.isArray(calls)) return {};
    const grouped = {};
    for (const c of calls) {
        if (!c || typeof c !== "object") continue;
        const list = grouped[c.service] || (grouped[c.service] = []);
        list.push({ method: c.method, line: c.line });
    }
    return grouped;
}

/**
 * Diff the scanner output against the grants store: returns the
 * set of (service, method) entries that the widget WILL call but
 * the user has NOT yet granted. Drives the install-time modal —
 * if this set is empty, no modal needed; otherwise the modal
 * lists every entry for explicit user decision.
 *
 * @param {Array<{service:string, method:string, line:number}>} calls
 * @param {Record<string, Record<string, boolean>>} existingGrants
 * @returns {Array<{service:string, method:string, line:number}>}
 */
export function findUngrantedCalls(calls, existingGrants) {
    if (!Array.isArray(calls)) return [];
    const grants =
        existingGrants && typeof existingGrants === "object"
            ? existingGrants
            : {};
    const out = [];
    for (const c of calls) {
        if (!c || typeof c !== "object") continue;
        const svc = grants[c.service];
        const granted = svc && svc[c.method] === true;
        if (!granted) out.push(c);
    }
    return out;
}
