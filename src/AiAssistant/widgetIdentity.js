/**
 * widgetIdentity — a package registers only its own widgets. A widget's id,
 * scope and packageName come from the package being loaded, never from
 * what its .dash.js claims: a copy of AlgoliaHits whose config still said
 * id "trops.algolia-search.AlgoliaHits" took the original's place on the
 * user's dashboard.
 *
 * ownWidgetIdentity(packageName, key, config) → { id, scope, packageName,
 * bare, claimed } for a scoped package ("@scope/name"); claimed is the id
 * the config declared when it isn't this one. null for an unscoped package
 * (its config is the only origin it has — left as before).
 */
export function ownWidgetIdentity(packageName, key, config = {}) {
    const m = /^@([^/]+)\/([^/]+)$/.exec(String(packageName || "").trim());
    if (!m) return null;
    const [, scope, name] = m;
    const bare =
        String(key || "")
            .split(".")
            .pop() ||
        config.name ||
        "";
    const id = `${scope}.${name}.${bare}`;
    return {
        id,
        scope,
        packageName: name,
        bare,
        claimed:
            config && typeof config.id === "string" && config.id !== id
                ? config.id
                : null,
    };
}
