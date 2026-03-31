/**
 * Index Health Scorer
 *
 * Analyzes Algolia index settings against best practices and returns
 * a structured scorecard. Each check returns pass/warn/fail with an
 * explanation and recommendation.
 */

const DEFAULT_RANKING = [
    "typo",
    "geo",
    "words",
    "filters",
    "proximity",
    "attribute",
    "exact",
    "custom",
];

/**
 * Run all health checks against index settings.
 * @param {object} settings - Algolia index settings object
 * @returns {{ score: number, maxScore: number, checks: object[] }}
 */
export function scoreIndex(settings) {
    if (!settings) return { score: 0, maxScore: 0, checks: [] };

    const checks = [
        checkSearchableAttributes(settings),
        checkCustomRanking(settings),
        checkFaceting(settings),
        checkRankingFormula(settings),
        checkTypoTolerance(settings),
        checkHighlighting(settings),
        checkPagination(settings),
        checkDistinct(settings),
        checkRetrievableAttributes(settings),
        checkUnretrievableAttributes(settings),
    ];

    const score = checks.reduce(
        (sum, c) => sum + (c.status === "pass" ? c.weight : 0),
        0
    );
    const maxScore = checks.reduce((sum, c) => sum + c.weight, 0);

    return { score, maxScore, checks };
}

function checkSearchableAttributes(s) {
    const attrs = s.searchableAttributes;
    if (!attrs || attrs.length === 0) {
        return {
            name: "Searchable Attributes",
            category: "Relevance",
            status: "fail",
            weight: 3,
            detail: "No searchable attributes configured.",
            recommendation:
                "Define searchable attributes in priority order. This is the single most important setting for relevance.",
        };
    }
    if (attrs.length === 1 && attrs[0] === "*") {
        return {
            name: "Searchable Attributes",
            category: "Relevance",
            status: "warn",
            weight: 3,
            detail: "All attributes are searchable (wildcard *). This dilutes relevance.",
            recommendation:
                "Explicitly list the attributes users search for, ordered by importance.",
        };
    }
    return {
        name: "Searchable Attributes",
        category: "Relevance",
        status: "pass",
        weight: 3,
        detail: `${attrs.length} searchable attribute(s) configured.`,
        recommendation: null,
    };
}

function checkCustomRanking(s) {
    const cr = s.customRanking;
    if (!cr || cr.length === 0) {
        return {
            name: "Custom Ranking",
            category: "Relevance",
            status: "warn",
            weight: 2,
            detail: "No custom ranking configured.",
            recommendation:
                "Add business metrics (popularity, rating, date) as custom ranking to differentiate equally relevant results.",
        };
    }
    return {
        name: "Custom Ranking",
        category: "Relevance",
        status: "pass",
        weight: 2,
        detail: `${cr.length} custom ranking criterion(a): ${cr.join(", ")}.`,
        recommendation: null,
    };
}

function checkFaceting(s) {
    const facets = s.attributesForFaceting;
    if (!facets || facets.length === 0) {
        return {
            name: "Faceting",
            category: "Filtering",
            status: "warn",
            weight: 2,
            detail: "No faceting attributes configured.",
            recommendation:
                "Configure faceting attributes to enable filtering. Use filterOnly() for attributes that don't need facet counts.",
        };
    }
    const filterOnly = facets.filter((f) => f.startsWith("filterOnly("));
    const searchable = facets.filter((f) => f.startsWith("searchable("));
    const plain = facets.filter(
        (f) => !f.startsWith("filterOnly(") && !f.startsWith("searchable(")
    );
    return {
        name: "Faceting",
        category: "Filtering",
        status: "pass",
        weight: 2,
        detail: `${facets.length} facet(s): ${plain.length} plain, ${filterOnly.length} filterOnly, ${searchable.length} searchable.`,
        recommendation:
            plain.length > 5
                ? "Consider using filterOnly() for high-cardinality facets to improve performance."
                : null,
    };
}

function checkRankingFormula(s) {
    const ranking = s.ranking;
    if (!ranking || ranking.length === 0) {
        return {
            name: "Ranking Formula",
            category: "Relevance",
            status: "pass",
            weight: 1,
            detail: "Using default ranking formula.",
            recommendation: null,
        };
    }
    const isDefault =
        JSON.stringify(ranking) === JSON.stringify(DEFAULT_RANKING);
    if (isDefault) {
        return {
            name: "Ranking Formula",
            category: "Relevance",
            status: "pass",
            weight: 1,
            detail: "Using default ranking formula (recommended for most use cases).",
            recommendation: null,
        };
    }
    return {
        name: "Ranking Formula",
        category: "Relevance",
        status: "warn",
        weight: 1,
        detail: `Custom ranking formula: ${ranking.join(" > ")}.`,
        recommendation:
            "Non-default ranking formula detected. Ensure this is intentional — reordering the default criteria can significantly impact relevance.",
    };
}

