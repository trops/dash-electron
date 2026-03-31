/**
 * Config Recommender
 *
 * Generates specific configuration recommendations based on
 * index settings and (optionally) attribute analysis data.
 * Goes beyond the health scorer by suggesting exact values to set.
 */

/**
 * Generate recommendations based on settings and attribute data.
 * @param {object} settings - Algolia index settings
 * @param {object[]} attributes - Optional attribute analysis from analyzeRecords
 * @returns {object[]} Array of recommendation objects
 */
export function generateRecommendations(settings, attributes = []) {
    if (!settings) return [];

    const recs = [];

    recSearchableAttributes(settings, attributes, recs);
    recCustomRanking(settings, attributes, recs);
    recFaceting(settings, attributes, recs);
    recRetrievableAttributes(settings, attributes, recs);
    recTypoTolerance(settings, attributes, recs);
    recDistinct(settings, attributes, recs);
    recPerformance(settings, recs);

    return recs;
}

function rec(recs, priority, category, title, detail, suggestion) {
    recs.push({ priority, category, title, detail, suggestion });
}

function recSearchableAttributes(settings, attributes, recs) {
    const sa = settings.searchableAttributes;
    if (!sa || sa.length === 0) {
        // Suggest searchable attributes from text-like fields
        const textAttrs = attributes
            .filter(
                (a) =>
                    a.primaryType === "string" &&
                    !a.isObjectID &&
                    a.fillRate >= 80 &&
                    a.cardinality > 5
            )
            .slice(0, 5)
            .map((a) => a.name);

        rec(
            recs,
            "high",
            "Relevance",
            "Add searchable attributes",
            "No searchable attributes configured. Without this, Algolia searches all fields with equal weight.",
            textAttrs.length > 0
                ? `Suggested: searchableAttributes: [${textAttrs
                      .map((a) => `"${a}"`)
                      .join(", ")}]`
                : "List your most important text fields in order of relevance."
        );
    } else if (sa.length === 1 && sa[0] === "*") {
        const textAttrs = attributes
            .filter(
                (a) =>
                    a.primaryType === "string" &&
                    !a.isObjectID &&
                    a.fillRate >= 80
            )
            .slice(0, 5)
            .map((a) => a.name);

        rec(
            recs,
            "high",
            "Relevance",
            "Replace wildcard searchable attributes",
            'Using "*" makes all attributes equally searchable, diluting relevance.',
            textAttrs.length > 0
                ? `Replace with: [${textAttrs.map((a) => `"${a}"`).join(", ")}]`
                : "Explicitly list the attributes users search for, ordered by importance."
        );
    }
}

function recCustomRanking(settings, attributes, recs) {
    if (settings.customRanking && settings.customRanking.length > 0) return;

    const numericAttrs = attributes
        .filter(
            (a) =>
                a.primaryType === "number" && !a.isObjectID && a.fillRate >= 80
        )
        .map((a) => a.name);

    const candidates = numericAttrs.filter((name) => {
        const lower = name.toLowerCase();
        return (
            lower.includes("popular") ||
            lower.includes("rating") ||
            lower.includes("score") ||
            lower.includes("rank") ||
            lower.includes("count") ||
            lower.includes("price") ||
            lower.includes("date") ||
            lower.includes("timestamp")
        );
    });

    rec(
        recs,
        "medium",
        "Relevance",
        "Add custom ranking",
        "No custom ranking defined. Equally relevant results appear in arbitrary order.",
        candidates.length > 0
            ? `Suggested: customRanking: [${candidates
                  .slice(0, 3)
                  .map((a) => `"desc(${a})"`)
                  .join(", ")}]`
            : numericAttrs.length > 0
            ? `Numeric fields available: ${numericAttrs
                  .slice(0, 5)
                  .join(
                      ", "
                  )}. Pick business metrics like popularity or rating.`
            : "Add a numeric attribute to your records (e.g., popularity, rating) and use it for custom ranking."
    );
}

function recFaceting(settings, attributes, recs) {
    if (
        settings.attributesForFaceting &&
        settings.attributesForFaceting.length > 0
    )
        return;

    // Look for low-cardinality attributes that make good facets
    const facetCandidates = attributes
        .filter(
            (a) =>
                !a.isObjectID &&
                a.fillRate >= 70 &&
                a.cardinality >= 2 &&
                a.cardinality <= 50 &&
                (a.primaryType === "string" || a.primaryType === "boolean")
        )
        .slice(0, 5)
        .map((a) => a.name);

    if (facetCandidates.length > 0) {
        rec(
            recs,
            "medium",
            "Filtering",
            "Add faceting attributes",
            "No faceting configured. Users can't filter search results.",
            `Good candidates: attributesForFaceting: [${facetCandidates
                .map((a) => `"${a}"`)
                .join(", ")}]`
        );
    }
}

function recRetrievableAttributes(settings, attributes, recs) {
    const atr = settings.attributesToRetrieve;
    if (atr && !(atr.length === 1 && atr[0] === "*")) return;

    if (attributes.length > 10) {
        rec(
            recs,
            "low",
            "Performance",
            "Limit retrieved attributes",
            `Index has ${attributes.length} attributes but returns all in search results. This increases response size.`,
            "Set attributesToRetrieve to only the fields your frontend renders."
        );
    }
}

function recTypoTolerance(settings, attributes, recs) {
    if (settings.typoTolerance !== false) return;

    const hasIdentifiers = attributes.some((a) => {
        const lower = a.name.toLowerCase();
        return (
            lower.includes("sku") ||
            lower.includes("code") ||
            lower.includes("isbn")
        );
    });

    rec(
        recs,
        hasIdentifiers ? "low" : "medium",
        "UX",
        "Re-enable typo tolerance",
        "Typo tolerance is disabled globally.",
        hasIdentifiers
            ? "Instead of disabling globally, use disableTypoToleranceOnAttributes for identifier fields (SKU, code, ISBN)."
            : "Most search UIs benefit from typo tolerance. Only disable for exact-match use cases."
    );
}

function recDistinct(settings, attributes, recs) {
    if (settings.distinct && !settings.attributeForDistinct) {
        rec(
            recs,
            "high",
            "Configuration",
            "Set attributeForDistinct",
            "Distinct is enabled but no grouping attribute is set. This is a misconfiguration.",
            "Set attributeForDistinct to the field you want to de-duplicate on (e.g., product_group_id)."
        );
    }
}

function recPerformance(settings, recs) {
    if (settings.paginationLimitedTo && settings.paginationLimitedTo > 5000) {
        rec(
            recs,
            "low",
            "Performance",
            "Reduce pagination limit",
            `Pagination limit is ${settings.paginationLimitedTo}. Deep pagination is expensive.`,
            "Set paginationLimitedTo to 1000 and use browse API for deep access."
        );
    }

    if (settings.hitsPerPage && settings.hitsPerPage > 50) {
        rec(
            recs,
            "low",
            "Performance",
            "Reduce hits per page",
            `Returning ${settings.hitsPerPage} hits per page. Large pages increase latency.`,
            "Set hitsPerPage to 20-30 for most UIs."
        );
    }
}
