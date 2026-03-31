import { scoreRelevance } from "./relevanceScorer";

describe("scoreRelevance", () => {
    test("returns zero for empty inputs", () => {
        expect(scoreRelevance([], []).score).toBe(0);
        expect(scoreRelevance(null, null).score).toBe(0);
    });

    test("perfect match scores 100%", () => {
        const hits = [{ objectID: "a" }, { objectID: "b" }, { objectID: "c" }];
        const expected = ["a", "b", "c"];
        const result = scoreRelevance(hits, expected);
        expect(result.metrics.precisionAtN).toBe(100);
        expect(result.metrics.recall).toBe(100);
        expect(result.hitDetails[0].status).toBe("perfect");
        expect(result.hitDetails[1].status).toBe("perfect");
        expect(result.hitDetails[2].status).toBe("perfect");
    });

    test("reversed order still has full recall", () => {
        const hits = [{ objectID: "c" }, { objectID: "b" }, { objectID: "a" }];
        const expected = ["a", "b", "c"];
        const result = scoreRelevance(hits, expected);
        expect(result.metrics.recall).toBe(100);
        expect(result.metrics.precisionAtN).toBe(100);
        // c at pos 0, expected pos 2, delta = -2, abs(2) <= 2 → "close"
        expect(result.hitDetails[0].status).toBe("close");
    });

    test("close positions marked as close", () => {
        const hits = [{ objectID: "b" }, { objectID: "a" }];
        const expected = ["a", "b"];
        const result = scoreRelevance(hits, expected);
        expect(result.hitDetails[0].status).toBe("close"); // b at pos 0, expected at pos 1, delta -1
        expect(result.hitDetails[1].status).toBe("close"); // a at pos 1, expected at pos 0, delta +1
    });

    test("missing expected results lower recall", () => {
        const hits = [{ objectID: "a" }, { objectID: "x" }, { objectID: "y" }];
        const expected = ["a", "b", "c"];
        const result = scoreRelevance(hits, expected);
        expect(result.metrics.recall).toBe(33); // 1 of 3
        expect(result.metrics.precisionAtN).toBe(33); // 1 in top 3
    });

    test("unexpected results marked correctly", () => {
        const hits = [{ objectID: "x" }, { objectID: "a" }];
        const expected = ["a"];
        const result = scoreRelevance(hits, expected);
        expect(result.hitDetails[0].status).toBe("unexpected");
        expect(result.hitDetails[1].status).toBe("close"); // a at pos 1, expected at 0, delta +1
    });

    test("firstFoundAt tracks first expected result position", () => {
        const hits = [{ objectID: "x" }, { objectID: "y" }, { objectID: "a" }];
        const expected = ["a"];
        const result = scoreRelevance(hits, expected);
        expect(result.metrics.firstFoundAt).toBe(3);
    });

    test("hitDetails include title from common fields", () => {
        const hits = [
            { objectID: "1", title: "First" },
            { objectID: "2", name: "Second" },
            { objectID: "3" },
        ];
        const expected = ["1"];
        const result = scoreRelevance(hits, expected);
        expect(result.hitDetails[0].title).toBe("First");
        expect(result.hitDetails[1].title).toBe("Second");
        expect(result.hitDetails[2].title).toBe("3"); // falls back to objectID
    });

    test("positionDelta is correct", () => {
        const hits = [{ objectID: "c" }, { objectID: "a" }, { objectID: "b" }];
        const expected = ["a", "b", "c"];
        const result = scoreRelevance(hits, expected);
        // c: at pos 0, expected at pos 2, delta = 0 - 2 = -2
        expect(result.hitDetails[0].positionDelta).toBe(-2);
        // a: at pos 1, expected at pos 0, delta = 1 - 0 = 1
        expect(result.hitDetails[1].positionDelta).toBe(1);
    });

    test("MRR computation", () => {
        const hits = [{ objectID: "x" }, { objectID: "a" }];
        const expected = ["a"];
        const result = scoreRelevance(hits, expected);
        // MRR = 1/2 = 0.5 → 50%
        expect(result.metrics.mrr).toBe(50);
    });
});
