/**
 * widgetOwnership — pure derivation of "does the signed-in user own
 * the widget they're editing, with permission to update-in-place
 * (vs. fork into @ai-built/ via Remix)?"
 *
 * Extracted from WidgetBuilderModal so the gate that governs whether
 * the Update Original toggle appears can be exercised by tests
 * directly, instead of through the modal's render tree. The check is
 * security-relevant: a false-positive means the modal lets the user
 * publish over someone else's package; a false-negative is annoying
 * but safe. The tests in the sibling .test.js file are weighted
 * accordingly — far more cases for "should NOT be owner" than for
 * "should be owner".
 *
 * The check has three layers, in priority order:
 *
 *   1. `@ai-built/*` — every dash-electron user owns their @ai-built
 *      scope; the local @ai-built/ directory is the user's personal
 *      dev workspace. Always-owner.
 *
 *   2. Scope-equals-username — the signed-in registry account's
 *      username matches the widget's npm scope. The match is
 *      case-insensitive and tolerates a stray leading "@" on the
 *      username (e.g. the registry returns "Trops" or "@trops" for
 *      a widget under "@trops/foo"), because npm scopes are
 *      case-insensitive and the leading "@" is a display convention.
 *      Beyond those two normalizations, the comparison is strict
 *      equality — substring matches, fuzzy matches, and
 *      anything-but-`===` are all rejected by design.
 *
 *   3. Otherwise — NOT owner. The modal must fall through to the
 *      Remix path. This is the safe default. Out-of-scope cases
 *      that should resolve here (until a future change adds them
 *      explicitly): org-membership ownership (the user is a
 *      publisher in `@trops/*` under their personal username,
 *      not as `trops`), team membership, ACL-based grants, etc.
 *
 * Inputs come from the live edit context — see WidgetBuilderModal's
 * `effectiveEditContext` shape — plus the registry profile's
 * `username`. None of these inputs is sensitive on its own; the
 * check just derives a boolean from them.
 */

/**
 * Extract the scope segment from whatever shape the host provided.
 *
 * The widget identity can arrive in three forms, depending on which
 * code path stamped it:
 *   - "@scope/package"   (canonical npm-style — most common)
 *   - "scope/package"    (npm form without the @ — some legacy
 *                         registrations)
 *   - "scope.package"    (dotted scoped-component-id — what the
 *                         renderer always uses for the `component`
 *                         field on dashboard layout items)
 *
 * We accept any of the three. We fall back to the dotted component
 * name only when neither `originalPackage` form yielded a scope —
 * `originalComponentName` is always present in edit mode and always
 * carries the scope as its first dot-segment.
 *
 * Returns `null` when no form matched (a true "I don't know" — the
 * caller treats this as "not the owner" since equality with null is
 * always false).
 */
export function deriveWidgetScope({ originalPackage, originalComponentName }) {
    if (typeof originalPackage === "string") {
        const m1 = originalPackage.match(/^@([^/]+)\//);
        if (m1) return m1[1];
        const m2 = originalPackage.match(/^([^/]+)\//);
        if (m2) return m2[1];
    }
    if (typeof originalComponentName === "string") {
        const m3 = originalComponentName.match(/^([^.]+)\./);
        if (m3) return m3[1];
    }
    return null;
}

/**
 * Resolve "should the Update Original toggle be enabled?" against the
 * derived scope + the signed-in user. See the file-level comment for
 * the three-layer policy.
 *
 * Returns: `{ widgetScope: string|null, isOwner: boolean }`. The
 * `widgetScope` field is exposed alongside the boolean so the modal
 * can render an inline diagnostic hint ("signed in as X, widget is
 * under scope Y") when isOwner is false — that's a UX nicety, not
 * part of the security boundary, but keeping them together means
 * the consumer can't accidentally derive scope from one source and
 * isOwner from another.
 */
export function deriveWidgetOwnership({
    originalPackage,
    originalComponentName,
    registryUsername,
}) {
    const widgetScope = deriveWidgetScope({
        originalPackage,
        originalComponentName,
    });

    // Lower-case + strip-@ normalization for both sides. This is the
    // ONLY normalization applied — beyond it the comparison is
    // strict equality. We deliberately do NOT trim whitespace, strip
    // non-ASCII characters, normalize Unicode, or apply any other
    // "be helpful" transformation — those open false-positive doors
    // (e.g. invisible-character variants of the scope name passing
    // as owner). If the registry stores a username with whitespace
    // or weird characters, that's the registry's problem to surface,
    // not ours to paper over.
    const normalizedScope =
        typeof widgetScope === "string" ? widgetScope.toLowerCase() : null;
    const normalizedUsername =
        typeof registryUsername === "string"
            ? registryUsername.toLowerCase().replace(/^@/, "")
            : null;

    const isOwner =
        normalizedScope === "ai-built" ||
        (!!normalizedUsername && normalizedScope === normalizedUsername);

    return { widgetScope, isOwner };
}
