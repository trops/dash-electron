/**
 * Wire-matching helpers — Stage 3 of Compose mode.
 *
 * Given a component slot's expected type (from
 * dashReactComponentSchemas.props[propName].type) and a provider
 * method's `returns.type` (from providerApiRegistry), decide
 * whether the method is a sensible candidate to surface in the
 * picker.
 *
 * Both type strings are intentionally informal (the schemas use
 * shapes like "Array<{label,value}>" and "{hits:Array<Object>}").
 * This file does substring + shape-tag matching, not real type
 * unification. A loose match is better than a strict one — too-
 * strict filtering would hide legitimate candidates that just
 * need a one-liner adapter (which Stage 4 supports via per-arg
 * bindings); too-loose filtering surfaces noise but the user can
 * see method descriptions before picking.
 *
 * The categories we actually try to distinguish:
 *
 *   1. Array slots (Table.data, DataList.items, SelectInput.options,
 *      RadioGroup.options) — match anything that produces an
 *      Array<...> at the top level OR has a top-level `hits` /
 *      `items` field that itself is Array (since the user can
 *      easily destructure into the slot).
 *   2. Object slots — match anything that returns an object.
 *   3. Scalar slots (string/number/boolean) — match if the return
 *      type literally is that scalar; otherwise no match.
 *   4. void returns — never match (no value to bind).
 *   5. MCP tools — they have no return-shape metadata, so they
 *      always match (the user picks based on description).
 *
 * `unknown` slot types (`any`, missing) match everything.
 */

/**
 * Score a candidate method against a slot's expected type. Returns:
 *   - 2 → strong match (slot type and return type both Array, etc.)
 *   - 1 → loose match (return wraps Array in `hits`, or types are
 *         unspecified)
 *   - 0 → no match (filtered out of the picker)
 */
export function scoreMethodForSlot(slotType, returnType) {
    if (returnType === "void" || returnType == null) return 0;
    if (slotType == null || slotType === "any" || slotType === "") {
        return 1;
    }

    const slotIsArray = isArrayType(slotType);
    const returnIsArray = isArrayType(returnType);
    const returnIsArrayWrapped = hasArrayField(returnType);

    if (slotIsArray) {
        if (returnIsArray) return 2;
        if (returnIsArrayWrapped) return 1;
        // A GENERIC object return ("Object") is a loose match for an Array
        // slot: the emitter adapts it into `{ key, value }` rows
        // (Object.entries), which a DataList/Table renders naturally. This
        // surfaces read-style methods like Algolia getSettings /
        // getAnalyticsForQuery for a settings-display widget. We deliberately
        // do NOT match structured ack shapes like `{taskID,objectID}`
        // (saveRule/deleteRule) — those are mutation results, not data
        // sources, and would just be noise in the picker.
        if (returnType === "Object") return 1;
        return 0;
    }

    if (slotType === "Object") {
        return isObjectType(returnType) ? 2 : 0;
    }

    if (
        slotType === "string" ||
        slotType === "number" ||
        slotType === "boolean"
    ) {
        // Scalar slots only match exact scalar returns. Almost
        // nothing in the registry matches today; this still lets us
        // filter noise rather than show every Array method.
        return returnType === slotType ? 2 : 0;
    }

    // Anything else (function, ReactNode) we don't try to match.
    return 0;
}

/**
 * True iff the type string represents a top-level Array. Accepts
 * "Array<…>", "Array", or any "...Array<…>" prefix the schemas use
 * (none today, but defensive).
 */
function isArrayType(t) {
    if (typeof t !== "string") return false;
    return /^Array(<|$)/.test(t);
}

/**
 * True iff the type string is a JS-object shape like "{ … }" or
 * just "Object". Doesn't try to parse the fields.
 */
function isObjectType(t) {
    if (typeof t !== "string") return false;
    return t === "Object" || /^\{/.test(t);
}

/**
 * True iff the type string contains a top-level Array-typed field,
 * e.g. "{hits:Array<Object>,nbHits,page,nbPages}" returns true
 * because `hits` is the Array. Conservative regex — doesn't
 * actually walk nested braces.
 */
function hasArrayField(t) {
    if (typeof t !== "string") return false;
    return /[:,]\s*Array(<|[,}])/.test(t);
}

/**
 * Filter + score a list of registered methods for a slot. Returns
 * `[{ name, spec, score }, ...]` ordered by descending score, with
 * zero-score entries dropped.
 *
 * `entries` is the `Object.entries(PROVIDER_API_REGISTRY[type])`
 * shape — the caller is responsible for picking the right registry.
 *
 * MCP tools have no `returns.type` metadata, so call this with the
 * tool list mapped to `{ name, returnsType: "any" }` to give them
 * all a score of 1 (loose-but-shown). The composer's UI labels MCP
 * methods explicitly so the user can tell.
 */
export function scoreMethodList(entries, slotType) {
    const out = [];
    for (const [name, spec] of entries) {
        const returnType =
            spec && spec.returns && typeof spec.returns.type === "string"
                ? spec.returns.type
                : null;
        const score = scoreMethodForSlot(slotType, returnType);
        if (score > 0) out.push({ name, spec, score });
    }
    out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return out;
}
