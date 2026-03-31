import { inferType, analyzeRecords } from "./attributeAnalyzer";

describe("inferType", () => {
    test("detects string", () => expect(inferType("hello")).toBe("string"));
    test("detects number", () => expect(inferType(42)).toBe("number"));
    test("detects boolean", () => expect(inferType(true)).toBe("boolean"));
    test("detects array", () => expect(inferType([1, 2])).toBe("array"));
    test("detects object", () => expect(inferType({ a: 1 })).toBe("object"));
    test("detects null", () => expect(inferType(null)).toBe("null"));
    test("detects undefined", () => expect(inferType(undefined)).toBe("null"));
});

describe("analyzeRecords", () => {
    test("returns empty for no records", () => {
        const result = analyzeRecords([]);
        expect(result.attributes).toEqual([]);
        expect(result.totalRecords).toBe(0);
    });

    test("discovers attributes from records", () => {
        const records = [
            { objectID: "1", name: "Alice", age: 30 },
            { objectID: "2", name: "Bob", age: 25 },
        ];
        const result = analyzeRecords(records);
        expect(result.totalRecords).toBe(2);
        expect(result.attributes.length).toBe(3);

        const nameAttr = result.attributes.find((a) => a.name === "name");
        expect(nameAttr.primaryType).toBe("string");
        expect(nameAttr.fillRate).toBe(100);
        expect(nameAttr.presentCount).toBe(2);
    });

    test("objectID sorted first", () => {
        const records = [{ objectID: "1", name: "Alice" }];
        const result = analyzeRecords(records);
        expect(result.attributes[0].name).toBe("objectID");
        expect(result.attributes[0].isObjectID).toBe(true);
    });

    test("tracks null and empty values", () => {
        const records = [
            { objectID: "1", tag: "a" },
            { objectID: "2", tag: null },
            { objectID: "3", tag: "" },
        ];
        const result = analyzeRecords(records);
        const tagAttr = result.attributes.find((a) => a.name === "tag");
        expect(tagAttr.presentCount).toBe(2);
        expect(tagAttr.nullCount).toBe(1);
        expect(tagAttr.emptyCount).toBe(1);
    });

    test("handles mixed types", () => {
        const records = [
            { objectID: "1", val: "text" },
            { objectID: "2", val: 42 },
        ];
        const result = analyzeRecords(records);
        const valAttr = result.attributes.find((a) => a.name === "val");
        expect(valAttr.types.length).toBe(2);
    });

    test("tracks cardinality", () => {
        const records = [
            { objectID: "1", color: "red" },
            { objectID: "2", color: "blue" },
            { objectID: "3", color: "red" },
        ];
        const result = analyzeRecords(records);
        const colorAttr = result.attributes.find((a) => a.name === "color");
        expect(colorAttr.cardinality).toBe(2);
    });

    test("collects sample values", () => {
        const records = [
            { objectID: "1", name: "Alice" },
            { objectID: "2", name: "Bob" },
            { objectID: "3", name: "Charlie" },
            { objectID: "4", name: "Diana" },
        ];
        const result = analyzeRecords(records);
        const nameAttr = result.attributes.find((a) => a.name === "name");
        expect(nameAttr.sampleValues.length).toBeLessThanOrEqual(3);
    });

    test("skips _highlightResult", () => {
        const records = [
            {
                objectID: "1",
                name: "Alice",
                _highlightResult: { name: {} },
            },
        ];
        const result = analyzeRecords(records);
        expect(
            result.attributes.find((a) => a.name === "_highlightResult")
        ).toBeUndefined();
    });

    test("handles sparse attributes (missing from some records)", () => {
        const records = [
            { objectID: "1", a: "x" },
            { objectID: "2", b: "y" },
        ];
        const result = analyzeRecords(records);
        const attrA = result.attributes.find((a) => a.name === "a");
        expect(attrA.fillRate).toBe(50);
        expect(attrA.missingCount).toBe(1);
    });
});