function checkTypoTolerance(s) {
    if (s.typoTolerance === false) {
        return {
            name: "Typo Tolerance",
            category: "UX",
            status: "warn",
            weight: 1,
            detail: "Typo tolerance is disabled.",
            recommendation:
                "Typo tolerance improves search UX significantly. Only disable if you have a strict matching requirement (e.g., SKU lookup).",
        };
    }
    return {
        name: "Typo Tolerance",
        category: "UX",
        status: "pass",
        weight: 1,
        detail: `Typo tolerance: ${
            s.typoTolerance === "min"
                ? "min (1 typo only)"
                : s.typoTolerance === "strict"
                ? "strict"
                : "enabled"
        }.`,
        recommendation: null,
    };
}

function checkHighlighting(s) {
    const preTag = s.highlightPreTag;
    const postTag = s.highlightPostTag;
    if ((!preTag || preTag === "<em>") && (!postTag || postTag === "</em>")) {
        return {
            name: "Highlighting",
            category: "UX",
            status: "pass",
            weight: 1,
            detail: "Using default highlight tags (<em>).",
            recommendation: null,
        };
    }
    return {
        name: "Highlighting",
        category: "UX",
        status: "pass",
        weight: 1,
        detail: `Custom highlight tags: ${preTag || "<em>"}...${
            postTag || "</em>"
        }.`,
        recommendation: null,
    };
}

function checkPagination(s) {
    const limit = s.paginationLimitedTo;
    if (limit != null && limit > 5000) {
        return {
            name: "Pagination",
            category: "Performance",
            status: "warn",
            weight: 1,
            detail: `Pagination limit is ${limit} (high).`,
            recommendation:
                "High pagination limits impact performance. Consider limiting to 1000 and using cursor-based browsing for deep access.",
        };
    }
    return {
        name: "Pagination",
        category: "Performance",
        status: "pass",
        weight: 1,
        detail: `Pagination limit: ${
            limit != null ? limit : "default (1000)"
        }.`,
        recommendation: null,
    };
}

function checkDistinct(s) {
    if (s.distinct && !s.attributeForDistinct) {
        return {
            name: "Distinct / De-duplication",
            category: "Configuration",
            status: "fail",
            weight: 2,
            detail: "Distinct is enabled but no attributeForDistinct is set.",
            recommendation:
                "Set attributeForDistinct to the attribute you want to de-duplicate on (e.g., product_group_id).",
        };
    }
    if (s.distinct) {
        return {
            name: "Distinct / De-duplication",
            category: "Configuration",
            status: "pass",
            weight: 2,
            detail: `Distinct enabled on "${s.attributeForDistinct}" (level: ${s.distinct}).`,
            recommendation: null,
        };
    }
    return {
        name: "Distinct / De-duplication",
        category: "Configuration",
        status: "pass",
        weight: 2,
        detail: "Distinct is not enabled (no de-duplication).",
        recommendation: null,
    };
}

function checkRetrievableAttributes(s) {
    const attrs = s.attributesToRetrieve;
    if (!attrs || (attrs.length === 1 && attrs[0] === "*")) {
        return {
            name: "Retrievable Attributes",
            category: "Performance",
            status: "warn",
            weight: 1,
            detail: "All attributes are returned in search results (wildcard *).",
            recommendation:
                "Limit attributesToRetrieve to only the fields your frontend needs. This reduces response size and improves latency.",
        };
    }
    return {
        name: "Retrievable Attributes",
        category: "Performance",
        status: "pass",
        weight: 1,
        detail: `${attrs.length} attribute(s) returned in search results.`,
        recommendation: null,
    };
}

function checkUnretrievableAttributes(s) {
    const attrs = s.unretrievableAttributes;
    if (!attrs || attrs.length === 0) {
        return {
            name: "Unretrievable Attributes",
            category: "Security",
            status: "pass",
            weight: 1,
            detail: "No attributes are explicitly hidden (all are retrievable).",
            recommendation:
                "If you have sensitive data (internal IDs, pricing tiers, admin flags), consider adding them to unretrievableAttributes.",
        };
    }
    return {
        name: "Unretrievable Attributes",
        category: "Security",
        status: "pass",
        weight: 1,
        detail: `${attrs.length} attribute(s) hidden from API responses.`,
        recommendation: null,
    };
}
