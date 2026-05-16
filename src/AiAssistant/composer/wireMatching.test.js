/**
 * Tests for wireMatching — Stage 3 candidate-filtering logic.
 *
 * The actual matching policy is loose-on-purpose (see file comment),
 * so the tests verify the score buckets we care about rather than
 * exact equivalence to a type system.
 */

import { scoreMethodForSlot, scoreMethodList } from "./wireMatching";

describe("scoreMethodForSlot", () => {
    test("void always scores 0", () => {
        expect(scoreMethodForSlot("Array<Object>", "void")).toBe(0);
        expect(scoreMethodForSlot("Object", "void")).toBe(0);
        expect(scoreMethodForSlot("string", "void")).toBe(0);
    });

    test("unknown slot type scores everything loose", () => {
        expect(scoreMethodForSlot("any", "Array<Object>")).toBe(1);
        expect(scoreMethodForSlot(null, "Object")).toBe(1);
        expect(scoreMethodForSlot("", "string")).toBe(1);
    });

    test("Array slot scores Array return as 2 (strong)", () => {
        expect(scoreMethodForSlot("Array<Object>", "Array<Object>")).toBe(2);
        expect(
            scoreMethodForSlot("Array<{label,value}>", "Array<{label,value}>")
        ).toBe(2);
    });

    test("Array slot scores hits-wrapped Array as 1 (loose)", () => {
        expect(
            scoreMethodForSlot(
                "Array<Object>",
                "{hits:Array<Object>,nbHits,page,nbPages}"
            )
        ).toBe(1);
    });

    test("Array slot rejects non-Array, non-Array-wrapped returns", () => {
        expect(scoreMethodForSlot("Array<Object>", "Object")).toBe(0);
        expect(scoreMethodForSlot("Array<Object>", "{taskID,objectID}")).toBe(
            0
        );
        expect(scoreMethodForSlot("Array<Object>", "string")).toBe(0);
    });

    test("Object slot accepts Object / { … } shapes only", () => {
        expect(scoreMethodForSlot("Object", "Object")).toBe(2);
        expect(scoreMethodForSlot("Object", "{taskID,objectID}")).toBe(2);
        expect(scoreMethodForSlot("Object", "Array<Object>")).toBe(0);
    });

    test("scalar slot only matches identical scalar return", () => {
        expect(scoreMethodForSlot("string", "string")).toBe(2);
        expect(scoreMethodForSlot("number", "string")).toBe(0);
        expect(scoreMethodForSlot("boolean", "Object")).toBe(0);
    });
});

describe("scoreMethodList", () => {
    const fakeRegistry = {
        listIndices: {
            returns: { type: "Array<{name,entries}>" },
        },
        search: {
            returns: { type: "{hits:Array<Object>,nbHits}" },
        },
        getSettings: {
            returns: { type: "Object" },
        },
        setSettings: {
            returns: { type: "void" },
        },
    };

    test("filters and orders by descending score for Array slots", () => {
        const ranked = scoreMethodList(
            Object.entries(fakeRegistry),
            "Array<Object>"
        );
        // setSettings excluded (void), getSettings excluded (Object).
        // listIndices (strong) before search (loose).
        expect(ranked.map((r) => r.name)).toEqual(["listIndices", "search"]);
        expect(ranked[0].score).toBe(2);
        expect(ranked[1].score).toBe(1);
    });

    test("includes Object-returning methods for Object slots", () => {
        // Both getSettings ({…}) and search ({hits:…}) are object
        // shapes — the matcher is intentionally loose; the user
        // picks based on description, not on whether the shape
        // exactly matches "Object".
        const ranked = scoreMethodList(Object.entries(fakeRegistry), "Object");
        const names = ranked.map((r) => r.name);
        expect(names).toContain("getSettings");
        // Array<…>-returning methods and void are excluded.
        expect(names).not.toContain("listIndices");
        expect(names).not.toContain("setSettings");
    });

    test("treats methods with missing returns metadata as score 0", () => {
        const ranked = scoreMethodList(
            [
                [
                    "broken",
                    {
                        /* no returns */
                    },
                ],
            ],
            "Array<Object>"
        );
        expect(ranked).toEqual([]);
    });

    test("alphabetizes ties within the same score bucket", () => {
        const reg = {
            zebra: { returns: { type: "Array<Object>" } },
            apple: { returns: { type: "Array<Object>" } },
        };
        const ranked = scoreMethodList(Object.entries(reg), "Array<Object>");
        expect(ranked.map((r) => r.name)).toEqual(["apple", "zebra"]);
    });
});
