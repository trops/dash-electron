import { scoreIndex } from "./indexHealthScorer";

describe("scoreIndex", () => {
    test("returns zero for null settings", () => {
        const result = scoreIndex(null);
        expect(result.score).toBe(0);
        expect(result.checks).toEqual([]);
    });

    test("well-configured index scores high", () => {
        const settings = {
            searchableAttributes: ["title", "description", "brand"],
            customRanking: ["desc(popularity)", "desc(rating)"],
            attributesForFaceting: [
                "brand",
                "filterOnly(category)",
                "searchable(tags)",
            ],
            ranking: [
                "typo",
                "geo",
                "words",
                "filters",
                "proximity",
                "attribute",
                "exact",
                "custom",
            ],
            typoTolerance: true,
            highlightPreTag: "<em>",
            highlightPostTag: "</em>",
            paginationLimitedTo: 1000,
            attributesToRetrieve: ["title", "description", "image", "price"],
        };
        const result = scoreIndex(settings);
        expect(result.score).toBe(result.maxScore);
        expect(result.checks.every((c) => c.status === "pass")).toBe(true);
    });

    test("empty settings produces warnings and fails", () => {
        const result = scoreIndex({});
        const statuses = result.checks.map((c) => c.status);
        expect(statuses).toContain("fail");
        expect(statuses).toContain("warn");
        expect(result.score).toBeLessThan(result.maxScore);
    });

    test("searchable attributes wildcard produces warning", () => {
        const result = scoreIndex({ searchableAttributes: ["*"] });
        const check = result.checks.find(
            (c) => c.name === "Searchable Attributes"
        );
        expect(check.status).toBe("warn");
    });

    test("missing custom ranking produces warning", () => {
        const result = scoreIndex({
            searchableAttributes: ["title"],
        });
        const check = result.checks.find((c) => c.name === "Custom Ranking");
        expect(check.status).toBe("warn");
    });

    test("disabled typo tolerance produces warning", () => {
        const result = scoreIndex({ typoTolerance: false });
        const check = result.checks.find((c) => c.name === "Typo Tolerance");
        expect(check.status).toBe("warn");
    });

    test("distinct without attributeForDistinct produces fail", () => {
        const result = scoreIndex({ distinct: 1 });
        const check = result.checks.find(
            (c) => c.name === "Distinct / De-duplication"
        );
        expect(check.status).toBe("fail");
    });

    test("distinct with attributeForDistinct passes", () => {
        const result = scoreIndex({
            distinct: 1,
            attributeForDistinct: "group_id",
        });
        const check = result.checks.find(
            (c) => c.name === "Distinct / De-duplication"
        );
        expect(check.status).toBe("pass");
    });

    test("high pagination limit produces warning", () => {
        const result = scoreIndex({ paginationLimitedTo: 10000 });
        const check = result.checks.find((c) => c.name === "Pagination");
        expect(check.status).toBe("warn");
    });

    test("wildcard attributesToRetrieve produces warning", () => {
        const result = scoreIndex({ attributesToRetrieve: ["*"] });
        const check = result.checks.find(
            (c) => c.name === "Retrievable Attributes"
        );
        expect(check.status).toBe("warn");
    });

    test("non-default ranking formula produces warning", () => {
        const result = scoreIndex({
            ranking: ["custom", "typo", "words"],
        });
        const check = result.checks.find((c) => c.name === "Ranking Formula");
        expect(check.status).toBe("warn");
    });

    test("all checks include name, category, status, weight, detail", () => {
        const result = scoreIndex({});
        for (const check of result.checks) {
            expect(check).toHaveProperty("name");
            expect(check).toHaveProperty("category");
            expect(check).toHaveProperty("status");
            expect(check).toHaveProperty("weight");
            expect(check).toHaveProperty("detail");
            expect(["pass", "warn", "fail"]).toContain(check.status);
        }
    });

    test("score equals sum of passing check weights", () => {
        const result = scoreIndex({
            searchableAttributes: ["title"],
            customRanking: ["desc(pop)"],
        });
        const expectedScore = result.checks
            .filter((c) => c.status === "pass")
            .reduce((sum, c) => sum + c.weight, 0);
        expect(result.score).toBe(expectedScore);
    });
});
