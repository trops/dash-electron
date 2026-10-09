/**
 * Pins for the Algolia Search widget's MCP helpers, against the tool
 * names and schema Algolia's hosted MCP server uses today
 * (`algolia_search_index_<index>`, `queries: [{ query }]`).
 */
const {
    listSearchIndices,
    buildSearchParams,
    normalizeSearchResult,
} = require("./mcpUtils");

describe("listSearchIndices", () => {
    it("lists only index tools on current servers", () => {
        expect(
            listSearchIndices([
                { name: "algolia_search_for_facet_values" },
                { name: "algolia_search_index_hr_sample_dataset" },
                { name: "algolia_recommendations" },
            ])
        ).toEqual([
            { index: "hr_sample_dataset", suffix: "index_hr_sample_dataset" },
        ]);
    });

    it("falls back to algolia_search_<index> on older servers", () => {
        expect(
            listSearchIndices([
                "algolia_search_products",
                "algolia_search_for_facet_values",
            ])
        ).toEqual([{ index: "products", suffix: "products" }]);
    });

    it("returns [] with no tools", () => {
        expect(listSearchIndices(undefined)).toEqual([]);
    });
});

describe("buildSearchParams", () => {
    const opts = {
        query: "manager",
        page: 1,
        hitsPerPage: 10,
        sessionId: "s1",
    };

    it("sends queries[] and the required fields to current servers", () => {
        const schema = {
            queries: {},
            userIntent: {},
            originalQuery: {},
            sessionId: {},
            hitsPerPage: {},
            page: {},
            attributesToRetrieve: {},
        };
        expect(buildSearchParams(schema, opts)).toEqual({
            queries: [{ query: "manager" }],
            userIntent: "manager",
            originalQuery: "manager",
            sessionId: "s1",
            hitsPerPage: 10,
            page: 1,
        });
    });

    it("sends a plain query to older servers", () => {
        expect(
            buildSearchParams({ query: {}, hits_per_page: {} }, opts)
        ).toEqual({ query: "manager", hits_per_page: 10 });
    });

    it("gives an empty search a userIntent", () => {
        expect(
            buildSearchParams({ userIntent: {} }, { ...opts, query: "" })
                .userIntent
        ).toBe("browse records");
    });
});

describe("normalizeSearchResult", () => {
    it("reads a single result", () => {
        expect(
            normalizeSearchResult({ hits: [{ objectID: "a" }], nbHits: 40 })
        ).toEqual({ hits: [{ objectID: "a" }], nbHits: 40, nbPages: null });
    });

    it("uses the first of a multi-query response", () => {
        expect(
            normalizeSearchResult([
                { hits: [{ objectID: "a" }], nbHits: 1, nbPages: 1 },
                { hits: [], nbHits: 0 },
            ])
        ).toEqual({ hits: [{ objectID: "a" }], nbHits: 1, nbPages: 1 });
    });

    it("returns null for text that isn't a result", () => {
        expect(normalizeSearchResult("Input validation error")).toBeNull();
    });
});
