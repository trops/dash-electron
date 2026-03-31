import { generateRecommendations } from "./configRecommender";

describe("generateRecommendations", () => {
    test("returns empty for null settings", () => {
        expect(generateRecommendations(null)).toEqual([]);
    });

    test("well-configured index produces no recommendations", () => {
        const settings = {
            searchableAttributes: ["title", "description"],
            customRanking: ["desc(popularity)"],
            attributesForFaceting: ["category", "brand"],
            attributesToRetrieve: ["title", "image", "price"],
            typoTolerance: true,
            paginationLimitedTo: 1000,
            hitsPerPage: 20,
        };
        const recs = generateRecommendations(settings, []);
        expect(recs).toEqual([]);
    });

    test("missing searchableAttributes generates high-priority rec", () => {
        const recs = generateRecommendations({}, []);
        const rec = recs.find((r) => r.title.includes("searchable"));
        expect(rec).toBeTruthy();
        expect(rec.priority).toBe("high");
    });

    test("wildcard searchableAttributes generates recommendation", () => {
        const recs = generateRecommendations(
            { searchableAttributes: ["*"] },
            []
        );
        const rec = recs.find((r) => r.title.includes("wildcard"));
        expect(rec).toBeTruthy();
    });

    test("suggests text attributes for searchableAttributes", () => {
        const attributes = [
            {
                name: "title",
                primaryType: "string",
                fillRate: 100,
                cardinality: 50,
                isObjectID: false,
            },
            {
                name: "description",
                primaryType: "string",
                fillRate: 90,
                cardinality: 50,
                isObjectID: false,
            },
        ];
        const recs = generateRecommendations({}, attributes);
        const rec = recs.find((r) => r.title.includes("searchable"));
        expect(rec.suggestion).toContain("title");
        expect(rec.suggestion).toContain("description");
    });

    test("missing customRanking generates recommendation", () => {
        const recs = generateRecommendations(
            { searchableAttributes: ["title"] },
            []
        );
        const rec = recs.find((r) => r.title.includes("custom ranking"));
        expect(rec).toBeTruthy();
        expect(rec.priority).toBe("medium");
    });

    test("suggests numeric attributes for custom ranking", () => {
        const attributes = [
            {
                name: "popularity",
                primaryType: "number",
                fillRate: 100,
                isObjectID: false,
            },
        ];
        const recs = generateRecommendations(
            { searchableAttributes: ["title"] },
            attributes
        );
        const rec = recs.find((r) => r.title.includes("custom ranking"));
        expect(rec.suggestion).toContain("popularity");
    });

    test("missing faceting with good candidates generates rec", () => {
        const attributes = [
            {
                name: "category",
                primaryType: "string",
                fillRate: 95,
                cardinality: 10,
                isObjectID: false,
            },
        ];
        const recs = generateRecommendations(
            { searchableAttributes: ["title"] },
            attributes
        );
        const rec = recs.find((r) => r.title.includes("faceting"));
        expect(rec).toBeTruthy();
        expect(rec.suggestion).toContain("category");
    });

    test("disabled typo tolerance generates recommendation", () => {
        const recs = generateRecommendations(
            { searchableAttributes: ["t"], typoTolerance: false },
            []
        );
        const rec = recs.find((r) => r.title.includes("typo"));
        expect(rec).toBeTruthy();
    });

    test("distinct without attributeForDistinct generates high-priority rec", () => {
        const recs = generateRecommendations(
            { searchableAttributes: ["t"], distinct: 1 },
            []
        );
        const rec = recs.find((r) => r.title.includes("attributeForDistinct"));
        expect(rec).toBeTruthy();
        expect(rec.priority).toBe("high");
    });

    test("high pagination limit generates performance rec", () => {
        const recs = generateRecommendations(
            { searchableAttributes: ["t"], paginationLimitedTo: 10000 },
            []
        );
        const rec = recs.find((r) => r.title.includes("pagination"));
        expect(rec).toBeTruthy();
    });

    test("high hitsPerPage generates performance rec", () => {
        const recs = generateRecommendations(
            { searchableAttributes: ["t"], hitsPerPage: 100 },
            []
        );
        const rec = recs.find((r) => r.title.includes("hits per page"));
        expect(rec).toBeTruthy();
    });

    test("all recs have required fields", () => {
        const recs = generateRecommendations({}, []);
        for (const r of recs) {
            expect(r).toHaveProperty("priority");
            expect(r).toHaveProperty("category");
            expect(r).toHaveProperty("title");
            expect(r).toHaveProperty("detail");
            expect(["high", "medium", "low"]).toContain(r.priority);
        }
    });
});
