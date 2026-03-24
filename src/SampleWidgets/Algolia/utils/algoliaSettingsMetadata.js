/**
 * algoliaSettingsMetadata
 *
 * Centralized metadata for Algolia index settings — labels, descriptions, and doc URLs.
 */
export const SETTINGS_META = {
    searchableAttributes: {
        label: "Searchable Attributes",
        description:
            "Ordered list of attributes Algolia searches in. Attributes listed first have higher relevance. Use unordered() to remove position-based priority.",
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/searchableAttributes/",
    },
    customRanking: {
        label: "Custom Ranking",
        description:
            "Custom ranking criteria applied after Algolia's default ranking formula. Define attributes with asc() or desc() to sort results by business metrics.",
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/customRanking/",
    },
    attributesForFaceting: {
        label: "Attributes for Faceting",
        description:
            "Attributes users can filter or facet on in search results. Use filterOnly() for filtering without facet counts, or searchable() for searchable facet values.",
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/attributesForFaceting/",
    },
    ranking: {
        label: "Ranking Formula",
        description:
            "The ordered list of ranking criteria that determine result order. The default is: typo, geo, words, filters, proximity, attribute, exact, custom.",
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/ranking/",
    },
    attributesToRetrieve: {
        label: "Attributes to Retrieve",
        description:
            'Controls which attributes are returned in search results. Defaults to ["*"] (all attributes).',
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/attributesToRetrieve/",
    },
    unretrievableAttributes: {
        label: "Unretrievable Attributes",
        description:
            "Attributes that are hidden from the API response. Useful for sensitive data that should be searchable but not visible.",
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/unretrievableAttributes/",
    },
    attributesToHighlight: {
        label: "Attributes to Highlight",
        description:
            "Attributes where matched words are wrapped in highlight tags. By default, all searchable attributes are highlighted.",
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/attributesToHighlight/",
    },
    attributesToSnippet: {
        label: "Attributes to Snippet",
        description:
            "Attributes where a text snippet is returned around the matched words. Specify word count per attribute (e.g., content:30).",
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/attributesToSnippet/",
    },
    highlightPreTag: {
        label: "Highlight Pre Tag",
        description:
            "HTML tag inserted before highlighted words in search results.",
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/highlightPreTag/",
    },
    highlightPostTag: {
        label: "Highlight Post Tag",
        description:
            "HTML tag inserted after highlighted words in search results.",
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/highlightPostTag/",
    },
    snippetEllipsisText: {
        label: "Snippet Ellipsis Text",
        description:
            "String appended to snippeted text to indicate truncation.",
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/snippetEllipsisText/",
    },
    typoTolerance: {
        label: "Typo Tolerance",
        description:
            "Controls whether typo tolerance is enabled and how it behaves. Can be true, false, min (only 1 typo allowed), or strict (disallow typos on the first word).",
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/typoTolerance/",
    },
    minWordSizefor1Typo: {
        label: "Min Word Size for 1 Typo",
        description:
            "Minimum number of characters a word must have to accept 1 typo.",
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/minWordSizefor1Typo/",
    },
    minWordSizefor2Typos: {
        label: "Min Word Size for 2 Typos",
        description:
            "Minimum number of characters a word must have to accept 2 typos.",
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/minWordSizefor2Typos/",
    },
    allowTyposOnNumericTokens: {
        label: "Allow Typos on Numeric Tokens",
        description: "Whether to allow typos on purely numeric search tokens.",
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/allowTyposOnNumericTokens/",
    },
    disableTypoToleranceOnAttributes: {
        label: "Disable Typo Tolerance on Attributes",
        description:
            "List of attributes on which typo tolerance is disabled. Useful for SKUs, codes, or identifiers.",
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/disableTypoToleranceOnAttributes/",
    },
    hitsPerPage: {
        label: "Hits Per Page",
        description: "Number of hits returned per page of results.",
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/hitsPerPage/",
    },
    paginationLimitedTo: {
        label: "Pagination Limited To",
        description:
            "Maximum number of hits accessible via pagination. Limits deep pagination for performance.",
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/paginationLimitedTo/",
    },
    maxValuesPerFacet: {
        label: "Max Values Per Facet",
        description: "Maximum number of facet values returned for each facet.",
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/maxValuesPerFacet/",
    },
    distinct: {
        label: "Distinct",
        description:
            "De-duplicates results based on attributeForDistinct. Set to 0 (off), 1 (single result per group), or higher for multiple results per group.",
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/distinct/",
    },
    attributeForDistinct: {
        label: "Attribute for Distinct",
        description:
            "The attribute used for de-duplication when distinct is enabled. Must be set before enabling distinct.",
        docUrl: "https://www.algolia.com/doc/api-reference/api-parameters/attributeForDistinct/",
    },
};

export const RANKING_CRITERIA = {
    typo: "Number of typos in the match",
    geo: "Distance from a geographic location",
    words: "Number of matched query words",
    filters: "Score from optional filter scoring",
    proximity: "Distance between matched words",
    attribute: "Position of the matched attribute in searchableAttributes",
    exact: "Exactness of the match (prefix vs full match)",
    custom: "Custom ranking criteria you defined",
};
